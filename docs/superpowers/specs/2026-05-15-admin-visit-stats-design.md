# Estatísticas de visitas no /admin — Design

**Data:** 2026-05-15
**Autor:** brainstorming colaborativo (Ricardo + Claude)
**Status:** aprovado, pronto para implementação

## Problema

O dashboard de `/admin` (Drisclub) já mostra encomendas e receita, mas o utilizador não tem visibilidade sobre o tráfego do site:

- Quantas pessoas visitam por dia/semana/mês?
- Que produtos são mais vistos (não só os mais vendidos)?
- Qual é a taxa de conversão (visitas → encomendas pagas)?

Não existe nenhum sistema de analytics integrado, nem terceiro (Google Analytics, Plausible) nem in-house. A spec resolve isso com tracking próprio em Postgres, GDPR-friendly, sem cookies nem banners de consentimento, e widgets dentro do dashboard existente.

## Princípios

- **In-house no Postgres.** Sem dependências externas, dados ficam connosco.
- **Sem cookies, sem PII guardada.** IP é hashado em memória e descartado. *Daily rotating salt* impede tracking entre dias.
- **Fire-and-forget.** Tracking nunca adiciona latência ao SSR.
- **Tudo no `/admin` existente.** Sem nova página, sem nova entrada no menu lateral.
- **Mínimo possível de novo código.** Reaproveita padrões do projeto (Astro middleware, React islands, Drizzle, Vitest).

## Escopo

**Eventos contados:**

- Visitas à homepage (`/`)
- Visitas a páginas de produto (`/catalogo/[slug]`)
- Visitas a páginas institucionais: `/sobre-nos`, `/contactos`, `/faq`, `/envios-devolucoes`, `/politica-privacidade`, `/termos`

**Eventos NÃO contados:**

- Listagem do catálogo (`/catalogo` e `/catalogo/categoria/*`)
- Carrinho, checkout, obrigado (`/carrinho`, `/checkout`, `/obrigado`)
- Conta de cliente (`/conta*`)
- Tudo em `/admin/*` e `/api/*`
- Ficheiros estáticos, `/sitemap.xml`, `/robots.txt`
- Previews admin (`?draft=1`, `?preview=…`)
- Bots conhecidos (UA matches `/bot|crawler|spider|preview|monitor|lighthouse|headlesschrome/i`)
- Pedidos não-GET ou sem `Accept: text/html`

**Métricas calculadas:** pageviews (cru) e visitantes únicos/dia (via hash anónimo rotativo).

**Retenção:** 90 dias. Cleanup self-healing dentro de `getVisitStats` quando passa > 24h desde o último cleanup.

## Arquitetura

### 1. Schema — nova tabela `page_views`

```ts
// src/db/schema.ts
export const pageViews = pgTable("page_views", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  path: text("path").notNull(),                            // já normalizado, sem querystring
  visitorHash: text("visitor_hash").notNull(),             // hash anónimo diário (16 chars)
  viewedAt: timestamp("viewed_at", { withTimezone: true })
    .defaultNow().notNull(),
}, (t) => ({
  viewedAtIdx: index("page_views_viewed_at_idx").on(t.viewedAt),
  pathDateIdx: index("page_views_path_date_idx").on(t.path, t.viewedAt),
}));
```

