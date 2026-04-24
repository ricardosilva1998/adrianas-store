# Storefront: vídeo no carrossel, ajustes do hero, bloco de redes sociais

**Date:** 2026-04-24
**Status:** Design approved
**Scope:** 3 independent features that touch product pages, homepage hero, and the CMS block library

## Context

Three follow-up requests for drisclub.com, after the variant-color admin work landed in commit `ed541cd`:

1. **Vídeo no carrossel do produto** — hoje o carrossel só mostra imagens. Admins devem poder adicionar vídeos como slides normais no mesmo fluxo de upload.
2. **Ajustes no hero da homepage** — remover o overlay escuro do layout `background-image` e dar mais respiração aos textos.
3. **Bloco reutilizável de redes sociais** — equivalente ao bloco "Garantias" (`shipping-strip`), mas para links das redes sociais, com ícones em tiles rosa.

A funcionalidade de "Cor do produto (variante)" para bolsa necessaire e capas de telemóvel **não precisa de alterações no código** — o admin já suporta variantes em qualquer produto (schema e UI universais). Era só configuração em falta.

Este spec cobre as 3 features acima num único plano de implementação, porque partilham infraestrutura pequena (migração, block registry, admin form files) mas são independentes em runtime.

---

## Feature 1: Vídeo no carrossel de produto

### Modelo de dados

Adicionar um campo `kind` à tabela existente `product_images`, em vez de criar uma tabela de media separada:

```sql
ALTER TABLE product_images
  ADD COLUMN kind TEXT NOT NULL DEFAULT 'image';
```

Valores permitidos: `'image'` | `'video'`. Validado em app-layer (Zod), sem CHECK constraint no SQL para facilitar futuras extensões (ex: `'embed'`).

**Porquê estender em vez de criar tabela nova**:
- A ordenação (`position`) permanece unificada — um vídeo pode ficar entre duas fotos no carrossel sem lógica de merge.
- Não quebra queries/joins/índices existentes.
- O default `'image'` garante que registos pré-existentes continuam válidos sem backfill.
- Mantém o campo `alt` útil para acessibilidade tanto em fotos como em vídeos.

**Schema (`src/db/schema.ts`)**:

```ts
export const productMediaKind = ["image", "video"] as const;
export type ProductMediaKind = typeof productMediaKind[number];

export const productImages = pgTable(
  "product_images",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id").notNull().references(...),
    url: text("url").notNull(),
    alt: text("alt").notNull().default(""),
    position: integer("position").notNull().default(0),
    kind: text("kind").notNull().default("image"),   // novo
  },
  ...
);
```

O tipo `ProductWithExtras` em `src/lib/queries.ts` ganha `kind` no array `images`:

```ts
images: Array<{ url: string; alt: string; position: number; kind: "image" | "video" }>;
```

### Upload de vídeos

**`/api/admin/upload`** passa a aceitar MIME types de vídeo:

```ts
const ALLOWED_MIME = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",  // existentes
  "video/mp4", "video/webm", "video/quicktime",          // novos
]);
const MAX_SIZE_BYTES = 50 * 1024 * 1024;                 // 50 MB (era 10 MB para imagens)
```

A resposta devolve `{ url, kind }` — o cliente usa `kind` para saber se é imagem ou vídeo sem ter de parsear a URL/extensão.

### Admin UI (`ProductForm.tsx`)

Secção renomeada de **"Imagens"** para **"Imagens e vídeos"**. Dois botões de upload:

- `+ Upload de imagem` (abre file picker com `accept="image/*"`)
- `+ Upload de vídeo` (abre file picker com `accept="video/mp4,video/webm,video/quicktime"`)

Cada linha da lista de media mostra:
- Thumbnail quadrado à esquerda: `<img>` para imagens, `<video preload="metadata" muted>` (frame único) para vídeos
- Badge pequeno `"VÍDEO"` no canto da thumbnail quando `kind === "video"`
- Campo ALT (igual ao atual)
- Setas ↑↓ e botão Remover (iguais aos atuais)

O botão existente **"+ Adicionar URL"** fica limitado a imagens (texto alterado para "+ Adicionar URL de imagem") — vídeos só por upload, para garantir que ficam no R2 e não dependem de hotlinking.

### Storefront (`ProductGallery.tsx`)

O carrossel Embla continua igual. A diferença está no render de cada slide:

```tsx
{media.kind === "video" ? (
  <video
    src={media.url}
    autoPlay
    muted={muted}
    loop
    playsInline
    className="h-full w-full object-cover"
    aria-label={media.alt || productName}
  />
) : (
  <img ... />
)}
```

