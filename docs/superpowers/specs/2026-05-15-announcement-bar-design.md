# Announcement bar — rich-text com links e cores editáveis

**Date:** 2026-05-15
**Status:** Approved — ready for implementation plan
**Scope:** Single feature, single implementation plan

## Problem

Hoje existe um banner muito simples por cima do header (`globals.banner`): texto plano
até 200 chars, um único `linkUrl` opcional que torna a barra inteira clicável, e dois
valores hardcoded de cor de fundo (`"rosa"` ou `"ink"`). Não permite:

1. Formatar partes do texto (negrito, itálico, sublinhado, cor diferente numa palavra).
2. Múltiplos links dentro da mesma barra (por exemplo, "Frete grátis ≥ €20 · **Ver
   coleção nova** · Contactar-nos" com 2 destinos diferentes).
3. Escolher livremente a cor da barra e a cor do texto (hoje só rosa-400 ou ink, e o
   texto é sempre branco).

## Goal

Reescrever o `globals.banner` para suportar conteúdo em **texto rico** (com o
RichTextEditor TipTap existente, em modo restrito a uma linha), **links inline
ilimitados**, **cor de fundo livre (hex)** e **cor de texto por defeito livre (hex)** —
mantendo o toggle "Mostrar/Esconder" e o "Dispensável" actuais, com a variação que
dispensar a barra reseta automaticamente sempre que o admin muda o conteúdo.

## Non-goals

- Sem agendamento (auto-on/off por datas) — não pedido.
- Sem múltiplas barras rotativas — uma barra singleton.
- Sem altura/padding/font-size editáveis pelo admin — o tamanho fica fixo
  (`text-xs px-4 py-2`, igual ao actual).
- Sem cor de hover de links — herda da `color` actual; o admin não controla.
- Sem extensões TipTap pesadas (headings, listas, blockquote, code, alinhamento) — não
  fazem sentido numa faixa de uma linha.
- Sem migração de `globals.banner` para um novo nome (`globals.announcement` ou
  semelhante). A chave fica `banner` para minimizar risco em produção; só o shape muda.

## Constraints / context

- O `RichTextEditor.tsx` actual usa TipTap (`@tiptap/react@^3.22`) com `StarterKit` +
  `Underline` + `TextStyle` + `Color` + `Link` + `TextAlign`. Output é sempre HTML via
  `editor.getHTML()`. É reutilizado em `ProductForm`, `BlockForm` e `GlobalsEditor`.
- O `ColorPicker.tsx` actual aceita hex livre via `<input type="color">` + text input,
  valida com `isValidHex`, e opcionalmente mostra escala derivada.
- A sanitização já existe em `src/lib/sanitize.ts` — `sanitizeHtml(input)` corre
  `isomorphic-dompurify` com uma allowlist generosa (h1–h6, ul/ol, blockquote, pre,
  code, a, etc.) — adequada para descrições longas de produto, demasiado permissiva para
  uma barra de anúncio.
- A renderização do banner actual vive inline no topo de `src/components/Header.astro`
  (linhas 19–30). O componente lê `config.globals.banner` directamente.
- `globals` está numa coluna `jsonb` na tabela `site_config` (singleton). Os shape são
  validados por Zod em `src/lib/config.ts:globalsSchema`. A coluna **não tem schema SQL
  rígido** — qualquer alteração do shape é feita via Zod e (se for breaking) com um
  script de migração de dados que reescreve a linha singleton.
- A cache de `getSiteConfig()` é in-process com 5min de TTL e invalidação manual ao
  guardar; depois de aplicar a migração, a cache é invalidada (já acontece via
  `invalidate()` em `config-server.ts`).
- Convenção do projecto (CLAUDE.md): "No HTML in admin inputs" — refere-se a campos de
  texto raw. Um editor estruturado como TipTap, cujo output é sempre passado pelo
  sanitizador antes de ir para `set:html`, é o padrão aceite (já é o caso de
  `ProductLongDescription`, `TextBlock`, etc.).

## Design

### 1. Schema — `src/lib/config.ts`

Substituir o objecto `banner` actual por:

```ts
banner: z.preprocess(
  legacyBannerMigration,                        // (a) ver abaixo
  z.object({
    enabled: z.boolean(),
    contentHtml: z.string().max(4000),          // HTML serializado do TipTap inline
    bgHex: hexSchema,                           // cor de fundo
    textHex: hexSchema,                         // cor de texto por defeito
    dismissible: z.boolean(),
    contentVersion: z.string().min(1).max(16),  // hash curto do contentHtml — chave do localStorage
  }),
)
```

#### (a) `legacyBannerMigration` — preprocess de back-compat

Função pura que recebe `unknown` e devolve o shape novo. Se o input já for o shape novo,
devolve-o intacto. Se for o shape antigo (`{ text, linkUrl, bgColor, ... }`):

| Campo antigo | Campo novo | Regra |
|---|---|---|
| `text + linkUrl=null/""` | `contentHtml` | `<p>${escapeHtml(text)}</p>` |
| `text + linkUrl=set` | `contentHtml` | `<p><a href="${linkUrl}">${escapeHtml(text)}</a></p>` |
| `bgColor: "rosa"` | `bgHex` | `"#ED7396"` |
| `bgColor: "ink"` | `bgHex` | `"#111111"` |
| — (n/a) | `textHex` | `"#FFFFFF"` (estava sempre `text-white`) |
| `enabled, dismissible` | iguais | passthrough |
| — | `contentVersion` | calculado via `hashContent(contentHtml)` |

Vive em `src/lib/legacy-banner.ts` com testes em `legacy-banner.test.ts` (`escapeHtml`,
combinatórias de `linkUrl × bgColor`, idempotência: novo shape → mesmo novo shape).
`escapeHtml(s)` é implementado inline neste ficheiro como pequena utility (substitui
`<>&"'` pelas suas entities) — não há equivalente actualmente no codebase.

#### (b) `hashContent` — duas variantes

SHA-256 do HTML, encoded em base64url, truncado a 12 caracteres. Deterministic; ambas as
variantes produzem o **mesmo output** para o mesmo input.

- `hashContentSync(html: string): string` — usa `node:crypto.createHash("sha256")`.
  Server-only. É a variante chamada (i) no preprocess Zod de §1a (Zod preprocess tem
  de ser síncrono) e (ii) no endpoint `PATCH /api/admin/globals` em §7 (não precisa de
  async aí — o node tem o `createHash` síncrono).
- `hashContentAsync(html: string): Promise<string>` — usa
  `globalThis.crypto.subtle.digest("SHA-256", ...)`. Disponível em browsers e em Node
  18+. É a variante chamada no admin (`GlobalsEditor.tsx` em §6) para re-hashar o
  `contentVersion` em cada `onChange` do RichTextEditor.

Vive em `src/lib/legacy-banner.ts`. Testes:
- `hashContentSync("oi") === "<valor fixo>"` (snapshot determinista).
- `hashContentSync(x) === await hashContentAsync(x)` para várias strings.

### 2. TipTap "inline mode" — `RichTextEditor.tsx`

Adicionar prop opcional `mode?: "full" | "inline"` (default `"full"`, mantém o
comportamento actual em todos os call-sites existentes).

Em modo `"inline"`:

```ts
extensions: [
  StarterKit.configure({
    heading: false,
    bulletList: false,
    orderedList: false,
    listItem: false,
    blockquote: false,
    codeBlock: false,
    code: false,
    horizontalRule: false,
    // mantém: paragraph, bold, italic, history, hardBreak
  }),
  Underline,
  TextStyle,
  Color,                                // paleta de 7 cores como hoje
  Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } }),
  // NÃO incluir: TextAlign
]
```

Toolbar em modo `"inline"` mostra apenas:
B · I · U · cor · link · (desfazer/refazer).

A toolbar JSX já tem condicionais por extensão activa; vai precisar de uma flag
`isInlineMode` que esconde os botões de heading/lista/quote/alignment. Os testes
existentes em `RichTextEditor.test.tsx` (se existir; senão criar) cobrem os dois modos
— ver §6.

### 3. Componente storefront — `src/components/AnnouncementBar.astro`

Novo ficheiro extraído de `Header.astro`. Recebe `config: SiteConfig` como prop.

```astro
---
import { sanitizeAnnouncement, isEmptyHtml } from "../lib/sanitize";
import AnnouncementDismissButton from "./islands/AnnouncementDismissButton.tsx";
import type { SiteConfig } from "../lib/config";

interface Props { config: SiteConfig; }
const { config } = Astro.props;
const { banner } = config.globals;
const shouldRender = banner.enabled && !isEmptyHtml(banner.contentHtml);
const safeHtml = shouldRender ? sanitizeAnnouncement(banner.contentHtml) : "";
---
{shouldRender && (
  <div
    class="relative text-xs px-4 py-2 text-center [&_a]:underline [&_a]:underline-offset-2"
    style={`background:${banner.bgHex};color:${banner.textHex}`}
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

Notas:
- O `set:html` é alimentado **só** pelo sanitizador — ver §5.
- `[&_a]:underline` garante que os links inline ficam visivelmente clicáveis sem o admin
  ter de pensar nisso.
- `data-announcement-version` permite ao botão de fechar ler a versão sem prop extra
  (defensive).
- `role="region"` + `aria-label` dão semântica para leitores de ecrã.

### 4. Botão de fechar versionado — `src/components/islands/AnnouncementDismissButton.tsx`

React island, `client:load`. Recebe `version: string`.

```tsx
function AnnouncementDismissButton({ version }: { version: string }) {
  const storageKey = `drisclub-banner-dismissed-${version}`;
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(storageKey) === "1";
  });

  // Hide the surrounding [data-announcement-version=...] when dismissed.
  useEffect(() => {
    if (!dismissed) return;
    const el = document.querySelector(`[data-announcement-version="${CSS.escape(version)}"]`);
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
      class="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:opacity-70"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
    </button>
  );
}
```

Comportamento de "reset por versão":
- Cada vez que o admin edita `contentHtml`, o server recalcula `contentVersion` no
  endpoint `PATCH /api/admin/globals` (ver §7). Diferente hash → key de localStorage
  diferente → barra reaparece a quem tinha fechado antes.
- Não há cleanup automático de keys antigas (negligível — uma key de 24 bytes por
  versão; o utilizador limpa storage se quiser).

### 5. Sanitização — `src/lib/sanitize.ts`

Adicionar uma segunda função, **não** modificar a actual (a actual é usada por
`ProductLongDescription` e `TextBlock` e o seu allowlist mais largo é correcto nesses
contextos):

```ts
const ALLOWED_TAGS_ANNOUNCEMENT = ["p", "br", "strong", "em", "u", "a", "span"];
const ALLOWED_ATTR_ANNOUNCEMENT = ["href", "target", "rel", "style"];

