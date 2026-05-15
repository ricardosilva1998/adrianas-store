# Announcement bar — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o `globals.banner` actual (texto plano + 2 cores hardcoded) por uma barra de anúncio totalmente editável: texto rico em modo inline (TipTap restrito), links inline ilimitados, cores de fundo e de texto livres em hex, e reset automático do "dispensar" quando o conteúdo muda.

**Architecture:** O shape de `globals.banner` muda de `{ text, linkUrl, bgColor: "rosa"|"ink", enabled, dismissible }` para `{ enabled, contentHtml, bgHex, textHex, dismissible, contentVersion }`. Um `z.preprocess` na schema do Zod aceita ambos os shapes (back-compat) e converte o antigo para o novo na leitura. O storefront extrai o banner do `Header.astro` para um novo `AnnouncementBar.astro` renderizado pelo `BaseLayout`, e a sanitização HTML usa uma allowlist apertada (`sanitizeAnnouncement`) com hook que aceita só `style="color:..."`. O admin reusa o `RichTextEditor` em novo modo `"inline"` (toolbar reduzida: B/I/U/cor/link) e dois `ColorPicker`s com presets derivados de `config.theme.colors`. O `contentVersion` é um hash SHA-256 (12 chars) do `contentHtml` recalculado server-side a cada `PUT /api/admin/site-config`; é a key do `localStorage` no botão de fechar, garantindo reset por versão.

**Tech Stack:** Astro 6 SSR + React 19 islands · TipTap 3 (`@tiptap/react`) · Zod 4 · `isomorphic-dompurify` · `node:crypto` (server) + `globalThis.crypto.subtle` (browser) · Vitest 4 + React Testing Library · Drizzle ORM + PostgreSQL.

---

## File structure

**Novos ficheiros:**
- `src/lib/legacy-banner.ts` — `escapeHtml`, `hashContentSync`, `hashContentAsync`, `legacyBannerMigration`, `EMPTY_CONTENT_VERSION`. Server-only (importa `node:crypto`).
- `src/lib/legacy-banner.test.ts` — testes unitários.
- `src/lib/announcement-bar.ts` — pure helper `getAnnouncementRender(banner)` que devolve `{ shouldRender, safeHtml, style }`. Mantém o `.astro` thin e testável.
- `src/lib/announcement-bar.test.ts` — testes unitários do helper.
- `src/components/AnnouncementBar.astro` — wrapper Astro thin que delega ao helper.
- `src/components/islands/AnnouncementDismissButton.tsx` — botão React `client:load`, versionado por `contentVersion`.
- `src/components/islands/AnnouncementDismissButton.test.tsx` — testes unitários.
- `scripts/migrate-banner-shape.ts` — script one-off para reescrever `site_config.globals.banner` em produção.

**Modificados:**
- `src/lib/config.ts` — schema `banner` com `z.preprocess(legacyBannerMigration, ...)`, novos campos, default reescrito.
- `src/lib/sanitize.ts` — `sanitizeAnnouncement(input)` + hook `uponSanitizeAttribute` para `style` escopado por flag.
- `src/lib/sanitize.test.ts` — testes adicionais para `sanitizeAnnouncement`.
- `src/components/admin/RichTextEditor.tsx` — prop opcional `mode?: "full" | "inline"` (default `"full"`).
- `src/components/admin/RichTextEditor.test.tsx` — novo ficheiro com testes dos dois modos.
- `src/components/admin/ColorPicker.tsx` — prop opcional `presets?: Array<{ label: string; hex: string }>` + linha de swatches.
- `src/components/admin/GlobalsEditor.tsx` — `BannerForm` reescrito (RichTextEditor inline, 2 ColorPickers com presets, preview).
- `src/components/Header.astro` — remover o bloco `{banner.enabled && banner.text && (...)}` e o cálculo `bannerBg`.
- `src/layouts/BaseLayout.astro` — inserir `<AnnouncementBar config={config} />` antes do `<Header config={config} />`.
- `src/pages/api/admin/site-config.ts` — re-hashar `contentVersion` server-side no `PUT`.
- `CLAUDE.md` — actualizar "Site config (theme + globals)" com o novo shape e a regra de sanitização inline.

**Notas importantes sobre o codebase actual:**
- O endpoint é `PUT /api/admin/site-config` (a spec dizia "PATCH /api/admin/globals" — não existe; o admin grava o `siteConfig` inteiro). Re-hash de `contentVersion` aplica-se aqui.
- `node:crypto` em `legacy-banner.ts` torna esse módulo server-only para `hashContentSync`. Mas `hashContentAsync` precisa de correr no admin (browser). Solução: importar `hashContentAsync` no admin via *named import*; o bundler do Astro tree-shake-a `createHash`. Se falhar, dividir em dois ficheiros (`legacy-banner.ts` server-only, `legacy-banner-async.ts` isomórfico) — decisão em Task 1, Step 7.

---

## Pré-requisito — Discovery: auditar `style=` em descrições de produto existentes

A spec assinala que o hook `uponSanitizeAttribute` para `style` afecta **todas** as chamadas a DOMPurify (incluindo `sanitizeHtml` usado em descrições de produto). Antes de implementar, precisamos de saber se algum dado em produção tem `style="..."` com algo mais que `color:`. Se sim, o hook tem de ser escopado por flag (já assim ficou pré-decidido em §5).

### Task 0: Auditoria de produção (sem código)

**Objectivo:** confirmar a decisão de hook-escopado (Task 4) ou simplificar para hook-global se a auditoria mostrar que só `color:` é usado em produção.

- [ ] **Step 1: Listar pontos no código que chamam `sanitizeHtml`**

```bash
grep -rn "sanitizeHtml" /Users/ricardosilva/projects/auto-generated-theme/src --include="*.ts" --include="*.tsx" --include="*.astro"
```

Esperado: chamadas em renderers de blocos que recebem HTML rico (ex. `ProductLongDescriptionBlock`, `TextBlock`). Anotar os ficheiros que renderizam HTML serializado pelo TipTap.

- [ ] **Step 2: Query à DB de produção para procurar `style=` em descrições e blocos**

```bash
railway run psql "$DATABASE_URL" -c "
  SELECT COUNT(*) AS produtos_com_style
  FROM products
  WHERE long_description ILIKE '%style=%';
"

railway run psql "$DATABASE_URL" -c "
  SELECT slug, COUNT(*) AS blocks_com_style
  FROM pages,
       jsonb_array_elements(blocks) AS block
  WHERE block::text ILIKE '%style=%'
  GROUP BY slug;
"
```

Esperado: 0 ou um número pequeno. Se > 0, ler 2-3 amostras com:

```bash
railway run psql "$DATABASE_URL" -c "
  SELECT slug, long_description
  FROM products
  WHERE long_description ILIKE '%style=%'
  LIMIT 3;
"
```

- [ ] **Step 3: Decidir abordagem do hook style**

Se a auditoria mostrar que **todos** os `style=` actuais são `color:` puros → manter a decisão de hook-escopado-por-flag (Task 4) na mesma — é a versão defensiva e custa o mesmo. Não simplificar.

Se algum `style=` tiver `font-size`, `display`, `background`, etc. → a Task 4 já implementa o hook escopado, portanto nada a mudar.

Documentar a contagem encontrada como comentário no topo de `src/lib/sanitize.ts` para o próximo programador (incluir data).

---

## Task 1: Pure utilities — `legacy-banner.ts`

**Files:**
- Create: `src/lib/legacy-banner.ts`
- Test: `src/lib/legacy-banner.test.ts`

- [ ] **Step 1: Escrever os testes para `escapeHtml`**

`src/lib/legacy-banner.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { escapeHtml } from "./legacy-banner";

describe("escapeHtml", () => {
  it("escapes < and >", () => {
    expect(escapeHtml("a<b>c</b>")).toBe("a&lt;b&gt;c&lt;/b&gt;");
  });

  it("escapes &", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it('escapes " and \'', () => {
    expect(escapeHtml(`he said "hi" it's`)).toBe("he said &quot;hi&quot; it&#39;s");
  });

  it("returns empty string for empty input", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("preserves plain text", () => {
    expect(escapeHtml("Frete grátis em encomendas ≥ 20€")).toBe(
      "Frete grátis em encomendas ≥ 20€",
    );
  });
});
```

- [ ] **Step 2: Correr o teste e ver falhar**

```bash
npm test -- --run src/lib/legacy-banner.test.ts
```

Expected: FAIL — "Cannot find module './legacy-banner'".

- [ ] **Step 3: Implementar `escapeHtml`**

`src/lib/legacy-banner.ts`:

```ts
import { createHash } from "node:crypto";