Migração: `src/db/migrations/0018_page_views.sql`. Segue o padrão dos existentes (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`). Adicionar entrada em `meta/_journal.json`.

Não há `productId` na tabela — produto resolvido por JOIN com `products.slug` em query time (`path = '/catalogo/' || products.slug`). Evita lookup em runtime de tracking e mantém o schema desacoplado da tabela `products`.

### 2. Tracking — middleware Astro + helper puro

**Helper puro:** `src/lib/tracking.ts`

```ts
export function shouldTrack(request: Request, url: URL): boolean;
export function getClientIp(headers: Headers): string;
export function computeVisitorHash(input: {
  ip: string;
  ua: string;
  dateIso: string; // YYYY-MM-DD em UTC
  secret: string;  // process.env.AUTH_SECRET
}): string;
export async function recordPageView(input: {
  path: string;
  ip: string;
  ua: string;
}): Promise<void>;
```

Regras de `shouldTrack`:

```ts
const TRACKED_PATTERNS = [
  /^\/$/,
  /^\/catalogo\/[^/]+$/,
  /^\/(sobre-nos|contactos|faq|envios-devolucoes|politica-privacidade|termos)$/,
];

function shouldTrack(req: Request, url: URL): boolean {
  if (req.method !== "GET") return false;
  if (!(req.headers.get("accept") ?? "").includes("text/html")) return false;
  if (url.searchParams.has("draft") || url.searchParams.has("preview")) return false;
  if (BOT_UA.test(req.headers.get("user-agent") ?? "")) return false;
  return TRACKED_PATTERNS.some((re) => re.test(url.pathname));
}
```

`getClientIp` lê `x-forwarded-for` (Railway proxy injecta), pega no primeiro IP, fallback para `x-real-ip`, fallback final `"unknown"`.

`computeVisitorHash`:

```ts
const dailySalt = sha256(`${secret}:${dateIso}`);
return sha256(`${dailySalt}:${ip}:${ua}`).slice(0, 16);
```

`recordPageView` faz o `INSERT` no Postgres. Sem `await` exterior — o caller usa `void`.

**Middleware:** `src/middleware.ts` (já existe). Antes do `next()` na branch storefront:

```ts
const url = new URL(context.request.url);
if (shouldTrack(context.request, url)) {
  void recordPageView({
    path: url.pathname,
    ip: getClientIp(context.request.headers),
    ua: context.request.headers.get("user-agent") ?? "",
  }).catch((err) => console.warn("[track]", err));
}
```

Sem `await` para não bloquear o SSR. Erros logged mas não propagam — analytics é best-effort.

### 3. Retenção — cleanup self-healing

Estado em memória dentro de `src/lib/analytics.ts`. Sem schema novo, sem migração.

```ts
let lastCleanupAt = 0;

async function maybeCleanupOldPageViews(): Promise<void> {
  const now = Date.now();
  if (now - lastCleanupAt > 24 * 60 * 60 * 1000) {
    lastCleanupAt = now;
    void cleanupOldPageViews().catch((err) => {
      console.warn("[cleanup]", err);
      lastCleanupAt = 0; // permite retentar na próxima chamada
    });
  }
}

async function cleanupOldPageViews(): Promise<void> {
  await db.execute(sql`DELETE FROM page_views WHERE viewed_at < now() - interval '90 days'`);
}
```

`maybeCleanupOldPageViews()` é chamado fire-and-forget no topo de `getVisitStats()`. Em restart do container, `lastCleanupAt` volta a 0 e o cleanup corre na próxima entrada admin — idempotente (o `DELETE` só apaga linhas que correspondem ao WHERE, segura para correr múltiplas vezes).

Para uma loja com pelo menos uma visita admin por dia (caso atual), isto chega. Se ficar > 24h sem ninguém entrar em `/admin`, a próxima entrada cobre o atraso.

### 4. Queries — `src/lib/analytics.ts`

API pública:

```ts
export type VisitStats = {
  kpis: {
    today:  { pageviews: number; uniques: number };
    last7:  { pageviews: number; uniques: number };
    last30: { pageviews: number; uniques: number };
  };
  daily30: Array<{ date: string; pageviews: number; uniques: number }>;
  topProducts30: Array<{ productId: string; name: string; slug: string; views: number }>;
  topPages30:    Array<{ path: string; title: string | null; views: number }>;
  conversion30:  { paidOrders: number; uniques: number; ratePct: number | null };
};

export async function getVisitStats(): Promise<VisitStats>;
```

`Promise.all` para correr as 5 queries em paralelo. Esquemas SQL (resumo — implementação usa Drizzle):

- **KPIs** (×3 períodos: today, 7d, 30d): `COUNT(*)` e `COUNT(DISTINCT visitor_hash)` filtrados por `viewed_at`.
- **Daily 30d:** `date_trunc('day', viewed_at)::date`, group + order by data.
- **Top produtos 30d:** `JOIN products ON path = '/catalogo/' || slug`, top 5 por views.
- **Top páginas 30d:** `WHERE path NOT LIKE '/catalogo/%'` + `LEFT JOIN pages ON pages.slug = LTRIM(path, '/')` (para resolver `pages.title`). `/` mapeia para `slug = ''` (homepage).
- **Conversão 30d:** dois subselects — encomendas pagas (status ∈ paid/preparing/shipped/delivered) e visitantes únicos. Rácio = `paidOrders / uniques * 100`, ou `null` se `uniques === 0`.

A taxa de conversão é uma aproximação. O numerador (encomendas) usa `orders.created_at`, o denominador (visitantes) usa `page_views.viewed_at`. Não há identidade comum entre encomendas e visitas anónimas. É a métrica padrão da indústria; o tooltip do widget explicita "encomendas pagas ÷ visitantes únicos no período".

### 5. UI — `/admin/index.astro`

Estrutura final, do topo para o fundo:

1. Banner notificações por email (existente, inalterado).
2. **Secção "Encomendas"** (existente):
   - KPI grid 4 cards: Pendentes / Receita total / Mês atual / Mês anterior.
   - Chart row: `DailyChart` (vendas) + Top 5 mais vendidos.
3. **🆕 Secção "Tráfego do site"** (novo):
   - **KPI grid 4 cards** (mesma `grid md:grid-cols-2 xl:grid-cols-4`):
     - **Hoje** — `{uniques} visitantes · {pageviews} pageviews`
     - **Últimos 7 dias** — idem
     - **Últimos 30 dias** — idem
     - **Taxa de conversão (30d)** — `{ratePct}%` em destaque + subtítulo `{paidOrders} encomendas em {uniques} visitantes`, com tooltip explicativo.
   - **Chart row** (`grid lg:grid-cols-[1.4fr_1fr]`, espelhando a row 1):
     - `VisitsChart` (React island) — linha pageviews + linha visitantes únicos, últimos 30 dias.
     - `TopVisitedBlock.astro` (server) — duas listas:
       - **Top 5 produtos vistos** — nome + views, link para `/admin/products/[id]`.
       - **Top páginas** — título (resolvido via `pages.title` quando existe, com fallback humanizado do path) + views.

Cada widget tem fallback "Sem dados ainda — as estatísticas aparecem após as primeiras visitas." quando vazio (igual ao padrão do "Top 5 mais vendidos" existente).

Sem nova entrada no menu lateral. Tudo continua acessível em `/admin` raiz.

**Componentes novos:**

- `src/components/admin/VisitsChart.tsx` — segue o padrão de `DailyChart.tsx` (mesma lib de chart já usada). Dois séries, legenda em PT-PT, tooltip com formato `dia/mês`.
- `src/components/admin/TopVisitedBlock.astro` — componente Astro server-rendered. Stack vertical em mobile, side-by-side em `lg:` ou `xl:`.

Visual: classes existentes `rounded-3xl border border-ink-line bg-surface p-6`, headings `text-rosa-500`, idênticas à metade de cima — coerência total.

## Testing

Convenção do projeto: Vitest + RTL, sem DB nos testes.

**`src/lib/tracking.test.ts`** (novo):

- `shouldTrack`:
  - `GET /` → true
  - `GET /catalogo/foo` → true
  - `GET /sobre-nos` → true
  - `GET /catalogo` → false
  - `GET /catalogo/categoria/totes` → false
  - `GET /admin/orders` → false
  - `GET /api/products` → false
  - `POST /` → false
  - `GET /?draft=1` → false
  - `GET /?preview=xyz` → false
  - UA `Googlebot/2.1` → false
  - Sem `Accept: text/html` → false
- `getClientIp`:
  - `x-forwarded-for: "1.2.3.4, 5.6.7.8"` → `"1.2.3.4"`
  - só `x-real-ip` → esse valor
  - vazio → `"unknown"`
- `computeVisitorHash`:
  - Mesma entrada → mesmo output (determinismo)
  - Dia diferente, resto igual → hash diferente
  - Sempre 16 chars

**`src/components/admin/VisitsChart.test.tsx`** (novo):

- `data=[]` → mostra "Sem dados ainda"
- 3 pontos de dados → labels de eixo X corretos + legendas "Pageviews" e "Visitantes únicos"

**Cobertura não testada (intencionalmente):**

- `recordPageView`, `cleanupOldPageViews`, queries de `analytics.ts` — tocam BD; deixadas para smoke-test manual pós-deploy (padrão do projeto).
- Middleware integration — verificação manual em `npm run dev`.

**Smoke test pós-deploy:**

1. Visitar `https://drisclub.com/` → uma nova linha em `page_views`.
2. `/admin` → KPI "Hoje" mostra ≥1.
3. Visitar `/admin/orders` → contagem não sobe (excluído).
4. `curl -A "Googlebot/2.1" https://drisclub.com/` → bot filtrado, contagem não sobe.

## Decisões e trade-offs

- **Fire-and-forget vs await:** escolhido fire-and-forget. Trade-off aceite: se o processo cair entre responder e escrever, perdem-se eventos. Analytics não exige reliability transacional.
- **Daily rotating salt vs cookie:** salt rotativo. Sem necessidade de banner de consentimento (não há identificador persistente entre sessões/dias). Trade-off: um visitante que volta no dia seguinte conta como "novo". Para uma loja deste tamanho é negligível e a privacidade compensa.
- **In-house vs ferramenta externa:** in-house. Trade-off: menos features (sem breakdown por dispositivo, país, referrer). Trocadas por integração nativa em `/admin` e zero dependências externas.
- **Cleanup self-healing vs cron service:** self-healing dentro de `getVisitStats`. Trade-off: depende de ≥1 entrada no admin a cada 24h (caso atual). Se isso mudar, migra-se para Railway cron.
- **Sem `productId` no schema:** JOIN em query time via `'/catalogo/' || products.slug`. Mantém o schema simples e desacoplado. Trade-off: queries de top produtos requerem JOIN; com índice `(path, viewed_at)` e tabela de produtos pequena, performance fica imperceptível.
- **Allowlist explícito de páginas institucionais:** previne tracking acidental de paths que ainda não existem ou serão removidos. Trade-off: cada nova página institucional precisa de uma linha no array. Aceitável dado o ritmo baixo de criação.

## Open

- Configuração de cron Railway dedicado para cleanup — só se o pattern self-healing falhar na prática.
- Extensões futuras (referrers, breakdown geo via header `cf-ipcountry`, eventos custom como "adicionar ao carrinho") — fora do escopo desta spec; pode ser uma fase 2.