export function sanitizeAnnouncement(input: string): string {
  if (!input) return "";
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ALLOWED_TAGS_ANNOUNCEMENT,
    ALLOWED_ATTR: ALLOWED_ATTR_ANNOUNCEMENT,
    ALLOW_DATA_ATTR: false,
    KEEP_CONTENT: true,
    ALLOWED_URI_REGEXP: /^(https?:|mailto:|\/)/i,   // sem javascript:, sem data:
  });
}
```

Hook `uponSanitizeAttribute` para `style` (registado uma vez ao carregar o módulo):
- Aceita apenas declarações `color: <css-color>` (regex
  `/^\s*color:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|[a-zA-Z]+)\s*;?\s*$/`); rejeita tudo
  o resto.
- Mantém o `style` se passar; remove o atributo se não passar (não devolve o elemento
  parent removido).

O hook é registado uma vez em `sanitize.ts` e aplica-se a ambas as funções
(`sanitizeHtml` e `sanitizeAnnouncement`) — efeito secundário aceitável: `<span style="font-size:10px">`
em `ProductLongDescription` deixa de passar. Validar se isso ocorre em dados existentes
de produto antes de aplicar; se sim, restringir o hook por contexto via uma flag
local (passada por argumento ao `sanitize` e lida dentro do hook).

### 6. Admin UI — `src/components/admin/GlobalsEditor.tsx`

Alterar o `BannerForm` actual:

- Label da tab continua `"Banner"` (interno; o utilizador vê "Banner" como hoje); o
  título do form muda para **"Barra de anúncio"** para mais clareza.
- Remove: `<Field label="Texto">`, `<Field label="Link (opcional)">`, swatches de 2
  cores fixas.
- Adiciona:
  - Checkbox "Mostrar barra" (já existia, mantém).
  - `<RichTextEditor mode="inline" value={banner.contentHtml} onChange={…} minHeight={56} placeholder="Frete grátis ≥ €20 · Ver coleção…" />`
  - `<ColorPicker label="Cor de fundo" value={banner.bgHex} onChange={…} showScale={false} presets={brandingPresets} />`
  - `<ColorPicker label="Cor de texto" value={banner.textHex} onChange={…} showScale={false} presets={brandingPresets} />`
  - Checkbox "Permitir fechar (reaparece quando o conteúdo mudar)".
  - Bloco de **preview** em baixo: um `<div>` com as cores aplicadas e
    `dangerouslySetInnerHTML={{ __html: sanitizeAnnouncement(banner.contentHtml) }}`
    + texto "Pré-visualização — assim aparece na loja". Sem botão de fechar no preview.

**Presets de branding** — fila de swatches por baixo do `ColorPicker` (extensão ao
componente; usado igual para fundo e texto):

```ts
// computado dentro do BannerForm a partir do config.theme.colors
const brandingPresets = [
  { label: "Primária", hex: config.theme.colors.primary },
  { label: "Neutra", hex: config.theme.colors.neutral },
  ...(config.theme.colors.accent ? [{ label: "Destaque", hex: config.theme.colors.accent }] : []),
  { label: "Branco", hex: "#FFFFFF" },
  { label: "Preto", hex: "#111111" },
];
```

Cada preset é um botão circular 24×24px com `background: hex`, `title="<label>"`,
`aria-label="Aplicar cor <label> (<hex>)"`. Click chama `onChange(hex)`. Mostra um anel
fino à volta do swatch actualmente seleccionado (comparação por hex case-insensitive). A
implementação vive em `ColorPicker.tsx` — nova prop opcional
`presets?: Array<{ label: string; hex: string }>`. Se omitida, o componente comporta-se
exactamente como hoje (zero impacto nos call-sites existentes em `ThemeEditor` etc.).

**Por que não hardcodar `#ED7396`/`#111111` directos**: as cores do branding podem ser
alteradas em `/admin/theme`. Ler do `config.theme.colors` garante que os presets seguem
a marca actual sem precisar de manutenção.