export function escapeHtml(s: string): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
```

- [ ] **Step 4: Correr o teste e ver passar**

```bash
npm test -- --run src/lib/legacy-banner.test.ts
```

Expected: PASS (5 testes).

- [ ] **Step 5: Escrever os testes para `hashContentSync` + `hashContentAsync`**

Adicionar a `src/lib/legacy-banner.test.ts`:

```ts
import { hashContentSync, hashContentAsync } from "./legacy-banner";

describe("hashContentSync", () => {
  it("returns a 12-char base64url-safe string", () => {
    const h = hashContentSync("oi");
    expect(h).toHaveLength(12);
    expect(h).toMatch(/^[A-Za-z0-9_-]{12}$/);
  });

  it("is deterministic", () => {
    expect(hashContentSync("oi")).toBe(hashContentSync("oi"));
  });

  it("differs for different inputs", () => {
    expect(hashContentSync("a")).not.toBe(hashContentSync("b"));
  });

  // Snapshot: SHA-256("oi") base64url, first 12 chars.
  // Verified via: node -e 'console.log(require("crypto").createHash("sha256").update("oi").digest("base64url").slice(0, 12))'
  it("returns the known snapshot for input 'oi'", () => {
    expect(hashContentSync("oi")).toBe("h_YzY0zEsC9i");
  });
});

describe("hashContentAsync", () => {
  it("returns the same hash as hashContentSync for several inputs", async () => {
    for (const s of ["oi", "<p>x</p>", "Frete grátis ≥ €20", ""]) {
      expect(await hashContentAsync(s)).toBe(hashContentSync(s));
    }
  });
});
```

- [ ] **Step 6: Correr o teste e ver falhar**

```bash
npm test -- --run src/lib/legacy-banner.test.ts
```

Expected: FAIL — funções não exportadas.

- [ ] **Step 7: Implementar `hashContentSync` e `hashContentAsync`**

Adicionar a `src/lib/legacy-banner.ts`:

```ts
// Sync hash for server-side use (Zod preprocess, API endpoint, migration script).
// Uses node:crypto which is available in Astro SSR (Node runtime).
export function hashContentSync(html: string): string {
  return createHash("sha256").update(html).digest("base64url").slice(0, 12);
}

// Async hash for client-side use (admin editor onChange).
// Uses Web Crypto API; result must equal hashContentSync for the same input.
export async function hashContentAsync(html: string): Promise<string> {
  const data = new TextEncoder().encode(html);
  const buf = await globalThis.crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(buf);
  let b64: string;
  if (typeof btoa === "function") {
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    b64 = btoa(bin);
  } else {
    b64 = Buffer.from(bytes).toString("base64");
  }
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "").slice(0, 12);
}

export const EMPTY_CONTENT_VERSION = hashContentSync("");
```

- [ ] **Step 8: Correr os testes e ver passar**

```bash
npm test -- --run src/lib/legacy-banner.test.ts
```

Expected: PASS (10 testes no total).

- [ ] **Step 9: Confirmar que o bundle do admin não puxa `node:crypto` para o browser**

```bash
npm run build
```

Se houver warnings/errors relacionados com `node:crypto` em bundles client (procurar por `node:crypto` ou `createHash` no output), dividir o módulo:

- `src/lib/legacy-banner.ts` mantém o que está (server-only).
- `src/lib/legacy-banner-async.ts` exporta só `hashContentAsync` (isomórfico, sem `node:crypto` import).

E todos os `import` no admin (em Task 10) usam `legacy-banner-async`.

Se o build correr clean, não fazer split — manter um único ficheiro.

Expected (caso comum): build passa porque o Vite tree-shake-a `createHash` dos imports nomeados que não o referenciam. Se passar: avançar sem split.

- [ ] **Step 10: Commit**

```bash
git add src/lib/legacy-banner.ts src/lib/legacy-banner.test.ts
git commit -m "feat(banner): utils escapeHtml + hashContentSync/Async em legacy-banner.ts"
```

---

## Task 2: `legacyBannerMigration` — back-compat preprocess

**Files:**
- Modify: `src/lib/legacy-banner.ts`
- Modify: `src/lib/legacy-banner.test.ts`

- [ ] **Step 1: Escrever os testes para `legacyBannerMigration`**

Adicionar a `src/lib/legacy-banner.test.ts`:

```ts
import { legacyBannerMigration } from "./legacy-banner";

describe("legacyBannerMigration", () => {
  it("preserves an already-new shape unchanged", () => {
    const input = {
      enabled: true,
      contentHtml: "<p>oi</p>",
      bgHex: "#ED7396",
      textHex: "#FFFFFF",
      dismissible: true,
      contentVersion: "abc123def456",
    };
    expect(legacyBannerMigration(input)).toEqual(input);
  });

  it("recomputes contentVersion if missing on new shape", () => {
    const out = legacyBannerMigration({
      enabled: true,
      contentHtml: "<p>oi</p>",
      bgHex: "#ED7396",
      textHex: "#FFFFFF",
      dismissible: true,
    });
    expect(out.contentVersion).toBe(hashContentSync("<p>oi</p>"));
  });

  it("migrates legacy rosa + no link", () => {
    const out = legacyBannerMigration({
      enabled: true,
      text: "Frete grátis ≥ 20€",
      linkUrl: null,
      bgColor: "rosa",
      dismissible: true,
    });
    expect(out.contentHtml).toBe("<p>Frete grátis ≥ 20€</p>");
    expect(out.bgHex).toBe("#ED7396");
    expect(out.textHex).toBe("#FFFFFF");
    expect(out.enabled).toBe(true);
    expect(out.dismissible).toBe(true);
    expect(out.contentVersion).toBe(hashContentSync("<p>Frete grátis ≥ 20€</p>"));
  });

  it("migrates legacy ink + linkUrl set", () => {
    const out = legacyBannerMigration({
      enabled: false,
      text: "Ver coleção",
      linkUrl: "/catalogo",
      bgColor: "ink",
      dismissible: false,
    });
    expect(out.contentHtml).toBe('<p><a href="/catalogo">Ver coleção</a></p>');
    expect(out.bgHex).toBe("#111111");
    expect(out.textHex).toBe("#FFFFFF");
    expect(out.enabled).toBe(false);
    expect(out.dismissible).toBe(false);
  });

  it("escapes HTML in legacy text", () => {
    const out = legacyBannerMigration({
      enabled: true,
      text: 'Promo <script>alert("x")</script>',
      linkUrl: null,
      bgColor: "rosa",
      dismissible: true,
    });
    expect(out.contentHtml).toBe(
      "<p>Promo &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</p>",
    );
  });

  it("handles linkUrl set to empty string as no link", () => {
    const out = legacyBannerMigration({
      enabled: true,
      text: "olá",
      linkUrl: "",
      bgColor: "rosa",
      dismissible: true,
    });
    expect(out.contentHtml).toBe("<p>olá</p>");
  });

  it("escapes linkUrl in href", () => {
    const out = legacyBannerMigration({
      enabled: true,
      text: "x",
      linkUrl: '/a"><script>x</script>',
      bgColor: "rosa",
      dismissible: true,
    });
    expect(out.contentHtml).not.toContain("<script>");
    expect(out.contentHtml).toContain("&quot;");
  });

  it("falls back to defaults when input is null", () => {
    const out = legacyBannerMigration(null);
    expect(out.enabled).toBe(false);
    expect(out.contentHtml).toBe("");
    expect(out.bgHex).toBe("#ED7396");
    expect(out.textHex).toBe("#FFFFFF");
    expect(out.dismissible).toBe(true);
    expect(out.contentVersion).toBe(hashContentSync(""));
  });

  it("falls back to defaults when input is empty object", () => {
    const out = legacyBannerMigration({});
    expect(out.contentHtml).toBe("");
    expect(out.enabled).toBe(false);
  });
});
```

- [ ] **Step 2: Correr o teste e ver falhar**

```bash
npm test -- --run src/lib/legacy-banner.test.ts
```

Expected: FAIL — `legacyBannerMigration is not exported`.

- [ ] **Step 3: Implementar `legacyBannerMigration`**

Adicionar a `src/lib/legacy-banner.ts`:

```ts
export interface NewBannerShape {
  enabled: boolean;
  contentHtml: string;
  bgHex: string;
  textHex: string;
  dismissible: boolean;
  contentVersion: string;
}