**Estado de mute**: um único estado `muted` partilhado por todos os vídeos do carrossel (se o visitante desmuta no primeiro, os outros também ficam desmutados). Botão flutuante `🔊`/`🔇` no canto inferior-direito do carrossel (apenas visível quando há pelo menos um slide de vídeo).

**Pausa fora-do-slide**: quando Embla muda de slide, o vídeo anterior é pausado com `videoRef.pause()` para evitar várias reproduções simultâneas. O vídeo do slide ativo dá `.play()` automaticamente (autoplay funciona porque está `muted`).

**Thumbs**: no strip de thumbnails, slide de vídeo mostra o frame 0 via `<video preload="metadata">` + ícone ▶ sobreposto para indicar que é vídeo.

### Tipos de ficheiro e limites

- Formatos aceites: MP4 (H.264), WebM (VP9), MOV (H.264)
- Tamanho máximo: **50 MB por vídeo**
- Recomendação no admin (texto de ajuda): "Até 50 MB. Idealmente 10–30 segundos, resolução 720p ou 1080p."

---

## Feature 2: Ajustes no hero

Apenas o layout `background-image` do `HeroBlock.astro` é alterado. Os outros 3 layouts (`image-right`, `image-left`, `centered`) ficam intocados.

### Remover overlay escuro

Remover a linha 28 do componente:

```astro
<div class="absolute inset-0 bg-black/40"></div>    ← REMOVER
```

### Compensar legibilidade com drop-shadow subtil

Como o texto é branco e pode ficar ilegível em imagens claras, adicionar um `drop-shadow` discreto ao título e subtítulo:

```astro
<h1 class="... drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]">...</h1>
<div class="... drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)]">...</div>
```

Mantém a imagem de fundo totalmente visível (sem escurecimento) mas preserva contraste do texto.

### Aumentar margens laterais

No container interno do layout `background-image`:

- Adicionar `max-w-3xl mx-auto` ao bloco de texto → texto concentrado no centro em vez de ir de ponta a ponta em ecrãs largos.
- Aumentar padding horizontal: `px-6 sm:px-10 lg:px-16` (substitui o `px-4 sm:px-6 lg:px-8` herdado da classe `section`).

**Resultado**: em ecrãs 1920px, texto deixa de ir até às bordas; em mobile, ganha respiração lateral.

---

## Feature 3: Bloco `social-links`

19º tipo de bloco no CMS. Reutilizável em qualquer página (não é data-binding).

### Schema Zod (`src/lib/blocks.ts`)

```ts
const socialIconSchema = z.enum([
  "instagram", "facebook", "tiktok", "youtube",
  "pinterest", "whatsapp", "email",
]);
export type SocialIcon = z.infer<typeof socialIconSchema>;

const socialLinksDataSchema = z.object({
  title: z.string().default("Segue-nos"),
  subtitle: z.string().default(""),
  items: z.array(z.object({
    icon: socialIconSchema.default("instagram"),
    label: z.string().default(""),    // ex: "@drisclub"
    url: safeUrl,
  })).max(7).default([]),
});

const socialLinksBlockSchema = z.object({
  id: z.string(),
  type: z.literal("social-links"),
  data: socialLinksDataSchema,
});
```

Adicionado ao `blockSchema` discriminated union, ao `BLOCK_TYPES` array (label: "Redes Sociais", description: "Tiles com ícones das redes sociais da loja"), e ao `createBlock()` factory.

### Ícones (`src/lib/icons.ts`)

O tipo `IconName` atual mantém os 8 ícones originais (`truck`, `lock`, `return`, `flag`, `heart`, `star`, `shield`, `sparkle`) para o `shipping-strip`. Adicionamos um **tipo separado** para redes sociais:

```ts
export type SocialIconName =
  | "instagram" | "facebook" | "tiktok" | "youtube"
  | "pinterest" | "whatsapp" | "email";

export const SOCIAL_ICON_PATHS: Record<SocialIconName, string> = {
  instagram: "<path data for IG glyph>",
  facebook: "<path data for FB>",
  // ...
};
```

Desta forma, o picker do `shipping-strip` no admin continua a mostrar só os 8 ícones "de garantias", e o picker do `social-links` mostra só os 7 sociais. Zero contaminação entre blocos.

SVGs monocromáticos (glyph único em `currentColor`) — a cor é aplicada pelo tile, não pelo SVG.

### Admin form (`BlockForm.tsx`)

Novo componente `SocialLinksForm`, estrutura idêntica ao `ShippingStripForm` existente:

```tsx
function SocialLinksForm({ data, onChange }) {
  return (
    <div className="grid gap-4">
      <input value={data.title} onChange={...} />         {/* Título */}
      <input value={data.subtitle} onChange={...} />      {/* Subtítulo */}
      {data.items.map((item, i) => (
        <div className="flex gap-2">
          <IconPicker                                     {/* igual ao ShippingStrip */}
            options={SOCIAL_ICONS}
            value={item.icon}
            onChange={(icon) => updateItem(i, { icon })}
          />
          <input value={item.label} placeholder="@handle" />
          <input value={item.url} placeholder="https://..." />
          <button onClick={() => removeItem(i)}>Remover</button>
        </div>
      ))}
      <button onClick={addItem}>+ Adicionar rede social</button>
    </div>
  );
}
```

### Storefront renderer (`src/components/blocks/SocialLinksBlock.astro`)

```astro
---
import { SOCIAL_ICON_PATHS, type SocialIconName } from "../../lib/icons";

interface Props {
  data: {
    title: string;
    subtitle: string;
    items: Array<{ icon: SocialIconName; label: string; url: string }>;
  };
}
const { data } = Astro.props;
const hasItems = data.items && data.items.length > 0;
---

{hasItems && (
  <section class="section py-12">
    {data.title && (
      <h2 class="text-center text-2xl font-semibold text-ink">{data.title}</h2>
    )}
    {data.subtitle && (
      <p class="mt-2 text-center text-sm text-ink-soft">{data.subtitle}</p>
    )}
    <div class="mt-8 flex flex-wrap justify-center gap-6">
      {data.items.map((item) => (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          class="group flex flex-col items-center gap-2"
        >
          <span class="flex h-12 w-12 items-center justify-center rounded-xl bg-rosa-500 text-white transition group-hover:-translate-y-0.5 group-hover:bg-rosa-600">
            <svg viewBox="0 0 24 24" class="h-6 w-6" fill="currentColor">
              <path d={SOCIAL_ICON_PATHS[item.icon]} />
            </svg>
          </span>
          {item.label && (
            <span class="text-xs text-ink-soft">{item.label}</span>
          )}
        </a>
      ))}
    </div>
  </section>
)}
```

**Design decisions**:
- Tiles `rounded-xl` (12px), `h-12 w-12` em todos os tamanhos (desktop e mobile) — tiles pequenos e uniformes cabem bem em ambos.
- Fundo `bg-rosa-500` da marca para todos (coerência visual).
- Hover: ligeira elevação + escurecimento (`hover:-translate-y-0.5` + `hover:bg-rosa-600`).
- Label abaixo do tile (opcional, só renderiza se preenchido).
- Links abrem em nova tab (`target="_blank"`) com `rel="noopener noreferrer"` por segurança.
- Renderer usa `fill="currentColor"` em vez de `stroke` — glyphs das redes ficam mais reconhecíveis cheios do que só em contorno.

### Registo no `BlockRenderer.astro`

Adicionar case `"social-links"` que importa e renderiza o `SocialLinksBlock`.

---

## Testes

- **Unit tests**: nenhum teste novo é estritamente necessário (lógica é ligação de UI + schema Zod). Se houver ciclo disponível, adicionar um teste `blocks.test.ts` que valide round-trip do schema `social-links`.
- **Manual testing**:
  - Upload de vídeo 50MB — deve aceitar
  - Upload de vídeo 60MB — deve rejeitar com mensagem clara
  - Vídeo mid-slide — autoplay muted, botão unmute funciona, pausa ao sair do slide
  - Hero background-image — sem overlay, texto legível sobre fotos claras e escuras (testar com 2 imagens diferentes)
  - Bloco social-links na homepage com 4 redes — links abrem em nova tab, hover funciona em desktop, tile toca em mobile

## Deploy

1. Merge → build Railway → migrações correm auto.
2. Verificar na produção:
   - Produto existente (ex: porta-chaves) carrega normal (regressão check).
   - Adicionar vídeo a um produto e ver no storefront.
   - Adicionar bloco `social-links` à homepage via `/admin/pages` → `Início`.
   - Editar hero da homepage para layout `background-image` e confirmar que overlay sumiu.

## Fora do âmbito

- Configurações por-produto de qual vídeo é "principal" (primeiro slide sempre) — fica `position` manual.
- Compressão automática de vídeos no upload — admin é responsável por exportar já comprimido.
- Lazy-loading de vídeos em slides não-ativos — pode ser otimização futura se o Lighthouse reclamar.
- Suporte a cores oficiais de cada rede social (só rosa da marca, por decisão do cliente).
- Extensão do `shipping-strip` para suportar links (o `social-links` é bloco próprio).