`patch()` actualiza `setGlobals` como hoje. O `contentVersion` é recalculado pelo
cliente em cada `onChange` do RichTextEditor via `hashContentAsync` (definida em §1b;
usa `crypto.subtle.digest`, disponível em todos os browsers modernos). O backend
re-hasha defensivamente em §7 via `hashContentSync` e usa o seu próprio valor — o
cliente não é confiável.

### 7. API — `src/pages/api/admin/globals.ts`

No `PATCH`:
- Antes de gravar, ler `body.banner.contentHtml`, recalcular `contentVersion` via
  `hashContentSync(body.banner.contentHtml)` (§1b — server-side, síncrono, usa
  `node:crypto`), sobrescrever o valor recebido do cliente.
- Persistir e invalidar cache (`invalidate()` já é chamado).

### 8. Migração de dados em produção

Não há ALTER TABLE — é uma coluna `jsonb`. O preprocess Zod (§1a) lida com leituras de
DB antiga em runtime, mas **a primeira vez que o admin guarda em `/admin/globals`** o
shape é reescrito para o formato novo. Para garantir consistência (não confiar em "vai
acontecer eventualmente"), executar um script one-off:

`scripts/migrate-banner-shape.ts` (no padrão dos `scripts/migrate-*.ts` existentes):
1. SELECT `globals` do `site_config` singleton.
2. Se `globals.banner.text` existir (sinal de shape antigo), correr o
   `legacyBannerMigration` + calcular `contentVersion`.
3. UPDATE `site_config SET globals = $1 WHERE id = 1`.
4. Log "ok" / "skip (já migrado)".

Corre uma vez em produção depois do deploy, manualmente via `railway run npm exec
tsx scripts/migrate-banner-shape.ts`.

### 9. BaseLayout — `src/layouts/BaseLayout.astro`

`Header` deixa de renderizar o banner internamente. Em vez disso, `BaseLayout` renderiza
`<AnnouncementBar config={config} />` mesmo antes de `<Header config={config} />`.
Remove-se do `Header.astro` o bloco `{banner.enabled && banner.text && (...)}` e a
desestruturação `banner` da prop `config`.

## Edge cases

- **Conteúdo "vazio mas com tags"** (`<p></p>`, `<p><br></p>`): `isEmptyHtml` já lida
  com isto — strip tags + trim. A barra não renderiza.
- **Hex inválido na DB**: `hexSchema.refine(isValidHex)` apanha ao parsear; o admin não
  consegue gravar. Em runtime, se alguma vez aparecer hex inválido por mexer manualmente
  no DB, `getSiteConfig()` lança `ZodError`; o storefront apanha via `try/catch` e
  renderiza sem banner (`enabled=false` efectivo) — confirmar no plano que o caminho
  defensive existe.
- **HTML injectado com `<style>`/`<iframe>`/`<script>`**: bloqueado pelo allowlist.
- **`<a href="javascript:…">`** ou `data:`: bloqueado pelo `ALLOWED_URI_REGEXP`.
- **`style="display:none"`** ou outro CSS via `style`: bloqueado pelo hook que aceita
  só `color:`.
- **Texto MUITO longo** (admin cola um livro): `contentHtml.max(4000)` no Zod;
  Tailwind `truncate` não é aplicado (precisamos da quebra natural se há 2 linhas em
  mobile). O admin é avisado pelo erro de validação ao guardar.
- **TextStyle/Color do TipTap produz `<span style="color: #abc">`**: precisa de passar
  o hook do sanitizador (aceita `color:`). Teste-chave.
- **Dois admins editam ao mesmo tempo**: o `contentVersion` muda em ambos os saves —
  o último ganha; quem dispensou a versão N reaparece na N+1. Comportamento desejado.
- **Hook style aplicado também a `sanitizeHtml` quebra produtos existentes**: validar
  antes de aplicar se algum `<span style="...">` em produtos actuais tem mais que
  `color:`. Se sim, dividir o hook por flag.

## Test plan

- `src/lib/legacy-banner.test.ts`
  - `escapeHtml` escapa `<>&"'`
  - `legacyBannerMigration` em todas as combinações `text × linkUrl × bgColor`
  - Idempotência: shape novo → mesmo shape (sem perda de campos)
  - `hashContentSync("oi")` é determinista, 12 chars, base64url-safe (snapshot)
  - `hashContentSync(x) === await hashContentAsync(x)` para várias strings
- `src/lib/sanitize.test.ts` (adicionar a este ficheiro, NÃO um novo)
  - `sanitizeAnnouncement` aceita `<strong>`, `<em>`, `<u>`, `<a href>`, `<span style="color: #ED7396">`
  - Rejeita `<script>`, `<iframe>`, `<style>`, `<img>`, `<h1>`, `<ul>`
  - Rejeita `javascript:` / `data:` em `href`
  - Rejeita `style="display:none"`, `style="font-size:100px"`, `style="color: red; background: blue"` (composto rejeitado)
  - Aceita `style="color: red"`, `style="color: #ED7396"`, `style="color: rgb(255,0,0)"`
- `src/components/admin/RichTextEditor.test.tsx`
  - Modo `"full"` (default): toolbar tem botões de heading e listas
  - Modo `"inline"`: sem botões de heading nem listas; tem B/I/U/cor/link
  - Em modo inline, o editor permite escrever e o output HTML contém `<p>` mas nunca
    `<h1>` mesmo que o teste tente forçar (StarterKit configurado sem heading)
- `src/components/AnnouncementBar.test.ts` (Astro container API ou Playwright unit)
  - `enabled=false` → não renderiza
  - `enabled=true, contentHtml="<p></p>"` → não renderiza (`isEmptyHtml`)
  - `enabled=true, contentHtml="<p>oi</p>"` → renderiza com `style` correcto
  - Conteúdo malicioso (`<p>oi</p><script>x</script>`) → `<script>` removido do output
- `src/components/islands/AnnouncementDismissButton.test.tsx`
  - Clicar guarda `drisclub-banner-dismissed-${version}=1` no localStorage
  - Se key existe no mount, botão devolve `null`
  - Versão diferente → localStorage key diferente → botão reaparece
- `src/lib/config.test.ts` (provavelmente já existe — senão criar)
  - `globalsSchema` aceita shape novo
  - `globalsSchema` aceita shape antigo via preprocess (migração)
  - `contentVersion` muda quando `contentHtml` muda

Cobertura esperada: tudo o que entra em produção. Sem testes de e2e no plano — o ciclo
existente (`npm test -- --run`) é suficiente.

## Files changed (resumo)

**Novos:**
- `src/components/AnnouncementBar.astro`
- `src/components/islands/AnnouncementDismissButton.tsx`
- `src/components/islands/AnnouncementDismissButton.test.tsx`
- `src/lib/legacy-banner.ts`
- `src/lib/legacy-banner.test.ts`
- `scripts/migrate-banner-shape.ts`

**Modificados:**
- `src/lib/config.ts` — schema `banner`, preprocess
- `src/lib/sanitize.ts` — adiciona `sanitizeAnnouncement` + hook style
- `src/lib/sanitize.test.ts` — testes para `sanitizeAnnouncement`
- `src/components/admin/RichTextEditor.tsx` — prop `mode`
- `src/components/admin/RichTextEditor.test.tsx` (criar se não existir; senão estender)
- `src/components/admin/ColorPicker.tsx` — prop opcional `presets` + linha de swatches
- `src/components/admin/GlobalsEditor.tsx` — `BannerForm` reescrito, passa `brandingPresets`
- `src/pages/api/admin/globals.ts` — re-hash defensivo de `contentVersion`
- `src/components/Header.astro` — remove bloco do banner
- `src/layouts/BaseLayout.astro` — adiciona `<AnnouncementBar>` antes do `<Header>`
- `CLAUDE.md` — actualizar a secção "Site config (theme + globals)" para documentar o
  novo shape e a sanitização inline-mode

## Open questions

- **Posição vertical na página em mobile com `Header` sticky**: o banner não é sticky;
  scroll desce e o banner sai do ecrã, ficando só o header sticky. Confirma-se que é
  este o comportamento desejado (era o de hoje, mantém-se).
- **Hook style global vs. por-chamada**: se algum produto actual já tem
  `<span style="font-size:Xpx">` em descrições, o hook global vai quebrá-lo. O plan
  deve incluir uma query rápida ao DB de produção (`SELECT count(*) FROM products
  WHERE long_description LIKE '%style=%'`) e, se houver matches, implementar o hook
  com flag em vez de global.
