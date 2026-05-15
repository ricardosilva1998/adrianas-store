# Estatísticas de visitas no /admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar tracking de visitas anónimo + 4 widgets em `/admin` (KPIs hoje/7d/30d, gráfico diário 30d, top produtos vistos + top páginas, taxa de conversão).

**Architecture:** Tabela nova `page_views` no Postgres. Middleware Astro dispara `recordPageView` fire-and-forget para paths permitidos (homepage, institucionais, produto). Hash anónimo rotativo (sha256 de `secret + dia + ip + ua`, sem cookies, sem PII guardada). 5 queries paralelas em `analytics.ts` alimentam o dashboard. Cleanup de 90d self-healing in-memory.

**Tech Stack:** Astro SSR + React islands, Drizzle ORM + PostgreSQL, Vitest + React Testing Library, Tailwind v4. Sem novas dependências.

**Spec:** `docs/superpowers/specs/2026-05-15-admin-visit-stats-design.md`

---

## Pré-requisitos

- Branch `main` limpa (sem trabalho em curso a colidir com `src/middleware.ts`, `src/db/schema.ts`, `src/pages/admin/index.astro`).
- `npm install` executado, ambiente local funcional (`npm run dev` arranca).
- Variável `AUTH_SECRET` definida em `.env` (já existe — é usada pelo auth admin).

---

## File Structure

**Novos ficheiros:**

- `src/db/migrations/0018_page_views.sql` — DDL
- `src/lib/tracking.ts` — `shouldTrack`, `getClientIp`, `computeVisitorHash`, `recordPageView`
- `src/lib/tracking.test.ts` — testes das funções puras
- `src/lib/analytics.ts` — `getVisitStats`, `cleanupOldPageViews`, `maybeCleanupOldPageViews`
- `src/components/admin/VisitsChart.tsx` — gráfico 30d (React island, SVG hand-rolled como `DailyChart`)
- `src/components/admin/VisitsChart.test.tsx` — testes do componente
- `src/components/admin/TopVisitedBlock.astro` — top produtos + top páginas, server-rendered

**Modificados:**

- `src/db/schema.ts` — adicionar tabela `pageViews`
- `src/db/migrations/meta/_journal.json` — append entry para 0018
- `src/middleware.ts` — branch storefront chama `void recordPageView(...)` quando `shouldTrack` aprova
- `src/pages/admin/index.astro` — nova secção "Tráfego do site" com 4 widgets

**Não tocados:** `src/lib/queries.ts` (existing dashboard stats), `src/lib/config.ts`, `src/lib/config-server.ts` (sem schema changes), `DailyChart.tsx` (referência intacta).

---

## Task 1: Schema da tabela `page_views` + migração

**Files:**

- Modify: `src/db/schema.ts` (append a nova tabela perto do fim, antes das relations)
- Create: `src/db/migrations/0018_page_views.sql`
- Modify: `src/db/migrations/meta/_journal.json:131` (append nova entry)

- [ ] **Step 1: Adicionar tabela `pageViews` em `src/db/schema.ts`**

Adicionar imediatamente antes da secção `// Relations` (no fim do ficheiro, antes do primeiro `export const ...Relations = relations(...)`). Confirmar que `serial` e `index` já estão importados no topo (estão — linha 7 e 11). Acrescentar:

```ts
export const pageViews = pgTable(
  "page_views",
  {
    id: serial("id").primaryKey(),
    path: text("path").notNull(),
    visitorHash: text("visitor_hash").notNull(),
    viewedAt: timestamp("viewed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("page_views_viewed_at_idx").on(t.viewedAt),
    index("page_views_path_date_idx").on(t.path, t.viewedAt),
  ],
);
```

Notas:
- `serial` (int4) é o mesmo padrão usado por todas as tabelas do projeto. Com 90 dias de retenção e ~100k visitas/dia (pior caso) o teto de int4 (2.1B) nunca é atingido.
- A forma `(t) => [...]` (array) é o padrão do projeto (`products_category_idx`, `orders_status_idx`, etc.).

- [ ] **Step 2: Criar `src/db/migrations/0018_page_views.sql`**

```sql
CREATE TABLE IF NOT EXISTS "page_views" (
  "id" serial PRIMARY KEY NOT NULL,
  "path" text NOT NULL,
  "visitor_hash" text NOT NULL,
  "viewed_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "page_views_viewed_at_idx"
  ON "page_views" ("viewed_at");

CREATE INDEX IF NOT EXISTS "page_views_path_date_idx"
  ON "page_views" ("path", "viewed_at");
```

- [ ] **Step 3: Adicionar entry em `src/db/migrations/meta/_journal.json`**

Substituir o último elemento de `entries` por dois, mantendo a vírgula correta. Adicionar imediatamente a seguir à entry `0017_password_reset_tokens` (linha ~131):