// Accepts unknown input from DB (jsonb) and returns the new shape.
// - New shape (contentHtml present): passthrough, recomputing contentVersion if missing.
// - Legacy shape ({ text, linkUrl, bgColor }): migrate.
// - Anything else (null/invalid): safe defaults.
export function legacyBannerMigration(input: unknown): NewBannerShape {
  const fallback: NewBannerShape = {
    enabled: false,
    contentHtml: "",
    bgHex: "#ED7396",
    textHex: "#FFFFFF",
    dismissible: true,
    contentVersion: EMPTY_CONTENT_VERSION,
  };

  if (!input || typeof input !== "object") return fallback;
  const b = input as Record<string, unknown>;

  if (typeof b.contentHtml === "string") {
    return {
      enabled: Boolean(b.enabled),
      contentHtml: b.contentHtml,
      bgHex: typeof b.bgHex === "string" ? b.bgHex : fallback.bgHex,
      textHex: typeof b.textHex === "string" ? b.textHex : fallback.textHex,
      dismissible: typeof b.dismissible === "boolean" ? b.dismissible : true,
      contentVersion:
        typeof b.contentVersion === "string" && b.contentVersion.length > 0
          ? b.contentVersion
          : hashContentSync(b.contentHtml),
    };
  }

  if (typeof b.text === "string") {
    const text = b.text;
    const linkUrl =
      typeof b.linkUrl === "string" && b.linkUrl.length > 0 ? b.linkUrl : null;
    const contentHtml = linkUrl
      ? `<p><a href="${escapeHtml(linkUrl)}">${escapeHtml(text)}</a></p>`
      : text
      ? `<p>${escapeHtml(text)}</p>`
      : "";
    const bgHex = b.bgColor === "ink" ? "#111111" : "#ED7396";
    return {
      enabled: Boolean(b.enabled),
      contentHtml,
      bgHex,
      textHex: "#FFFFFF",
      dismissible: typeof b.dismissible === "boolean" ? b.dismissible : true,
      contentVersion: hashContentSync(contentHtml),
    };
  }

  return fallback;
}
```

**Importante:** `legacyBannerMigration` precisa de ser declarado **depois** de `escapeHtml`, `hashContentSync`, e `EMPTY_CONTENT_VERSION` no ficheiro porque os usa. Verificar a ordem das declarações.

- [ ] **Step 4: Correr os testes e ver passar**

```bash
npm test -- --run src/lib/legacy-banner.test.ts
```

Expected: PASS (≈18 testes no total: 5 escapeHtml + 4 sync + 1 async + 8 migration).

- [ ] **Step 5: Commit**

```bash
git add src/lib/legacy-banner.ts src/lib/legacy-banner.test.ts
git commit -m "feat(banner): legacyBannerMigration converte shape antigo para o novo"
```

---

## Task 3: Wire o preprocess em `globalsSchema.banner`

**Files:**
- Modify: `src/lib/config.ts`
- Modify: `src/lib/legacy-banner.test.ts`

- [ ] **Step 1: Identificar o bloco `banner` actual em `src/lib/config.ts:63-69`**

```ts
banner: z.object({
  enabled: z.boolean(),
  text: z.string().max(200),
  linkUrl: z.string().nullable(),
  bgColor: z.enum(["rosa", "ink"]),
  dismissible: z.boolean(),
}),
```

- [ ] **Step 2: Adicionar o import no topo de `src/lib/config.ts`**

Após os imports actuais (linha 1-3):

```ts
import { legacyBannerMigration, EMPTY_CONTENT_VERSION } from "./legacy-banner";
```

- [ ] **Step 3: Substituir o bloco `banner: z.object({...})` por:**

```ts
banner: z.preprocess(
  legacyBannerMigration,
  z.object({
    enabled: z.boolean(),
    contentHtml: z.string().max(4000),
    bgHex: hexSchema,
    textHex: hexSchema,
    dismissible: z.boolean(),
    contentVersion: z.string().min(1).max(16),
  }),
),
```

- [ ] **Step 4: Actualizar `DEFAULT_SITE_CONFIG.globals.banner` em `src/lib/config.ts:134-140`**

Substituir:

```ts
banner: {
  enabled: false,
  text: "",
  linkUrl: null,
  bgColor: "rosa",
  dismissible: true,
},
```

por:

```ts
banner: {
  enabled: false,
  contentHtml: "",
  bgHex: "#ED7396",
  textHex: "#FFFFFF",
  dismissible: true,
  contentVersion: EMPTY_CONTENT_VERSION,
},
```

- [ ] **Step 5: Escrever teste de integração para o `globalsSchema`**

Adicionar a `src/lib/legacy-banner.test.ts`:

```ts
import { globalsSchema } from "./config";