```json
,
{
  "idx": 18,
  "version": "7",
  "when": 1779228000000,
  "tag": "0018_page_views",
  "breakpoints": true
}
```

(O `when` é um epoch ms ligeiramente após o de 0017 — `1778857704000`. Qualquer valor maior funciona; usar `1779228000000` para ficar à frente.)

- [ ] **Step 4: Verificar que o `npm run build` aceita o schema novo**

Run: `npm run build`
Expected: build OK em ~1.5–2s. Se falhar com erro tipo "type 'serial' not assignable" rever step 1.

- [ ] **Step 5: Verificar que `npm run db:migrate` aplica a migração contra um Postgres local (opcional)**

Se há Postgres local com `DATABASE_URL` configurado:

Run: `npm run db:migrate`
Expected: log "applying migration 0018_page_views". Se não houver BD local, este step é skipped — a migration é validada por execução automática no deploy Railway.

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.ts src/db/migrations/0018_page_views.sql src/db/migrations/meta/_journal.json
git commit -m "feat(db): tabela page_views para tracking de visitas anónimo"
```

---

## Task 2: Funções puras de tracking (TDD)

**Files:**

- Create: `src/lib/tracking.test.ts`
- Create: `src/lib/tracking.ts`

- [ ] **Step 1: Escrever os testes em `src/lib/tracking.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import {
  shouldTrack,
  getClientIp,
  computeVisitorHash,
} from "./tracking";

function req(method: string, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/x", { method, headers });
}

describe("shouldTrack", () => {
  const html = { accept: "text/html" };

  it("counts homepage GET with text/html accept", () => {
    expect(shouldTrack(req("GET", html), new URL("http://x/"))).toBe(true);
  });

  it("counts product pages", () => {
    expect(
      shouldTrack(req("GET", html), new URL("http://x/catalogo/tote-bag")),
    ).toBe(true);
  });

  it("counts institutional pages", () => {
    for (const p of [
      "/sobre-nos",
      "/contactos",
      "/faq",
      "/envios-devolucoes",
      "/politica-privacidade",
      "/termos",
    ]) {
      expect(shouldTrack(req("GET", html), new URL(`http://x${p}`))).toBe(true);
    }
  });

  it("excludes catalog listing", () => {
    expect(shouldTrack(req("GET", html), new URL("http://x/catalogo"))).toBe(
      false,
    );
  });

  it("excludes catalog category", () => {
    expect(
      shouldTrack(req("GET", html), new URL("http://x/catalogo/categoria/totes")),
    ).toBe(false);
  });

  it("excludes admin", () => {
    expect(shouldTrack(req("GET", html), new URL("http://x/admin/orders"))).toBe(
      false,
    );
  });

  it("excludes api", () => {
    expect(shouldTrack(req("GET", html), new URL("http://x/api/products"))).toBe(
      false,
    );
  });

  it("excludes non-GET", () => {
    expect(shouldTrack(req("POST", html), new URL("http://x/"))).toBe(false);
  });

  it("excludes draft preview", () => {
    expect(
      shouldTrack(req("GET", html), new URL("http://x/?draft=1")),
    ).toBe(false);
  });

  it("excludes ?preview=token", () => {
    expect(
      shouldTrack(req("GET", html), new URL("http://x/?preview=abc")),
    ).toBe(false);
  });

  it("excludes bots", () => {
    expect(
      shouldTrack(
        req("GET", { ...html, "user-agent": "Googlebot/2.1" }),
        new URL("http://x/"),
      ),
    ).toBe(false);
  });

  it("excludes requests without text/html accept", () => {
    expect(
      shouldTrack(req("GET", { accept: "application/json" }), new URL("http://x/")),
    ).toBe(false);
  });
});

describe("getClientIp", () => {
  it("uses first IP from x-forwarded-for", () => {
    const h = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(getClientIp(h)).toBe("1.2.3.4");
  });

  it("trims whitespace", () => {
    const h = new Headers({ "x-forwarded-for": "  1.2.3.4 , 5.6.7.8" });
    expect(getClientIp(h)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    const h = new Headers({ "x-real-ip": "9.9.9.9" });
    expect(getClientIp(h)).toBe("9.9.9.9");
  });

  it("returns 'unknown' when nothing present", () => {
    expect(getClientIp(new Headers())).toBe("unknown");
  });
});

describe("computeVisitorHash", () => {
  const baseInput = {
    ip: "1.2.3.4",
    ua: "Mozilla/5.0",
    dateIso: "2026-05-15",
    secret: "test-secret",
  };

  it("is deterministic for same input", () => {
    const a = computeVisitorHash(baseInput);
    const b = computeVisitorHash(baseInput);
    expect(a).toBe(b);
  });

  it("returns 16-char string", () => {
    expect(computeVisitorHash(baseInput)).toHaveLength(16);
  });

  it("differs across days for same ip+ua", () => {
    const a = computeVisitorHash({ ...baseInput, dateIso: "2026-05-15" });
    const b = computeVisitorHash({ ...baseInput, dateIso: "2026-05-16" });
    expect(a).not.toBe(b);
  });

  it("differs across IPs same day", () => {
    const a = computeVisitorHash({ ...baseInput, ip: "1.1.1.1" });
    const b = computeVisitorHash({ ...baseInput, ip: "2.2.2.2" });
    expect(a).not.toBe(b);
  });

  it("differs across user agents same day", () => {
    const a = computeVisitorHash({ ...baseInput, ua: "A" });
    const b = computeVisitorHash({ ...baseInput, ua: "B" });
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Correr os testes — devem falhar (ficheiro não existe)**

Run: `npm test -- --run src/lib/tracking.test.ts`
Expected: FAIL com erro `Cannot find module './tracking'` ou similar.

- [ ] **Step 3: Implementar `src/lib/tracking.ts` (funções puras + recordPageView)**

```ts
import { createHash } from "node:crypto";
import { db, schema } from "../db/client";

const TRACKED_PATTERNS: ReadonlyArray<RegExp> = [
  /^\/$/,
  /^\/catalogo\/[^/]+$/,
  /^\/(sobre-nos|contactos|faq|envios-devolucoes|politica-privacidade|termos)$/,
];

const BOT_UA_RE =
  /bot|crawler|spider|preview|monitor|lighthouse|headlesschrome/i;

export function shouldTrack(request: Request, url: URL): boolean {
  if (request.method !== "GET") return false;

  const accept = request.headers.get("accept") ?? "";
  if (!accept.includes("text/html")) return false;

  if (url.searchParams.has("draft") || url.searchParams.has("preview")) {
    return false;
  }

  const ua = request.headers.get("user-agent") ?? "";
  if (BOT_UA_RE.test(ua)) return false;

  return TRACKED_PATTERNS.some((re) => re.test(url.pathname));
}

export function getClientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const xri = headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "unknown";
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function computeVisitorHash(input: {
  ip: string;
  ua: string;
  dateIso: string;
  secret: string;
}): string {
  const dailySalt = sha256(`${input.secret}:${input.dateIso}`);
  return sha256(`${dailySalt}:${input.ip}:${input.ua}`).slice(0, 16);
}

export async function recordPageView(input: {
  path: string;
  ip: string;
  ua: string;
}): Promise<void> {
  const secret = process.env.AUTH_SECRET ?? "";
  if (!secret) {
    // Sem secret não conseguimos gerar hash anónimo coerente. Silencioso para não derrubar SSR.
    return;
  }
  const dateIso = new Date().toISOString().slice(0, 10);
  const visitorHash = computeVisitorHash({
    ip: input.ip,
    ua: input.ua,
    dateIso,
    secret,
  });
  await db.insert(schema.pageViews).values({
    path: input.path,
    visitorHash,
  });
}
```

- [ ] **Step 4: Correr os testes — devem passar todos**

Run: `npm test -- --run src/lib/tracking.test.ts`
Expected: PASS. ~20 tests passando.

- [ ] **Step 5: Correr toda a suite para garantir que nada partiu**

Run: `npm test -- --run`
Expected: 161+ passed / 1 skipped (141 baseline da última deploy + 20 novos).

- [ ] **Step 6: Commit**

```bash
git add src/lib/tracking.ts src/lib/tracking.test.ts
git commit -m "feat(tracking): funções puras de filtragem + hash anónimo para page_views"
```

---

## Task 3: Integração no middleware

**Files:**

- Modify: `src/middleware.ts` (adicionar import + bloco antes do `return next()` da branch storefront)

- [ ] **Step 1: Editar `src/middleware.ts` — adicionar import**

Adicionar à lista de imports no topo do ficheiro:

```ts
import { shouldTrack, getClientIp, recordPageView } from "./lib/tracking";
```

- [ ] **Step 2: Editar `src/middleware.ts` — inserir bloco de tracking**

Localizar o `return next();` final (último `return` no fim da função `defineMiddleware`, depois do `if (previewToken)` block). Imediatamente antes desse `return next();`, inserir:

```ts
  // Tracking de visitas (storefront only — branch admin já saiu acima).
  if (shouldTrack(context.request, context.url)) {
    void recordPageView({
      path: context.url.pathname,
      ip: getClientIp(context.request.headers),
      ua: context.request.headers.get("user-agent") ?? "",
    }).catch((err) => console.warn("[track]", err));
  }
```

Confirmar que fica DEPOIS do bloco de admin (que tem o próprio `return next();`) e ANTES do `return next();` final da branch storefront.

- [ ] **Step 3: Verificar que `npm run build` passa**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 4: Smoke test manual em dev (opcional)**

Se houver Postgres local com a migração 0018 já aplicada:

```bash
# terminal 1
npm run dev

# terminal 2
curl -H "Accept: text/html" http://localhost:3000/ > /dev/null
psql "$DATABASE_URL" -c "SELECT count(*), max(viewed_at) FROM page_views;"
```

Expected: count >= 1, `viewed_at` recente. Parar o `npm run dev` (Ctrl+C).

Se não houver Postgres local: skipped — verificação acontece pós-deploy.

- [ ] **Step 5: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(tracking): middleware regista page_views fire-and-forget"
```

---

## Task 4: Queries de analytics + cleanup self-healing

**Files:**

- Create: `src/lib/analytics.ts`

- [ ] **Step 1: Criar `src/lib/analytics.ts`**

```ts
import { db, schema } from "../db/client";
import { sql } from "drizzle-orm";

export type VisitKpi = { pageviews: number; uniques: number };

export type VisitStats = {
  kpis: {
    today: VisitKpi;
    last7: VisitKpi;
    last30: VisitKpi;
  };
  daily30: Array<{ date: string; pageviews: number; uniques: number }>;
  topProducts30: Array<{
    productId: number;
    name: string;
    slug: string;
    views: number;
  }>;
  topPages30: Array<{
    path: string;
    title: string | null;
    views: number;
  }>;
  conversion30: {
    paidOrders: number;
    uniques: number;
    ratePct: number | null;
  };
};

let lastCleanupAt = 0;

async function cleanupOldPageViews(): Promise<void> {
  await db.execute(
    sql`DELETE FROM page_views WHERE viewed_at < now() - interval '90 days'`,
  );
}

function maybeCleanupOldPageViews(): void {
  const now = Date.now();
  if (now - lastCleanupAt > 24 * 60 * 60 * 1000) {
    lastCleanupAt = now;
    void cleanupOldPageViews().catch((err) => {
      console.warn("[cleanup page_views]", err);
      lastCleanupAt = 0;
    });
  }
}

type DbResult<T> = { rows: T[] } | T[];

function rowsOf<T>(result: DbResult<T>): T[] {
  if (Array.isArray(result)) return result;
  return result.rows ?? [];
}

async function kpiForInterval(intervalSql: string): Promise<VisitKpi> {
  const result = (await db.execute(
    sql.raw(
      `SELECT count(*)::int AS pageviews,
              count(DISTINCT visitor_hash)::int AS uniques
         FROM page_views
        WHERE viewed_at >= ${intervalSql}`,
    ),
  )) as DbResult<{ pageviews: number; uniques: number }>;
  const row = rowsOf(result)[0];
  return {
    pageviews: row?.pageviews ?? 0,
    uniques: row?.uniques ?? 0,
  };
}

export async function getVisitStats(): Promise<VisitStats> {
  maybeCleanupOldPageViews();

  const [todayK, last7K, last30K, daily, topProducts, topPages, conv] =
    await Promise.all([
      kpiForInterval(`date_trunc('day', now())`),
      kpiForInterval(`now() - interval '7 days'`),
      kpiForInterval(`now() - interval '30 days'`),

      db.execute(
        sql.raw(
          `SELECT to_char(date_trunc('day', viewed_at), 'YYYY-MM-DD') AS date,
                  count(*)::int AS pageviews,
                  count(DISTINCT visitor_hash)::int AS uniques
             FROM page_views
            WHERE viewed_at >= now() - interval '30 days'
            GROUP BY date_trunc('day', viewed_at)
            ORDER BY date_trunc('day', viewed_at)`,
        ),
      ) as Promise<DbResult<{ date: string; pageviews: number; uniques: number }>>,

      db.execute(
        sql.raw(
          `SELECT p.id AS product_id, p.name, p.slug, count(*)::int AS views
             FROM page_views pv
             JOIN products p ON pv.path = '/catalogo/' || p.slug
            WHERE pv.viewed_at >= now() - interval '30 days'
            GROUP BY p.id, p.name, p.slug
            ORDER BY count(*) DESC
            LIMIT 5`,
        ),
      ) as Promise<DbResult<{ product_id: number; name: string; slug: string; views: number }>>,

      db.execute(
        sql.raw(
          `SELECT pv.path AS path,
                  pg.title AS title,
                  count(*)::int AS views
             FROM page_views pv
             LEFT JOIN pages pg ON pg.slug = ltrim(pv.path, '/')
            WHERE pv.viewed_at >= now() - interval '30 days'
              AND pv.path NOT LIKE '/catalogo/%'
            GROUP BY pv.path, pg.title
            ORDER BY count(*) DESC
            LIMIT 5`,
        ),
      ) as Promise<DbResult<{ path: string; title: string | null; views: number }>>,

      db.execute(
        sql.raw(
          `SELECT
             (SELECT count(*)::int FROM orders
               WHERE status IN ('paid','preparing','shipped','delivered')
                 AND created_at >= now() - interval '30 days') AS paid_orders,
             (SELECT count(DISTINCT visitor_hash)::int FROM page_views
               WHERE viewed_at >= now() - interval '30 days') AS uniques`,
        ),
      ) as Promise<DbResult<{ paid_orders: number; uniques: number }>>,
    ]);

  const dailyRows = rowsOf(daily);
  const productRows = rowsOf(topProducts);
  const pagesRows = rowsOf(topPages);
  const convRow = rowsOf(conv)[0] ?? { paid_orders: 0, uniques: 0 };
  const ratePct =
    convRow.uniques > 0 ? (convRow.paid_orders / convRow.uniques) * 100 : null;

  return {
    kpis: { today: todayK, last7: last7K, last30: last30K },
    daily30: dailyRows.map((r) => ({
      date: r.date,
      pageviews: r.pageviews,
      uniques: r.uniques,
    })),
    topProducts30: productRows.map((r) => ({
      productId: r.product_id,
      name: r.name,
      slug: r.slug,
      views: r.views,
    })),
    topPages30: pagesRows.map((r) => ({
      path: r.path,
      title: r.title,
      views: r.views,
    })),
    conversion30: {
      paidOrders: convRow.paid_orders,
      uniques: convRow.uniques,
      ratePct,
    },
  };
}
```

Nota sobre `db.execute`: o cliente Drizzle do projeto pode devolver um objeto com `.rows` (node-postgres) ou um array diretamente (postgres-js). O helper `rowsOf` normaliza ambas as formas — evita refactor do `db/client.ts`.

`schema` está importado mas não é usado diretamente neste módulo (queries são via `sql.raw`). Drizzle fornece `db.execute` para queries cruas, e usamos `schema` por convenção/coerência com `recordPageView` que sim usa `schema.pageViews`. Se o linter reclamar, remover `schema` do import.

- [ ] **Step 2: Verificar que o build aceita o ficheiro**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 3: Verificar que a suite continua verde**

Run: `npm test -- --run`
Expected: PASS (mesma contagem do Task 2 — não há novos testes).

- [ ] **Step 4: Commit**

```bash
git add src/lib/analytics.ts
git commit -m "feat(analytics): getVisitStats + cleanup self-healing de page_views"
```

---

## Task 5: Componente `VisitsChart` (TDD)

**Files:**

- Create: `src/components/admin/VisitsChart.test.tsx`
- Create: `src/components/admin/VisitsChart.tsx`

- [ ] **Step 1: Escrever testes em `src/components/admin/VisitsChart.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import VisitsChart from "./VisitsChart";

describe("VisitsChart", () => {
  it("renders empty state when data is empty", () => {
    render(<VisitsChart data={[]} />);
    expect(screen.getByText(/sem dados ainda/i)).toBeInTheDocument();
  });

  it("renders legend with Pageviews and Visitantes únicos", () => {
    render(
      <VisitsChart
        data={[
          { date: "2026-05-13", pageviews: 10, uniques: 6 },
          { date: "2026-05-14", pageviews: 14, uniques: 9 },
          { date: "2026-05-15", pageviews: 12, uniques: 7 },
        ]}
      />,
    );
    expect(screen.getByText(/pageviews/i)).toBeInTheDocument();
    expect(screen.getByText(/visitantes únicos/i)).toBeInTheDocument();
  });

  it("shows total pageviews in the header summary", () => {
    render(
      <VisitsChart
        data={[
          { date: "2026-05-13", pageviews: 10, uniques: 6 },
          { date: "2026-05-14", pageviews: 14, uniques: 9 },
          { date: "2026-05-15", pageviews: 12, uniques: 7 },
        ]}
      />,
    );
    expect(screen.getByText("36")).toBeInTheDocument(); // 10+14+12
  });
});
```

- [ ] **Step 2: Correr os testes — devem falhar**

Run: `npm test -- --run src/components/admin/VisitsChart.test.tsx`
Expected: FAIL com erro `Cannot find module './VisitsChart'`.

- [ ] **Step 3: Implementar `src/components/admin/VisitsChart.tsx`**

Padrão SVG hand-rolled idêntico ao `DailyChart.tsx` (sem dependência de chart library) mas com duas linhas: pageviews (rosa) e uniques (ink).

```tsx
interface VisitsChartProps {
  data: Array<{ date: string; pageviews: number; uniques: number }>;
}

export default function VisitsChart({ data }: VisitsChartProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-3xl border border-ink-line bg-surface p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-rosa-500">
          Últimos 30 dias
        </p>
        <h3 className="mt-1 text-lg font-semibold text-ink">Visitas por dia</h3>
        <p className="mt-6 text-sm text-ink-muted">
          Sem dados ainda — as estatísticas aparecem após as primeiras visitas.
        </p>
      </div>
    );
  }

  const points: Array<{ date: string; pageviews: number; uniques: number }> = [];
  const map = new Map(data.map((d) => [d.date, d]));
  const today = new Date();
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const row = map.get(key);
    points.push({
      date: key,
      pageviews: row?.pageviews ?? 0,
      uniques: row?.uniques ?? 0,
    });
  }

  const totalPv = points.reduce((s, p) => s + p.pageviews, 0);
  const totalUq = points.reduce((s, p) => s + p.uniques, 0);

  const max = Math.max(1, ...points.map((p) => Math.max(p.pageviews, p.uniques)));
  const height = 140;
  const width = 720;
  const padX = 24;
  const padY = 16;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const toX = (i: number) => padX + (innerW * i) / (points.length - 1 || 1);
  const toY = (v: number) => padY + innerH - (innerH * v) / max;

  const pvPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(p.pageviews).toFixed(1)}`)
    .join(" ");
  const uqPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(p.uniques).toFixed(1)}`)
    .join(" ");

  return (
    <div className="rounded-3xl border border-ink-line bg-surface p-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-rosa-500">
            Últimos 30 dias
          </p>
          <h3 className="mt-1 text-lg font-semibold text-ink">Visitas por dia</h3>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold text-ink">{totalPv}</p>
          <p className="text-xs text-ink-muted">{totalUq} visitantes</p>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-6 h-36 w-full"
        preserveAspectRatio="none"
      >
        {[0.25, 0.5, 0.75].map((r) => (
          <line
            key={r}
            x1={padX}
            x2={width - padX}
            y1={padY + innerH * r}
            y2={padY + innerH * r}
            stroke="#f4e1e8"
            strokeDasharray="2 4"
          />
        ))}
        <path d={pvPath} fill="none" stroke="#ED7396" strokeWidth="2" strokeLinecap="round" />
        <path d={uqPath} fill="none" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 4" />
      </svg>

      <div className="mt-3 flex gap-4 text-xs text-ink-muted">
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-1 w-4 rounded-full bg-rosa-500" aria-hidden="true" />
          Pageviews
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className="inline-block h-1 w-4 rounded-full"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg,#1f2937 0 4px,transparent 4px 8px)",
            }}
            aria-hidden="true"
          />
          Visitantes únicos
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Correr os testes — devem passar**