describe("globalsSchema.banner preprocess integration", () => {
  const baseGlobals = {
    identity: {
      name: "x", tagline: "y", description: "z",
      email: "a@b.com", whatsapp: "+351 9", instagram: "@x",
      shippingProvider: "CTT", preparationDays: "3 dias",
    },
    nav: [{ href: "/", label: "x" }],
    footer: { columns: [], bottomText: "x" },
    payments: [{ id: "mbway" as const, label: "MB Way", instructions: "x" }],
    notifyEmails: [],
  };

  it("accepts new banner shape", () => {
    const parsed = globalsSchema.parse({
      ...baseGlobals,
      banner: {
        enabled: true,
        contentHtml: "<p>oi</p>",
        bgHex: "#FF0000",
        textHex: "#FFFFFF",
        dismissible: true,
        contentVersion: "abc123def456",
      },
    });
    expect(parsed.banner.contentHtml).toBe("<p>oi</p>");
    expect(parsed.banner.bgHex).toBe("#FF0000");
  });

  it("accepts legacy banner shape via preprocess", () => {
    const parsed = globalsSchema.parse({
      ...baseGlobals,
      banner: {
        enabled: true,
        text: "Frete grátis",
        linkUrl: null,
        bgColor: "rosa",
        dismissible: true,
      },
    });
    expect(parsed.banner.contentHtml).toBe("<p>Frete grátis</p>");
    expect(parsed.banner.bgHex).toBe("#ED7396");
    expect(parsed.banner.textHex).toBe("#FFFFFF");
    expect(parsed.banner.contentVersion).toHaveLength(12);
  });

  it("rejects invalid hex in bgHex", () => {
    expect(() =>
      globalsSchema.parse({
        ...baseGlobals,
        banner: {
          enabled: true,
          contentHtml: "<p>x</p>",
          bgHex: "rosa",   // <- inválido depois da migração não-feita
          textHex: "#FFFFFF",
          dismissible: true,
          contentVersion: "abc123def456",
        },
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 6: Correr os testes**

```bash
npm test -- --run src/lib/legacy-banner.test.ts
```

Expected: PASS (≈21 testes).

- [ ] **Step 7: Tentar build — pode falhar em `Header.astro`/`GlobalsEditor.tsx`/seed por causa do shape antigo**

```bash
npm run build
```

Falhas esperadas: ficheiros que ainda referenciam `banner.text`, `banner.linkUrl`, `banner.bgColor` — serão corrigidos em Tasks 9 e 10. Anotar os ficheiros que falharam.

Se o seed (`src/db/seed.ts` ou similar) referenciar campos antigos, corrigir já neste step (substituir pelo novo shape) — caso contrário tasks futuras não conseguirão construir. Comando rápido:

```bash
grep -rn "banner\.\(text\|linkUrl\|bgColor\)" /Users/ricardosilva/projects/auto-generated-theme/src
```

Para cada ficheiro encontrado: ou esperar até à task específica (Header → Task 9, GlobalsEditor → Task 10) ou actualizar inline se não estiver em nenhuma task subsequente.

- [ ] **Step 8: Commit**

```bash
git add src/lib/config.ts src/lib/legacy-banner.test.ts
git commit -m "feat(banner): wire legacyBannerMigration em globalsSchema com preprocess"
```

---

## Task 4: Sanitização — `sanitizeAnnouncement` + style hook

**Files:**
- Modify: `src/lib/sanitize.ts`
- Modify: `src/lib/sanitize.test.ts`

- [ ] **Step 1: Escrever os testes para `sanitizeAnnouncement`**

Adicionar a `src/lib/sanitize.test.ts`:

```ts
import { sanitizeAnnouncement } from "./sanitize";

describe("sanitizeAnnouncement", () => {
  it("preserves safe inline tags", () => {
    const out = sanitizeAnnouncement("<p><strong>oi</strong> <em>x</em> <u>y</u></p>");
    expect(out).toContain("<strong>oi</strong>");
    expect(out).toContain("<em>x</em>");
    expect(out).toContain("<u>y</u>");
  });

  it("preserves <a href> with safe URL", () => {
    const out = sanitizeAnnouncement('<p><a href="/catalogo">x</a></p>');
    expect(out).toContain('<a href="/catalogo">');
  });

  it('preserves <span style="color: #ED7396">', () => {
    const out = sanitizeAnnouncement('<p><span style="color: #ED7396">x</span></p>');
    expect(out).toContain("color");
    expect(out).toContain("ED7396");
  });

  it("strips <script>", () => {
    const out = sanitizeAnnouncement('<p>oi</p><script>alert(1)</script>');
    expect(out).not.toContain("<script>");
    expect(out).not.toContain("alert");
  });

  it("strips <iframe> and <style>", () => {
    const out = sanitizeAnnouncement('<p>oi</p><iframe src="x"></iframe><style>x</style>');
    expect(out).not.toContain("<iframe");
    expect(out).not.toContain("<style");
  });

  it("strips <h1>, <ul>, <li>, <img>", () => {
    const out = sanitizeAnnouncement('<h1>x</h1><ul><li>y</li></ul><img src="x">');
    expect(out).not.toContain("<h1");
    expect(out).not.toContain("<ul");
    expect(out).not.toContain("<li");
    expect(out).not.toContain("<img");
  });

  it("strips javascript: in href", () => {
    const out = sanitizeAnnouncement('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toContain("javascript:");
  });

  it("strips data: in href", () => {
    const out = sanitizeAnnouncement('<a href="data:text/html,x">x</a>');
    expect(out).not.toContain("data:text");
  });

  it("rejects style with non-color properties", () => {
    const out = sanitizeAnnouncement('<span style="display: none">x</span>');
    expect(out).not.toContain("display");
  });

  it('rejects style="font-size:100px"', () => {
    const out = sanitizeAnnouncement('<span style="font-size:100px">x</span>');
    expect(out).not.toContain("font-size");
  });

  it("rejects composed style with color + other (background not allowed)", () => {
    const out = sanitizeAnnouncement('<span style="color: red; background: blue">x</span>');
    expect(out).not.toContain("background");
  });

  it('accepts style="color: red"', () => {
    const out = sanitizeAnnouncement('<span style="color: red">x</span>');
    expect(out).toContain("color");
    expect(out).toContain("red");
  });

  it('accepts style="color: rgb(255, 0, 0)"', () => {
    const out = sanitizeAnnouncement('<span style="color: rgb(255, 0, 0)">x</span>');
    expect(out).toContain("color");
    expect(out).toMatch(/rgb\(\s*255\s*,/);
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeAnnouncement("")).toBe("");
  });
});

describe("sanitizeHtml is unaffected by the announcement scope flag", () => {
  it('still accepts <span style="color: red"> in product descriptions', () => {
    const out = sanitizeHtml('<span style="color: red">x</span>');
    expect(out).toContain("color");
  });

  it("still accepts <h1> in product descriptions", () => {
    const out = sanitizeHtml("<h1>x</h1>");
    expect(out).toContain("<h1");
  });

  it("still accepts <span style=\"font-size:12px\"> in product descriptions (hook scoped)", () => {
    const out = sanitizeHtml('<span style="font-size:12px">x</span>');
    expect(out).toContain("font-size");
  });
});
```

- [ ] **Step 2: Correr o teste e ver falhar**

```bash
npm test -- --run src/lib/sanitize.test.ts
```

Expected: FAIL — `sanitizeAnnouncement is not defined`.

- [ ] **Step 3: Reescrever `src/lib/sanitize.ts` com `sanitizeAnnouncement` + hook escopado**

Substituir o conteúdo de `src/lib/sanitize.ts` por:

```ts
import DOMPurify from "isomorphic-dompurify";

// sanitizeHtml: tolerant allowlist for product descriptions and TextBlock content.
const ALLOWED_TAGS = [
  "p", "br", "span", "div",
  "b", "strong", "i", "em", "u", "s", "del",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "blockquote", "pre", "code",
  "a", "hr",
];
const ALLOWED_ATTR = ["href", "target", "rel", "style", "class"];

// sanitizeAnnouncement: tight allowlist for the announcement bar (one-line content).
const ALLOWED_TAGS_ANNOUNCEMENT = ["p", "br", "strong", "em", "u", "a", "span"];
const ALLOWED_ATTR_ANNOUNCEMENT = ["href", "target", "rel", "style"];

// Scope flag: the style hook only filters when called via sanitizeAnnouncement.
// This guarantees product descriptions are not affected even if they contain
// non-color inline styles (audit performed before this change — see commit log).
let sanitizingAnnouncement = false;
let hookRegistered = false;

const COLOR_ONLY_STYLE_RE =
  /^\s*color\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)|[a-zA-Z]+)\s*;?\s*$/;

function registerStyleHook() {
  if (hookRegistered) return;
  DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
    if (!sanitizingAnnouncement) return;
    if (data.attrName !== "style") return;
    const value = data.attrValue ?? "";
    if (!COLOR_ONLY_STYLE_RE.test(value)) {
      data.keepAttr = false;
    }
  });
  hookRegistered = true;
}

export function sanitizeHtml(input: string): string {
  if (!input) return "";
  registerStyleHook();
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    KEEP_CONTENT: true,
  });
}

export function sanitizeAnnouncement(input: string): string {
  if (!input) return "";
  registerStyleHook();
  sanitizingAnnouncement = true;
  try {
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: ALLOWED_TAGS_ANNOUNCEMENT,
      ALLOWED_ATTR: ALLOWED_ATTR_ANNOUNCEMENT,
      ALLOW_DATA_ATTR: false,
      KEEP_CONTENT: true,
      ALLOWED_URI_REGEXP: /^(https?:|mailto:|\/)/i,
    });
  } finally {
    sanitizingAnnouncement = false;
  }
}

export function isEmptyHtml(input: string): boolean {
  if (!input) return true;
  const stripped = input
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
  return stripped.length === 0;
}
```

**Notas de design:**
- O flag `sanitizingAnnouncement` é module-scope. JS é single-threaded → seguro em Astro SSR.
- O `try`/`finally` garante reset se DOMPurify lançar.
- O hook é registado uma única vez (`hookRegistered`) para evitar leak em hot-reload do dev server.

- [ ] **Step 4: Correr os testes e ver passar**

```bash
npm test -- --run src/lib/sanitize.test.ts
```

Expected: PASS (todos os 14 novos + 8 antigos = 22).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sanitize.ts src/lib/sanitize.test.ts
git commit -m "feat(banner): sanitizeAnnouncement com allowlist apertada + style-color hook"
```

---

## Task 5: RichTextEditor — prop `mode`

**Files:**
- Modify: `src/components/admin/RichTextEditor.tsx`
- Create: `src/components/admin/RichTextEditor.test.tsx`

- [ ] **Step 1: Criar `src/components/admin/RichTextEditor.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RichTextEditor } from "./RichTextEditor";

describe("RichTextEditor — full mode (default)", () => {
  it("renders heading, list, alignment toolbar buttons", async () => {
    render(<RichTextEditor value="" onChange={() => {}} />);
    expect(await screen.findByTitle("Título 2")).toBeInTheDocument();
    expect(screen.getByTitle("Título 3")).toBeInTheDocument();
    expect(screen.getByTitle("Lista")).toBeInTheDocument();
    expect(screen.getByTitle("Lista numerada")).toBeInTheDocument();
    expect(screen.getByTitle("Citação")).toBeInTheDocument();
    expect(screen.getByTitle("Alinhar à esquerda")).toBeInTheDocument();
  });
});

describe("RichTextEditor — inline mode", () => {
  it("renders B / I / U / link toolbar buttons", async () => {
    render(<RichTextEditor mode="inline" value="" onChange={() => {}} />);
    expect(await screen.findByTitle("Negrito")).toBeInTheDocument();
    expect(screen.getByTitle("Itálico")).toBeInTheDocument();
    expect(screen.getByTitle("Sublinhado")).toBeInTheDocument();
    expect(screen.getByTitle("Link")).toBeInTheDocument();
  });

  it("does NOT render heading, list, blockquote, or alignment buttons", async () => {
    render(<RichTextEditor mode="inline" value="" onChange={() => {}} />);
    await screen.findByTitle("Negrito"); // ensures editor mounted
    expect(screen.queryByTitle("Título 2")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Título 3")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Lista")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Lista numerada")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Citação")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Alinhar à esquerda")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Centrar")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr o teste e ver falhar**

```bash
npm test -- --run src/components/admin/RichTextEditor.test.tsx
```

Expected: FAIL — modo `"inline"` ainda mostra todos os botões.

- [ ] **Step 3: Adicionar a prop `mode` e configurar extensões**

Em `src/components/admin/RichTextEditor.tsx`:

1. Actualizar o type `RichTextEditorProps`:

```ts
type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  mode?: "full" | "inline";
};
```

2. Actualizar a função `RichTextEditor`:

```ts
export function RichTextEditor({
  value,
  onChange,
  minHeight = 200,
  mode = "full",
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions:
      mode === "inline"
        ? [
            StarterKit.configure({
              heading: false,
              bulletList: false,
              orderedList: false,
              listItem: false,
              blockquote: false,
              codeBlock: false,
              code: false,
              horizontalRule: false,
              strike: false,
            }),
            Underline,
            TextStyle,
            Color,
            Link.configure({
              openOnClick: false,
              autolink: true,
              HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
            }),
          ]
        : [
            StarterKit,
            Underline,
            TextStyle,
            Color,
            Link.configure({
              openOnClick: false,
              autolink: true,
              HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
            }),
            TextAlign.configure({ types: ["heading", "paragraph"] }),
          ],
    content: value || "",
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none",
        style: `min-height: ${minHeight}px`,
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current && (value || current !== "<p></p>")) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) {
    return (
      <div
        className="rounded-2xl border border-ink-line bg-white px-4 py-3 text-sm text-ink-muted"
        style={{ minHeight }}
      >
        A carregar editor…
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-line bg-white">
      <Toolbar editor={editor} inline={mode === "inline"} />
      <div className="px-4 py-3">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
```

3. Actualizar a `Toolbar` (substituir a função inteira):

```tsx
function Toolbar({ editor, inline = false }: { editor: Editor; inline?: boolean }) {
  const setLink = useCallback(() => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL do link", previous ?? "");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  const setColor = (color: string) => {
    editor.chain().focus().setColor(color).run();
  };
  const unsetColor = () => {
    editor.chain().focus().unsetColor().run();
  };

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-ink-line bg-ink-surface/40 px-2 py-2">
      <ToolbarButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrito">
        <span className="font-bold">B</span>
      </ToolbarButton>
      <ToolbarButton active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Itálico">
        <span className="italic">I</span>
      </ToolbarButton>
      <ToolbarButton active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Sublinhado">
        <span className="underline">U</span>
      </ToolbarButton>
      {!inline && (
        <ToolbarButton active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="Rasurado">
          <span className="line-through">S</span>
        </ToolbarButton>
      )}

      {!inline && (
        <>
          <Divider />
          <ToolbarButton active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Título 2">H2</ToolbarButton>
          <ToolbarButton active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Título 3">H3</ToolbarButton>
          <Divider />
          <ToolbarButton active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista">•</ToolbarButton>
          <ToolbarButton active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada">1.</ToolbarButton>
          <ToolbarButton active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Citação">❝</ToolbarButton>
          <Divider />
          <ToolbarButton active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} title="Alinhar à esquerda">⬅</ToolbarButton>
          <ToolbarButton active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="Centrar">≡</ToolbarButton>
          <ToolbarButton active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} title="Alinhar à direita">➡</ToolbarButton>
        </>
      )}

      <Divider />

      <ToolbarButton active={editor.isActive("link")} onClick={setLink} title="Link">🔗</ToolbarButton>

      <Divider />

      <ColorMenu
        onPick={setColor}
        onClear={unsetColor}
        current={editor.getAttributes("textStyle").color as string | undefined}
      />

      <Divider />

      <ToolbarButton onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} title="Limpar formatação">⨯</ToolbarButton>
    </div>
  );
}
```

- [ ] **Step 4: Correr os testes e ver passar**

```bash
npm test -- --run src/components/admin/RichTextEditor.test.tsx
```

Expected: PASS (4 testes).

- [ ] **Step 5: Correr a suite inteira**

```bash
npm test -- --run
```

Expected: zero regressões nos call-sites existentes (`ProductForm`, `BlockForm`, `GlobalsEditor.Textarea`).

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/RichTextEditor.tsx src/components/admin/RichTextEditor.test.tsx
git commit -m "feat(richtext): prop mode='inline' com toolbar reduzida e extensions filtradas"
```

---

## Task 6: ColorPicker — prop `presets`

**Files:**
- Modify: `src/components/admin/ColorPicker.tsx`

- [ ] **Step 1: Substituir o conteúdo de `src/components/admin/ColorPicker.tsx`**

```tsx
import { deriveScale, isValidHex, SHADE_KEYS } from "../../lib/theme-colors";

interface Preset {
  label: string;
  hex: string;
}

interface Props {
  label: string;
  value: string;
  onChange: (next: string) => void;
  showScale?: boolean;
  presets?: Preset[];
}

export default function ColorPicker({
  label,
  value,
  onChange,
  showScale = true,
  presets,
}: Props) {
  const valid = isValidHex(value);
  const scale = valid ? deriveScale(value) : null;
  const valueLower = value.toLowerCase();

  return (
    <div>
      <label className="field-label">{label}</label>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="color"
          value={valid ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded border border-ink-line"
          aria-label={`${label} — color picker`}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          className="field-input flex-1 uppercase"
          placeholder="#F691B4"
        />
      </div>
      {!valid && <p className="mt-1 text-xs text-red-600">Hex inválido</p>}
      {presets && presets.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {presets.map((p) => {
            const isActive = valid && p.hex.toLowerCase() === valueLower;
            return (
              <button
                key={`${p.hex}-${p.label}`}
                type="button"
                onClick={() => onChange(p.hex)}
                title={`${p.label} (${p.hex})`}
                aria-label={`Aplicar cor ${p.label} (${p.hex})`}
                className={`h-6 w-6 rounded-full border transition ${
                  isActive
                    ? "border-ink ring-2 ring-ink"
                    : "border-ink-line hover:border-ink-soft"
                }`}
                style={{ backgroundColor: p.hex }}
              />
            );
          })}
        </div>
      )}
      {showScale && scale && (
        <div className="mt-2 flex gap-1">
          {SHADE_KEYS.map((k) => (
            <div
              key={k}
              className="h-6 flex-1 rounded"
              style={{ backgroundColor: scale[k] }}
              title={`${k}: ${scale[k]}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Confirmar build**

```bash
npm run build
```

Expected: build succeeds (a prop é opcional → zero impacto em ColorPicker existentes em `ThemeEditor`).

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/ColorPicker.tsx
git commit -m "feat(colorpicker): prop opcional presets com fila de swatches clicáveis"
```

---

## Task 7: AnnouncementDismissButton (React island)

**Files:**
- Create: `src/components/islands/AnnouncementDismissButton.tsx`
- Create: `src/components/islands/AnnouncementDismissButton.test.tsx`

- [ ] **Step 1: Escrever os testes**

`src/components/islands/AnnouncementDismissButton.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AnnouncementDismissButton from "./AnnouncementDismissButton";

beforeEach(() => {
  localStorage.clear();
});

describe("AnnouncementDismissButton", () => {
  it("renders a button when not dismissed", () => {
    render(<AnnouncementDismissButton version="v1" />);
    expect(screen.getByRole("button", { name: /fechar aviso/i })).toBeInTheDocument();
  });

  it("does NOT render when localStorage already has the key", () => {
    localStorage.setItem("drisclub-banner-dismissed-v1", "1");
    render(<AnnouncementDismissButton version="v1" />);
    expect(screen.queryByRole("button", { name: /fechar aviso/i })).not.toBeInTheDocument();
  });

  it("sets the localStorage key on click", async () => {
    const user = userEvent.setup();
    render(<AnnouncementDismissButton version="v1" />);
    await user.click(screen.getByRole("button", { name: /fechar aviso/i }));
    expect(localStorage.getItem("drisclub-banner-dismissed-v1")).toBe("1");
  });

  it("hides the surrounding [data-announcement-version] element when clicked", async () => {
    const user = userEvent.setup();
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-announcement-version", "v1");
    document.body.appendChild(wrapper);
    try {
      render(<AnnouncementDismissButton version="v1" />, { container: wrapper });
      await user.click(screen.getByRole("button", { name: /fechar aviso/i }));
      expect(wrapper.style.display).toBe("none");
    } finally {
      wrapper.remove();
    }
  });

  it("uses a different localStorage key for different versions", async () => {
    const user = userEvent.setup();
    render(<AnnouncementDismissButton version="v1" />);
    await user.click(screen.getByRole("button", { name: /fechar aviso/i }));
    expect(localStorage.getItem("drisclub-banner-dismissed-v1")).toBe("1");
    expect(localStorage.getItem("drisclub-banner-dismissed-v2")).toBeNull();
  });
});
```

- [ ] **Step 2: Correr o teste e ver falhar**

```bash
npm test -- --run src/components/islands/AnnouncementDismissButton.test.tsx
```

Expected: FAIL — `Cannot find module './AnnouncementDismissButton'`.

- [ ] **Step 3: Implementar `AnnouncementDismissButton`**

`src/components/islands/AnnouncementDismissButton.tsx`:

```tsx
import { useEffect, useState } from "react";

interface Props {
  version: string;
}

export default function AnnouncementDismissButton({ version }: Props) {
  const storageKey = `drisclub-banner-dismissed-${version}`;
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(storageKey) === "1";
  });

  useEffect(() => {
    if (!dismissed) return;
    const el = document.querySelector(
      `[data-announcement-version="${CSS.escape(version)}"]`,
    );
    if (el instanceof HTMLElement) el.style.display = "none";
  }, [dismissed, version]);

  if (dismissed) return null;

  return (
    <button
      type="button"
      onClick={() => {
        localStorage.setItem(storageKey, "1");
        setDismissed(true);
      }}
      aria-label="Fechar aviso"
      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:opacity-70"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
}
```

- [ ] **Step 4: Correr o teste e ver passar**

```bash
npm test -- --run src/components/islands/AnnouncementDismissButton.test.tsx
```

Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add src/components/islands/AnnouncementDismissButton.tsx src/components/islands/AnnouncementDismissButton.test.tsx
git commit -m "feat(banner): botão de fechar versionado em localStorage por contentVersion"
```

---

## Task 8: AnnouncementBar helper + Astro component

**Files:**
- Create: `src/lib/announcement-bar.ts`
- Create: `src/lib/announcement-bar.test.ts`
- Create: `src/components/AnnouncementBar.astro`

- [ ] **Step 1: Escrever os testes do helper**

`src/lib/announcement-bar.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getAnnouncementRender } from "./announcement-bar";
import type { Globals } from "./config";

function makeBanner(overrides: Partial<Globals["banner"]> = {}): Globals["banner"] {
  return {
    enabled: true,
    contentHtml: "<p>oi</p>",
    bgHex: "#ED7396",
    textHex: "#FFFFFF",
    dismissible: true,
    contentVersion: "abc123def456",
    ...overrides,
  };
}

describe("getAnnouncementRender", () => {
  it("returns shouldRender=false when enabled=false", () => {
    expect(getAnnouncementRender(makeBanner({ enabled: false })).shouldRender).toBe(false);
  });

  it("returns shouldRender=false when contentHtml is empty", () => {
    expect(getAnnouncementRender(makeBanner({ contentHtml: "" })).shouldRender).toBe(false);
  });

  it("returns shouldRender=false when contentHtml is only empty tags", () => {
    expect(getAnnouncementRender(makeBanner({ contentHtml: "<p></p>" })).shouldRender).toBe(false);
    expect(getAnnouncementRender(makeBanner({ contentHtml: "<p><br></p>" })).shouldRender).toBe(false);
  });

  it("returns shouldRender=true with sanitized HTML when valid", () => {
    const out = getAnnouncementRender(makeBanner({ contentHtml: "<p>oi</p>" }));
    expect(out.shouldRender).toBe(true);
    expect(out.safeHtml).toContain("oi");
  });

  it("strips <script> from contentHtml in safeHtml", () => {
    const out = getAnnouncementRender(
      makeBanner({ contentHtml: "<p>oi</p><script>alert(1)</script>" }),
    );
    expect(out.safeHtml).not.toContain("<script>");
    expect(out.safeHtml).toContain("oi");
  });

  it("returns inline style string with bgHex and textHex", () => {
    const out = getAnnouncementRender(
      makeBanner({ bgHex: "#FF0000", textHex: "#FFFFFF" }),
    );
    expect(out.style).toBe("background:#FF0000;color:#FFFFFF");
  });

  it("returns empty safeHtml when shouldRender is false", () => {
    const out = getAnnouncementRender(makeBanner({ enabled: false }));
    expect(out.safeHtml).toBe("");
  });
});
```

- [ ] **Step 2: Correr o teste e ver falhar**

```bash
npm test -- --run src/lib/announcement-bar.test.ts
```

Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar o helper**

`src/lib/announcement-bar.ts`:

```ts
import { sanitizeAnnouncement, isEmptyHtml } from "./sanitize";
import type { Globals } from "./config";

export interface AnnouncementRender {
  shouldRender: boolean;
  safeHtml: string;
  style: string;
}

export function getAnnouncementRender(banner: Globals["banner"]): AnnouncementRender {
  const shouldRender = banner.enabled && !isEmptyHtml(banner.contentHtml);
  return {
    shouldRender,
    safeHtml: shouldRender ? sanitizeAnnouncement(banner.contentHtml) : "",
    style: `background:${banner.bgHex};color:${banner.textHex}`,
  };
}
```

- [ ] **Step 4: Correr o teste e ver passar**

```bash
npm test -- --run src/lib/announcement-bar.test.ts
```

Expected: PASS (7 testes).

- [ ] **Step 5: Criar `src/components/AnnouncementBar.astro`**

```astro
---
import AnnouncementDismissButton from "./islands/AnnouncementDismissButton.tsx";
import { getAnnouncementRender } from "../lib/announcement-bar";
import type { SiteConfig } from "../lib/config";

interface Props {
  config: SiteConfig;
}

const { config } = Astro.props;
const { banner } = config.globals;
const { shouldRender, safeHtml, style } = getAnnouncementRender(banner);
---

{shouldRender && (
  <div
    class="relative text-xs px-4 py-2 text-center [&_a]:underline [&_a]:underline-offset-2"
    style={style}
    data-announcement-version={banner.contentVersion}
    role="region"
    aria-label="Aviso da loja"
  >
    <div class="mx-auto max-w-screen-lg" set:html={safeHtml} />
    {banner.dismissible && (
      <AnnouncementDismissButton client:load version={banner.contentVersion} />
    )}
  </div>
)}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/announcement-bar.ts src/lib/announcement-bar.test.ts src/components/AnnouncementBar.astro
git commit -m "feat(banner): AnnouncementBar.astro + helper puro getAnnouncementRender"
```

---

## Task 9: Wire AnnouncementBar em BaseLayout + remover do Header

**Files:**
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/components/Header.astro`

- [ ] **Step 1: Adicionar import e elemento em `BaseLayout.astro`**

Em `src/layouts/BaseLayout.astro`:

1. Após `import Header from "../components/Header.astro";` (linha 3):

```ts
import AnnouncementBar from "../components/AnnouncementBar.astro";
```

2. No `<body>` (linha 89-90), substituir:

```astro
<body class="flex min-h-dvh flex-col overflow-x-clip bg-white text-ink antialiased">
  <Header config={config} />
```

por:

```astro
<body class="flex min-h-dvh flex-col overflow-x-clip bg-white text-ink antialiased">
  <AnnouncementBar config={config} />
  <Header config={config} />
```

- [ ] **Step 2: Remover o bloco do banner em `Header.astro`**

Em `src/components/Header.astro`:

1. Linha 10: remover `banner` da desestruturação:

```diff
- const { identity, nav, banner } = config.globals;
+ const { identity, nav } = config.globals;
```

2. Linha 19: remover a linha `bannerBg`:

```diff
- const bannerBg = banner.bgColor === "rosa" ? "bg-rosa-400 text-white" : "bg-ink text-white";
```

3. Linhas 22-30: remover o bloco JSX do banner:

```diff
- {banner.enabled && banner.text && (
-   <div class={`${bannerBg} text-center text-xs font-medium px-4 py-2`}>
-     {banner.linkUrl ? (
-       <a href={banner.linkUrl} class="underline underline-offset-2">{banner.text}</a>
-     ) : (
-       <span>{banner.text}</span>
-     )}
-   </div>
- )}
-
  <header class="sticky top-0 z-40 border-b border-ink-line bg-white/95 backdrop-blur">
```

- [ ] **Step 3: Confirmar build**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Smoke test manual no dev server**

```bash
npm run dev
```

Visitar `http://localhost:3000/` — confirmar que:
- A página carrega sem erros.
- Nenhuma barra aparece (default `enabled=false` — confirmar no admin).

Se a DB local ainda tiver shape antigo: o `legacyBannerMigration` deve convertê-lo on-the-fly e o storefront renderiza com base no novo shape. Verificar inspect element para `<div data-announcement-version="...">` quando `enabled=true`.

(Step não bloqueia commit; é sanity check.)

- [ ] **Step 5: Commit**

```bash
git add src/layouts/BaseLayout.astro src/components/Header.astro
git commit -m "feat(banner): renderiza AnnouncementBar via BaseLayout, remove banner do Header"
```

---

## Task 10: Reescrever BannerForm em `GlobalsEditor.tsx`

**Files:**
- Modify: `src/components/admin/GlobalsEditor.tsx`

- [ ] **Step 1: Adicionar imports**

No topo de `src/components/admin/GlobalsEditor.tsx`, após os imports existentes:

```ts
import ColorPicker from "./ColorPicker";
import { hashContentAsync } from "../../lib/legacy-banner";
import { sanitizeAnnouncement } from "../../lib/sanitize";
```

- [ ] **Step 2: Substituir a função `BannerForm` (linhas 251-285)**

```tsx
function BannerForm({ config, setGlobals }: FormProps) {
  const { banner } = config.globals;
  const patch = (p: Partial<Globals["banner"]>) =>
    setGlobals({ banner: { ...banner, ...p } });

  const brandingPresets = useMemo(() => {
    const presets: Array<{ label: string; hex: string }> = [
      { label: "Primária", hex: config.theme.colors.primary },
      { label: "Neutra", hex: config.theme.colors.neutral },
    ];
    if (config.theme.colors.accent) {
      presets.push({ label: "Destaque", hex: config.theme.colors.accent });
    }
    presets.push({ label: "Branco", hex: "#FFFFFF" }, { label: "Preto", hex: "#111111" });
    return presets;
  }, [
    config.theme.colors.primary,
    config.theme.colors.neutral,
    config.theme.colors.accent,
  ]);

  const handleContentChange = (html: string) => {
    patch({ contentHtml: html });
    // Recompute contentVersion async; server re-hashes defensively on save.
    void hashContentAsync(html).then((v) => patch({ contentVersion: v }));
  };

  const previewHtml = useMemo(
    () => sanitizeAnnouncement(banner.contentHtml),
    [banner.contentHtml],
  );

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-ink">Barra de anúncio</h3>

      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          checked={banner.enabled}
          onChange={(e) => patch({ enabled: e.target.checked })}
        />
        Mostrar barra
      </label>

      <div>
        <label className="field-label">Conteúdo</label>
        <div className="mt-1">
          <RichTextEditor
            mode="inline"
            value={banner.contentHtml}
            onChange={handleContentChange}
            minHeight={56}
            placeholder="Frete grátis ≥ €20 · Ver coleção…"
          />
        </div>
        <p className="mt-1 text-xs text-ink-muted">
          Apenas negrito, itálico, sublinhado, cor e links são suportados.
        </p>
      </div>

      <ColorPicker
        label="Cor de fundo"
        value={banner.bgHex}
        onChange={(bgHex) => patch({ bgHex })}
        showScale={false}
        presets={brandingPresets}
      />

      <ColorPicker
        label="Cor de texto"
        value={banner.textHex}
        onChange={(textHex) => patch({ textHex })}
        showScale={false}
        presets={brandingPresets}
      />

      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          checked={banner.dismissible}
          onChange={(e) => patch({ dismissible: e.target.checked })}
        />
        Permitir fechar (reaparece quando o conteúdo mudar)
      </label>

      <div>
        <label className="field-label">Pré-visualização</label>
        <div
          className="mt-1 rounded-lg border border-ink-line px-4 py-2 text-center text-xs [&_a]:underline [&_a]:underline-offset-2"
          style={{ background: banner.bgHex, color: banner.textHex }}
          dangerouslySetInnerHTML={{ __html: previewHtml || "&nbsp;" }}
        />
        <p className="mt-1 text-xs text-ink-muted">
          Assim aparece na loja (sem o botão de fechar).
        </p>
      </div>
    </div>
  );
}
```

**Nota:** o `useMemo` já está importado de `react` no topo do ficheiro (linha 1). Confirmar.

- [ ] **Step 3: Confirmar build**

```bash
npm run build
```

Expected: success.

- [ ] **Step 4: Smoke test manual no admin**

```bash
npm run dev
```

1. Login em `/admin/login`.
2. `/admin/globals` → tab "Banner". Confirmar:
   - Checkbox "Mostrar barra".
   - `RichTextEditor` em modo inline (toolbar reduzida: B/I/U/🔗/cores; sem H2/H3/listas/alinhamento).
   - Dois `ColorPicker`s (Cor de fundo + Cor de texto) com swatches `brandingPresets` por baixo.
   - Checkbox "Permitir fechar".
   - Bloco de pré-visualização em baixo.
3. Alterar texto → escolher preset "Preto" para cor de fundo → guardar → visitar `/` → confirmar barra com o conteúdo correcto, fundo preto, e que `data-announcement-version` no DOM reflecte o novo hash.

(Step não bloqueia commit.)

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/GlobalsEditor.tsx
git commit -m "feat(banner): novo BannerForm com RichTextEditor inline, ColorPickers e preview"
```

---

## Task 11: API — re-hash defensivo no `PUT /api/admin/site-config`

**Files:**
- Modify: `src/pages/api/admin/site-config.ts`

- [ ] **Step 1: Adicionar import**

Em `src/pages/api/admin/site-config.ts`, após os imports existentes:

```ts
import { hashContentSync } from "../../../lib/legacy-banner";
```

- [ ] **Step 2: Re-hashar `contentVersion` antes do `db.update`**

Depois do `safeParse` e antes do `db.update` (entre as linhas actuais ~32 e ~34):

```ts
const parsed = siteConfigSchema.safeParse(body);
if (!parsed.success) {
  return new Response(
    JSON.stringify({ error: "Validação falhou", issues: parsed.error.issues }),
    { status: 400, headers: { "Content-Type": "application/json" } },
  );
}

// Defensively recompute contentVersion server-side. The admin client hashes
// async on every onChange, but the server is the source of truth — never
// trust client-supplied hashes for storage keys.
parsed.data.globals.banner.contentVersion = hashContentSync(
  parsed.data.globals.banner.contentHtml,
);

await db
  .update(schema.siteConfig)
  .set({
    theme: parsed.data.theme,
    globals: parsed.data.globals,
    updatedAt: new Date(),
  })
  .where(eq(schema.siteConfig.id, 1));
```

- [ ] **Step 3: Confirmar build**

```bash
npm run build
```

Expected: success.

- [ ] **Step 4: Smoke test rápido**

Com `npm run dev`:
1. Editar banner em `/admin/globals` → guardar.
2. `GET /api/admin/site-config` → confirmar que `globals.banner.contentVersion` é um string de 12 chars base64url e que corresponde a `hashContentSync(contentHtml)`.

(Step não bloqueia commit.)

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/admin/site-config.ts
git commit -m "feat(banner): re-hash defensivo de contentVersion server-side em PUT /api/admin/site-config"
```

---

## Task 12: Migration script — reescrever shape em produção

**Files:**
- Create: `scripts/migrate-banner-shape.ts`

- [ ] **Step 1: Escrever o script**

`scripts/migrate-banner-shape.ts`:

```ts
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";
import { legacyBannerMigration, hashContentSync } from "../src/lib/legacy-banner";

const url = process.env.DATABASE_URL ?? process.env.DATABASE_PUBLIC_URL;
if (!url) {
  console.error("DATABASE_URL não configurado");
  process.exit(1);
}

const client = postgres(url, { max: 1, prepare: false });
const db = drizzle(client, { schema });

async function main() {
  console.log("A inspeccionar shape do banner em site_config...");
  const [row] = await db
    .select()
    .from(schema.siteConfig)
    .where(eq(schema.siteConfig.id, 1));

  if (!row) {
    console.log("site_config singleton ausente; nada a migrar.");
    return;
  }

  const globals = row.globals as Record<string, unknown>;
  const banner = globals?.banner as Record<string, unknown> | undefined;

  if (!banner) {
    console.log("globals.banner ausente; nada a migrar.");
    return;
  }

  if (typeof banner.contentHtml === "string") {
    console.log("Shape novo já em uso (contentHtml presente). Skip.");
    return;
  }

  if (typeof banner.text !== "string") {
    console.log(
      "Shape inesperado (sem 'text' nem 'contentHtml'). Aborta para revisão manual.",
    );
    console.log("Conteúdo encontrado:", JSON.stringify(banner));
    return;
  }

  const migrated = legacyBannerMigration(banner);
  // Re-hash defensively to ensure consistency with server expectations.
  migrated.contentVersion = hashContentSync(migrated.contentHtml);

  const newGlobals = { ...globals, banner: migrated };

  await db
    .update(schema.siteConfig)
    .set({ globals: newGlobals, updatedAt: new Date() })
    .where(eq(schema.siteConfig.id, 1));

  console.log("OK — banner migrado:");
  console.log(JSON.stringify(migrated, null, 2));
}

main()
  .catch((err) => {
    console.error("Falha:", err);
    process.exit(1);
  })
  .finally(async () => {
    await client.end();
  });
```

- [ ] **Step 2: Testar localmente**

Se a DB local tiver shape antigo:

```bash
npx tsx scripts/migrate-banner-shape.ts
```

Output esperado: `OK — banner migrado: { ... }` com os campos novos.

Correr uma segunda vez para confirmar idempotência:

```bash
npx tsx scripts/migrate-banner-shape.ts
```

Output esperado: `Shape novo já em uso (contentHtml presente). Skip.`

- [ ] **Step 3: Commit**

```bash
git add scripts/migrate-banner-shape.ts
git commit -m "chore(scripts): migrate-banner-shape.ts para reescrever shape em produção"
```

---

## Task 13: Actualizar `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Localizar a secção "Site config (theme + globals)" em `CLAUDE.md`**

Começa com `**Site config (theme + globals)**:` debaixo de `## Architecture`. Termina no parágrafo antes de `**Named slots**:`.

- [ ] **Step 2: Adicionar parágrafo sobre o novo banner**

Após o parágrafo existente sobre `Site config (theme + globals)`, inserir um novo parágrafo:

```markdown
The `globals.banner` field is wrapped in a `z.preprocess(legacyBannerMigration, ...)` (`src/lib/legacy-banner.ts`) that accepts both the legacy shape (`{ text, linkUrl, bgColor: "rosa"|"ink" }`) and the new shape (`{ enabled, contentHtml, bgHex, textHex, dismissible, contentVersion }`). Storefront rendering lives in `src/components/AnnouncementBar.astro` (mounted by `BaseLayout` before `<Header>`) and uses `sanitizeAnnouncement` from `src/lib/sanitize.ts` — a tight allowlist (p/br/strong/em/u/a/span only) with a scoped `uponSanitizeAttribute` hook that accepts only `style="color: …"` and rejects everything else. The admin edits the bar at `/admin/globals → Banner` with `<RichTextEditor mode="inline">` (B / I / U / color / link toolbar) and two `<ColorPicker presets={…}>` controls that surface theme colours as one-click swatches. `contentVersion` is a 12-char SHA-256 hash of `contentHtml`, re-hashed server-side on every `PUT /api/admin/site-config`, and is used as the `localStorage` key for the dismiss button — editing the bar's content automatically un-dismisses it for all visitors.
```

- [ ] **Step 3: Localizar a regra "No HTML in admin inputs" em `## Conventions`**

Está na lista de bullets sob `## Conventions`, começa com `**No HTML in admin inputs**:`.

- [ ] **Step 4: Adicionar bullet sobre o modo inline**

Após o bullet `**No HTML in admin inputs**` e antes do bullet `**Image fields use `ImagePicker`**`, inserir:

```markdown
- **TipTap inline mode**: `RichTextEditor` accepts an optional `mode="inline"` (default `"full"`) that strips heading/list/blockquote/alignment from both the toolbar and the editor extensions. Use this in single-line surfaces like the announcement bar where block-level formatting doesn't apply.
```

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: documentar novo shape do banner e modo inline do RichTextEditor"
```

---

## Task 14: Verificação final + manual smoke test

- [ ] **Step 1: Correr a suite inteira de testes**

```bash
npm test -- --run
```

Expected: todos os testes PASS (os 141+ anteriores + os novos: 10 do legacy-banner, 14 do sanitize, 4 do RichTextEditor, 5 do AnnouncementDismissButton, 7 do announcement-bar = 40 novos).

- [ ] **Step 2: Build de produção**

```bash
npm run build
```

Expected: build succeeds sem warnings de tipos.

- [ ] **Step 3: Smoke test manual completo**

```bash
npm run dev
```

1. **Estado inicial (sem banner)**: visitar `/` — sem barra (default `enabled=false`).
2. **Admin edita**: `/admin/globals` → tab "Banner":
   - Activar "Mostrar barra".
   - No RichTextEditor escrever `Frete grátis ≥ €20 · Ver coleção`. Selecionar "Ver coleção" → 🔗 → `/catalogo`. Selecionar "Frete grátis" → **B**.
   - **Cor de fundo** → preset "Primária".
   - **Cor de texto** → preset "Branco".
   - Confirmar preview no fundo do form.
   - **Permitir fechar** → ticked.
   - Guardar.
3. **Visitar `/`**: barra aparece em cor primária, texto branco, "Frete grátis" a bold, "Ver coleção" como link clicável para `/catalogo`.
4. **Dispensar**: clicar no ✕. Barra desaparece. Refresh — não reaparece. DevTools → Application → Local Storage → confirma a chave `drisclub-banner-dismissed-<hash>` = `"1"`.
5. **Admin altera o conteúdo**: voltar a `/admin/globals` → "Banner" → mudar uma palavra. Guardar.
6. **Visitar `/`**: a barra reaparece (novo `contentVersion` → nova chave de localStorage).
7. **Mobile**: redimensionar para 360px → confirmar que o banner não overflow, quebra naturalmente se tiver 2 linhas.
8. **Sanitização**: tentar colar `<script>alert(1)</script>` no editor. Salvar. Visitar `/` → confirmar que o `<script>` não aparece no DOM (inspect element).
9. **Cores**: testar várias cores via picker e via input de texto hex. Confirmar que o preview no admin actualiza imediatamente.
10. **Cores inválidas**: tentar guardar com `bgHex="rosa"` (via DevTools no fetch) → API responde 400.

- [ ] **Step 4: Migration em produção (post-deploy via team-deployment)**

Depois do team-deployment fazer push + deploy via Railway:

```bash
railway run npx tsx scripts/migrate-banner-shape.ts
```

Output esperado: ou `Shape novo já em uso (contentHtml presente). Skip.` (se algum admin já tiver guardado depois do deploy) ou `OK — banner migrado: { ... }`. **Idempotente** — pode ser corrido várias vezes.

---

## Self-review checklist

Antes de marcar este plano como executado, confirmar:

- [ ] Cada secção da spec tem pelo menos uma task que a implementa:
  - Spec §1 (schema) → Tasks 1, 2, 3
  - Spec §1a (legacyBannerMigration) → Task 2
  - Spec §1b (hashContent) → Task 1
  - Spec §2 (TipTap inline) → Task 5
  - Spec §3 (AnnouncementBar.astro) → Task 8
  - Spec §4 (DismissButton) → Task 7
  - Spec §5 (sanitizeAnnouncement) → Task 4 (Task 0 audita produção primeiro)
  - Spec §6 (admin BannerForm) → Task 10 (preset implementation em Task 6)
  - Spec §7 (API re-hash) → Task 11 (endpoint corrigido: `PUT /api/admin/site-config`, não `PATCH /api/admin/globals`)
  - Spec §8 (migration script) → Task 12
  - Spec §9 (BaseLayout) → Task 9
- [ ] Todos os edge cases da spec têm cobertura de teste:
  - Conteúdo vazio (`<p></p>`, `<p><br></p>`) → Task 8 step 1
  - Hex inválido → Task 3 step 5
  - HTML injectado (`<script>`, `<iframe>`, `<style>`) → Task 4 step 1
  - `javascript:` / `data:` em href → Task 4 step 1
  - `style="display:none"` / outras props → Task 4 step 1
  - `<span style="color: #ED7396">` (TipTap output) → Task 4 step 1
- [ ] Não há nenhum "TBD" / "implementar depois" / "ver acima".
- [ ] Type consistency: `NewBannerShape` (Task 2) ↔ schema Zod (Task 3) ↔ tipos usados em Tasks 8/10/11 — todos com os mesmos nomes: `enabled`, `contentHtml`, `bgHex`, `textHex`, `dismissible`, `contentVersion`.
- [ ] Endpoint correcto: `PUT /api/admin/site-config` em todo o plano.
- [ ] Decisão de hook (Task 0) é referenciada em Task 4 (já implementa o escopado por flag).
- [ ] `EMPTY_CONTENT_VERSION` é exportado de `legacy-banner.ts` (Task 1) e usado em `config.ts` (Task 3) — sem duplicação.
- [ ] Snapshot do hash em Task 1 Step 5 é calculado e cravado antes do teste no Step 6.