Run: `npm test -- --run src/components/admin/VisitsChart.test.tsx`
Expected: 3 tests PASS.

- [ ] **Step 5: Correr toda a suite**

Run: `npm test -- --run`
Expected: PASS, 3 testes a mais que antes.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/VisitsChart.tsx src/components/admin/VisitsChart.test.tsx
git commit -m "feat(admin): VisitsChart com pageviews + visitantes únicos (30d)"
```

---

## Task 6: Componente `TopVisitedBlock.astro`

**Files:**

- Create: `src/components/admin/TopVisitedBlock.astro`

Convenção do projeto: componentes Astro server-rendered não têm unit tests. A correção é verificada visualmente.

- [ ] **Step 1: Criar `src/components/admin/TopVisitedBlock.astro`**

```astro
---
interface Props {
  topProducts: Array<{
    productId: number;
    name: string;
    slug: string;
    views: number;
  }>;
  topPages: Array<{
    path: string;
    title: string | null;
    views: number;
  }>;
}

const { topProducts, topPages } = Astro.props;

function humanizePath(path: string): string {
  if (path === "/") return "Página inicial";
  const slug = path.replace(/^\//, "");
  return slug
    .split("-")
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
---

<div class="rounded-3xl border border-ink-line bg-surface p-6">
  <div>
    <p class="text-xs font-semibold uppercase tracking-wide text-rosa-500">Últimos 30 dias</p>
    <h3 class="mt-1 text-lg font-semibold text-ink">Mais visitados</h3>
  </div>

  <div class="mt-6 space-y-6">
    <section>
      <p class="text-xs font-semibold uppercase tracking-wide text-ink-muted">Produtos</p>
      {topProducts.length === 0 ? (
        <p class="mt-3 text-sm text-ink-muted">Sem dados ainda.</p>
      ) : (
        <ol class="mt-3 space-y-3">
          {topProducts.map((p, idx) => (
            <li class="flex items-center gap-3">
              <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rosa-500 text-[10px] font-semibold text-white">
                {idx + 1}
              </span>
              <a
                href={`/admin/products/${p.productId}`}
                class="block min-w-0 flex-1 truncate text-sm font-medium text-ink hover:text-rosa-500"
              >
                {p.name}
              </a>
              <span class="text-xs text-ink-muted">{p.views} visitas</span>
            </li>
          ))}
        </ol>
      )}
    </section>

    <section>
      <p class="text-xs font-semibold uppercase tracking-wide text-ink-muted">Outras páginas</p>
      {topPages.length === 0 ? (
        <p class="mt-3 text-sm text-ink-muted">Sem dados ainda.</p>
      ) : (
        <ol class="mt-3 space-y-3">
          {topPages.map((p, idx) => (
            <li class="flex items-center gap-3">
              <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-[10px] font-semibold text-white">
                {idx + 1}
              </span>
              <span class="block min-w-0 flex-1 truncate text-sm font-medium text-ink">
                {p.title ?? humanizePath(p.path)}
              </span>
              <span class="text-xs text-ink-muted">{p.views} visitas</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  </div>
</div>
```

- [ ] **Step 2: Verificar que o `npm run build` passa**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/TopVisitedBlock.astro
git commit -m "feat(admin): TopVisitedBlock — top produtos vistos + top páginas"
```

---

## Task 7: Wire-up no dashboard `/admin/index.astro`

**Files:**

- Modify: `src/pages/admin/index.astro`

- [ ] **Step 1: Adicionar imports no frontmatter de `src/pages/admin/index.astro`**

No topo do `---` frontmatter, junto aos imports existentes (`AdminLayout`, `DailyChart`, `getDashboardStats`, etc.) adicionar:

```ts
import VisitsChart from "../../components/admin/VisitsChart.tsx";
import TopVisitedBlock from "../../components/admin/TopVisitedBlock.astro";
import { getVisitStats } from "../../lib/analytics";
```

- [ ] **Step 2: Adicionar a chamada a `getVisitStats` no frontmatter**

Localizar a linha `const stats = await getDashboardStats();` e logo a seguir adicionar:

```ts
const visitStats = await getVisitStats();

const conv = visitStats.conversion30;
const convDisplay =
  conv.ratePct === null ? "—" : `${conv.ratePct.toFixed(1)}%`;
```

- [ ] **Step 3: Adicionar a nova secção no `<AdminLayout>` — depois da secção do gráfico+top vendidos**

Localizar o fecho da última `</section>` antes do `</AdminLayout>` (a secção `mt-8 grid gap-5 lg:grid-cols-[1.4fr_1fr]` que contém `<DailyChart />` + "Top 5 mais vendidos"). Imediatamente DEPOIS desse fecho `</section>` e ANTES de `</AdminLayout>`, inserir:

```astro
  <section class="mt-12">
    <header class="mb-5">
      <h2 class="text-lg font-semibold text-ink">Tráfego do site</h2>
      <p class="text-xs text-ink-muted">
        Visitas anónimas (sem cookies) registadas nos últimos 30 dias.
      </p>
    </header>

    <div class="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-3xl border border-ink-line bg-surface p-6">
        <p class="text-xs font-semibold uppercase tracking-wide text-rosa-500">Hoje</p>
        <p class="mt-3 text-4xl font-semibold text-ink">{visitStats.kpis.today.uniques}</p>
        <p class="mt-3 text-xs text-ink-muted">
          visitantes · <strong class="text-ink">{visitStats.kpis.today.pageviews}</strong> pageviews
        </p>
      </div>

      <div class="rounded-3xl border border-ink-line bg-surface p-6">
        <p class="text-xs font-semibold uppercase tracking-wide text-rosa-500">Últimos 7 dias</p>
        <p class="mt-3 text-4xl font-semibold text-ink">{visitStats.kpis.last7.uniques}</p>
        <p class="mt-3 text-xs text-ink-muted">
          visitantes · <strong class="text-ink">{visitStats.kpis.last7.pageviews}</strong> pageviews
        </p>
      </div>

      <div class="rounded-3xl border border-ink-line bg-surface p-6">
        <p class="text-xs font-semibold uppercase tracking-wide text-rosa-500">Últimos 30 dias</p>
        <p class="mt-3 text-4xl font-semibold text-ink">{visitStats.kpis.last30.uniques}</p>
        <p class="mt-3 text-xs text-ink-muted">
          visitantes · <strong class="text-ink">{visitStats.kpis.last30.pageviews}</strong> pageviews
        </p>
      </div>

      <div
        class="rounded-3xl border border-ink-line bg-surface p-6"
        title="Encomendas pagas ÷ visitantes únicos no período (aproximação)"
      >
        <p class="text-xs font-semibold uppercase tracking-wide text-rosa-500">
          Taxa de conversão (30d)
        </p>
        <p class="mt-3 text-4xl font-semibold text-ink">{convDisplay}</p>
        <p class="mt-3 text-xs text-ink-muted">
          {conv.paidOrders} encomendas · {conv.uniques} visitantes
        </p>
      </div>
    </div>

    <div class="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <VisitsChart client:load data={visitStats.daily30} />
      <TopVisitedBlock
        topProducts={visitStats.topProducts30}
        topPages={visitStats.topPages30}
      />
    </div>
  </section>
```

- [ ] **Step 4: Verificar build**

Run: `npm run build`
Expected: build OK em ~1.7s.

- [ ] **Step 5: Smoke test manual em dev (opcional se houver Postgres)**

Run: `npm run dev`, abrir `http://localhost:3000/admin` → fazer login → ver dashboard. Confirmar:
- Secção "Tráfego do site" aparece DEPOIS de "Encomendas".
- 4 KPI cards renderizam (mesmo a zeros se BD vazia).
- VisitsChart aparece (mostra "Sem dados ainda" se vazio).
- TopVisitedBlock aparece (mostra "Sem dados ainda" se vazio).

- [ ] **Step 6: Correr a suite completa**

Run: `npm test -- --run`
Expected: PASS, mesma contagem que após Task 5.

- [ ] **Step 7: Commit**

```bash
git add src/pages/admin/index.astro
git commit -m "feat(admin): secção 'Tráfego do site' com KPIs, gráfico e top visitados"
```

---

## Task 8: Smoke test pós-deploy (manual)

Este "task" não é código — é um checklist a executar APÓS o `team-deployment` fazer push para o Railway. O agente de implementação não corre o deploy; isso é feito separadamente conforme convenção do projeto.

- [ ] **Step 1: Verificar criação da tabela**

```bash
railway run -s adrianas-store -- bash -c 'psql $DATABASE_URL -c "\d page_views"'
```

Expected: `page_views` com 4 colunas (id, path, visitor_hash, viewed_at) + 2 índices.

- [ ] **Step 2: Disparar uma visita normal**

```bash
curl -A "Mozilla/5.0" -H "Accept: text/html" https://drisclub.com/ > /dev/null
```

Esperar 2-3 segundos (fire-and-forget) e:

```bash
railway run -s adrianas-store -- bash -c 'psql $DATABASE_URL -c "SELECT count(*), max(viewed_at) FROM page_views;"'
```

Expected: count ≥ 1, `viewed_at` dos últimos segundos.

- [ ] **Step 3: Disparar visita de bot (deve ser ignorada)**

```bash
BEFORE=$(railway run -s adrianas-store -- bash -c 'psql -At $DATABASE_URL -c "SELECT count(*) FROM page_views;"')
curl -A "Googlebot/2.1" -H "Accept: text/html" https://drisclub.com/ > /dev/null
sleep 3
AFTER=$(railway run -s adrianas-store -- bash -c 'psql -At $DATABASE_URL -c "SELECT count(*) FROM page_views;"')
echo "Antes: $BEFORE / Depois: $AFTER (deve ser igual)"
```

Expected: contagem inalterada.

- [ ] **Step 4: Disparar visita admin (deve ser ignorada)**

Visitar `https://drisclub.com/admin/login` no browser:

```bash
railway run -s adrianas-store -- bash -c 'psql $DATABASE_URL -c "SELECT path, count(*) FROM page_views GROUP BY path ORDER BY count(*) DESC;"'
```

Expected: nenhum path começa por `/admin` ou `/api`.

- [ ] **Step 5: Verificar /admin no browser**

Login em `https://drisclub.com/admin`. Confirmar:
- Secção "Tráfego do site" aparece abaixo de "Encomendas por dia + Mais vendidos".
- KPI "Hoje" mostra ≥1.
- KPI "Últimos 7/30 dias" mostra valores coerentes.
- Taxa de conversão calcula (ou mostra "—" se uniques=0).
- VisitsChart renderiza com pelo menos um ponto.
- TopVisitedBlock lista produto/página se aplicável.

Se algum item falhar, capturar logs com `railway logs -s adrianas-store` filtrando por `[track]` ou `[cleanup page_views]`.

---

## Self-review checklist (executado antes de save final)

- ✅ Schema (spec §1) → Task 1
- ✅ Helper puro `shouldTrack` / `getClientIp` / `computeVisitorHash` (spec §2) → Task 2
- ✅ `recordPageView` (spec §2) → Task 2 step 3 (lib) + Task 3 (middleware integration)
- ✅ Cleanup self-healing (spec §3) → Task 4 step 1 (`maybeCleanupOldPageViews`)
- ✅ `getVisitStats` (spec §4) → Task 4
- ✅ UI 4 widgets + nova secção (spec §5) → Tasks 5, 6, 7
- ✅ Testes Vitest (spec Testing) → Task 2 + Task 5
- ✅ Smoke test pós-deploy (spec Testing) → Task 8
- ✅ Sem placeholders ("TBD"/"TODO"/"implement later") — todo o código está escrito
- ✅ Tipos consistentes — `VisitStats` definido em Task 4, consumido em Task 7 com mesmas property names (`kpis`, `daily30`, `topProducts30`, `topPages30`, `conversion30`)
- ✅ Function names consistentes — `cleanupOldPageViews` / `maybeCleanupOldPageViews` / `getVisitStats` / `recordPageView` / `computeVisitorHash` aparecem com a mesma assinatura em todas as referências
