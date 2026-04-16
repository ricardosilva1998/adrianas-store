# Phase 2: Visual Block Picker + User Presets

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the inline text-list block picker with a modal that shows a wireframe illustration for every block type and a live preview iframe for the selected type. Let the admin save any configured block as a named preset (stored in a new `block_presets` table) and insert it from a "Meus blocos" tab.

**Architecture:** New `BlockPickerDialog` React component hosts the modal, picker grid, preview pane, and preset list. Static SVG illustrations (one TSX per block type) keep the grid cheap. A new admin route `/admin/block-preview/[type]` renders a single block in a chromeless layout using either canned sample data or URL-encoded `data`. Presets persist in a new `block_presets` table with a thin REST API; validation reuses the existing block Zod schemas.

**Tech Stack:** Astro SSR, React 19 islands, Drizzle ORM, Zod, Vitest + RTL (from Phase 0). No new runtime dependencies.

**Prerequisites:** Phase 0 (test framework) installed. Phase 1 is assumed — the plan integrates with `PageEditor`. If skipping Phase 1, wire the dialog into the legacy `BlockEditor` instead.

---

### Task 1: Add `block_presets` table and migration

**Files:**
- Modify: `src/db/schema.ts`
- Create: migration file under `drizzle/` (auto-generated)

- [ ] **Step 1: Add the table definition**

Append to `src/db/schema.ts`, after the `mediaLibrary` block:
```ts
export const blockPresets = pgTable(
  "block_presets",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    data: jsonb("data").notNull(),
    createdByUserId: integer("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("block_presets_type_idx").on(t.type)],
);

export type BlockPresetRow = typeof blockPresets.$inferSelect;
```

- [ ] **Step 2: Generate the migration**

Run: `npm run db:generate`
Expected: a new migration SQL file appears under `drizzle/` adding the table.

- [ ] **Step 3: Apply to the dev database**

Run: `npm run db:push`
Expected: the `block_presets` table is created in the dev Postgres.

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.ts drizzle/
git commit -m "feat(db): add block_presets table + migration"
```

---

### Task 2: Sample block data fixtures (TDD)

**Files:**
- Create: `src/lib/block-samples.ts`
- Create: `src/lib/block-samples.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/block-samples.test.ts
import { describe, it, expect } from "vitest";
import { SAMPLE_BLOCK_DATA, SAMPLE_PRODUCT, SAMPLE_PRODUCTS } from "./block-samples";
import { BLOCK_TYPES, blockSchema } from "./blocks";

describe("block samples", () => {
  it("has a sample for every BlockType", () => {
    for (const bt of BLOCK_TYPES) {
      expect(SAMPLE_BLOCK_DATA[bt.type]).toBeDefined();
    }
  });

  it("every sample passes the block Zod schema", () => {
    for (const bt of BLOCK_TYPES) {
      const candidate = { id: "sample-" + bt.type, type: bt.type, data: SAMPLE_BLOCK_DATA[bt.type] };
      const parsed = blockSchema.safeParse(candidate);
      expect(parsed.success, `${bt.type}: ${JSON.stringify(parsed.error?.format())}`).toBe(true);
    }
  });

  it("SAMPLE_PRODUCT has images + colors arrays", () => {
    expect(Array.isArray(SAMPLE_PRODUCT.images)).toBe(true);
    expect(Array.isArray(SAMPLE_PRODUCT.colors)).toBe(true);
  });

  it("SAMPLE_PRODUCTS has at least 4 entries", () => {
    expect(SAMPLE_PRODUCTS.length).toBeGreaterThanOrEqual(4);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test -- block-samples`
Expected: fails on missing module.

- [ ] **Step 3: Implement the fixtures**

```ts
// src/lib/block-samples.ts
import type { BlockType } from "./blocks";
import type { ProductWithExtras } from "./queries";

export const SAMPLE_PRODUCT: ProductWithExtras = {
  id: 1,
  slug: "tote-exemplo",
  name: "Tote Bag Exemplo",
  description: "Tote em algodão natural com bordado personalizado.",
  longDescription: "# Sobre a peça\n\nBordada à mão com o teu nome ou frase favorita.",
  priceCents: 2200,
  category: "tote-bags",
  stock: 10,
  unlimitedStock: false,
  bestseller: true,
  personalizable: true,
  active: true,
  sortOrder: 0,
  images: [
    { url: "https://picsum.photos/seed/tote-1/800/800", alt: "Tote frente", position: 0 },
    { url: "https://picsum.photos/seed/tote-2/800/800", alt: "Tote verso", position: 1 },
  ],
  colors: [
    { name: "Rosa", hex: "#ED7396", position: 0 },
    { name: "Preto", hex: "#111111", position: 1 },
  ],
};

export const SAMPLE_PRODUCTS: ProductWithExtras[] = [
  SAMPLE_PRODUCT,
  { ...SAMPLE_PRODUCT, id: 2, slug: "tshirt-a", name: "T-shirt A", category: "t-shirts", priceCents: 1800 },
  { ...SAMPLE_PRODUCT, id: 3, slug: "necessaire-a", name: "Necessaire A", category: "necessaire", priceCents: 1600 },
  { ...SAMPLE_PRODUCT, id: 4, slug: "frasco-a", name: "Frasco A", category: "frascos-vidro", priceCents: 900 },
];

export const SAMPLE_BLOCK_DATA: Record<BlockType, any> = {
  hero: {
    title: "Peças feitas à mão",
    titleAccent: "para ti",
    subtitle: "Totes, t-shirts e acessórios com bordado personalizado.",
    buttonText: "Ver catálogo",
    buttonUrl: "/catalogo",
    imageUrl: "https://picsum.photos/seed/hero/1200/600",
  },
  text: { markdown: "## Sobre\n\nPeças **feitas à mão** em Portugal." },
  "product-grid": { title: "Mais vendidos", subtitle: "Os favoritos desta semana", filter: "bestsellers" },
  "category-grid": { title: "Categorias", subtitle: "", categories: ["tote-bags", "t-shirts", "necessaire"] },
  "image-gallery": {
    images: [
      { url: "https://picsum.photos/seed/g1/600/600", alt: "" },
      { url: "https://picsum.photos/seed/g2/600/600", alt: "" },
      { url: "https://picsum.photos/seed/g3/600/600", alt: "" },
    ],
  },
  "cta-banner": { title: "Pronta para encomendar?", subtitle: "Envios para Portugal Continental e Ilhas.", buttonText: "Encomendar", buttonUrl: "/catalogo", bgColor: "ink" },
  faq: {
    title: "Perguntas frequentes",
    items: [
      { question: "Quanto tempo demora?", answer: "3 a 5 dias úteis." },
      { question: "Fazem envios para os Açores?", answer: "Sim, via CTT." },
    ],
  },
  "contact-info": { email: "ola@adrianas.pt", whatsapp: "+351 912 345 678", instagram: "@adrianas.store", address: "Lisboa, Portugal" },
  testimonials: {
    title: "O que dizem as clientes",
    items: [
      { name: "Mariana", quote: "Adoro a tote que pedi — o bordado está perfeito.", avatarUrl: "https://picsum.photos/seed/av1/80/80" },
      { name: "Sofia", quote: "Presente ideal, chegou super rápido.", avatarUrl: "https://picsum.photos/seed/av2/80/80" },
    ],
  },
  newsletter: { title: "Recebe novidades", description: "Sem spam, só lançamentos.", buttonText: "Subscrever", actionUrl: "mailto:ola@adrianas.pt" },
  "image-text-split": {
    imageUrl: "https://picsum.photos/seed/split/800/800",
    imageAlt: "Peça bordada",
    title: "Feito por mãos portuguesas",
    markdown: "Cada peça é **bordada à mão** no nosso atelier.",
    layout: "image-left",
  },
  "video-embed": { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", title: "Bastidores", caption: "Como bordamos cada peça." },
  divider: { style: "line", spacing: "medium" },
  "product-gallery": { showThumbs: true, showBadges: true },
  "product-info": { showBreadcrumbs: true, shippingInfo: "• Preparação: 3 a 5 dias úteis\n• Envios via CTT para Portugal Continental e Ilhas\n• Pagamento via MB Way, transferência bancária ou PayPal" },
  "product-long-description": { title: "" },
  "product-related": { title: "Talvez também gostes", limit: 4 },
  "catalog-grid-bound": { title: "Catálogo", subtitle: "Todas as peças", showCategoryFilter: true, columns: "4" },
};
```

- [ ] **Step 4: Run to confirm tests pass**

Run: `npm test -- block-samples`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/block-samples.ts src/lib/block-samples.test.ts
git commit -m "feat(blocks): canned sample data for every block type"
```

---

### Task 3: `BareLayout.astro` for chromeless previews

**Files:**
- Create: `src/layouts/BareLayout.astro`

- [ ] **Step 1: Create the layout**

```astro
---
import "../styles/global.css";
import { renderThemeCSS, renderGoogleFontsHref } from "../lib/config";
import { getSiteConfig } from "../lib/config-server";

interface Props {
  title?: string;
}

const config = await getSiteConfig(Astro.locals.previewConfig);
const { title = "Pré-visualização" } = Astro.props;
const themeCSS = renderThemeCSS(config.theme);
const fontsHref = renderGoogleFontsHref(config.theme.fonts);
---

<!doctype html>
<html lang="pt-PT">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <link href={fontsHref} rel="stylesheet" />
    <style set:html={themeCSS}></style>
    <title>{title}</title>
  </head>
  <body class="bg-white text-ink antialiased">
    <slot />
  </body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add src/layouts/BareLayout.astro
git commit -m "feat(layout): chromeless BareLayout for block previews"
```

---

### Task 4: `/admin/block-preview/[type]` route

**Files:**
- Create: `src/pages/admin/block-preview/[type].astro`

- [ ] **Step 1: Create the route**

```astro
---
import BareLayout from "../../../layouts/BareLayout.astro";
import BlockRenderer from "../../../components/blocks/BlockRenderer.astro";
import { SAMPLE_BLOCK_DATA, SAMPLE_PRODUCT, SAMPLE_PRODUCTS } from "../../../lib/block-samples";
import { BLOCK_TYPES, blockSchema, type BlockType } from "../../../lib/blocks";

export const prerender = false;

const user = Astro.locals.user;
if (!user) return new Response("Unauthorized", { status: 401 });

const typeParam = Astro.params.type as BlockType | undefined;
if (!typeParam || !BLOCK_TYPES.some((bt) => bt.type === typeParam)) {
  return new Response("Bloco desconhecido", { status: 404 });
}

const rawData = Astro.url.searchParams.get("data");
let data: unknown = SAMPLE_BLOCK_DATA[typeParam];
if (rawData) {
  try {
    const parsed = JSON.parse(decodeURIComponent(rawData));
    const candidate = { id: "preview", type: typeParam, data: parsed };
    const check = blockSchema.safeParse(candidate);
    if (check.success) data = parsed;
  } catch {
    // fall through — keep sample
  }
}

const block = { id: "preview", type: typeParam, data };

const isProductContext =
  typeParam === "product-gallery" ||
  typeParam === "product-info" ||
  typeParam === "product-long-description" ||
  typeParam === "product-related";
const isCatalogContext = typeParam === "catalog-grid-bound";
---

<BareLayout title={`Preview: ${typeParam}`}>
  <BlockRenderer
    block={block}
    context={{
      product: isProductContext ? SAMPLE_PRODUCT : undefined,
      relatedProducts: isProductContext ? SAMPLE_PRODUCTS.slice(1) : undefined,
      products: isCatalogContext ? SAMPLE_PRODUCTS : undefined,
      activeCategory: undefined,
    }}
  />
</BareLayout>
```

- [ ] **Step 2: Manual sanity check**

Run `npm run dev`, log in, and visit:
- `http://localhost:4321/admin/block-preview/hero` — sample hero renders.
- `http://localhost:4321/admin/block-preview/faq` — sample FAQ renders.
- `http://localhost:4321/admin/block-preview/product-info` — sample product info renders.

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/block-preview/[type].astro
git commit -m "feat(admin): block preview route with sample data"
```

---

### Task 5: Block-presets REST API

**Files:**
- Create: `src/pages/api/admin/block-presets/index.ts`
- Create: `src/pages/api/admin/block-presets/[id].ts`

- [ ] **Step 1: Create list + create endpoint**

```ts
// src/pages/api/admin/block-presets/index.ts
import type { APIRoute } from "astro";
import { desc, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../../../../db/client";
import { BLOCK_TYPES, blocksAllowedIn, blockSchema } from "../../../../lib/blocks";

export const prerender = false;

const CreateSchema = z.object({
  name: z.string().min(1).max(80),
  type: z.string(),
  data: z.record(z.unknown()),
});

export const GET: APIRoute = async ({ url, locals }) => {
  if (!locals.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const ctx = url.searchParams.get("context") as "page" | "template-catalog" | "template-product-detail" | null;

  let rows;
  if (ctx) {
    const allowed = blocksAllowedIn(ctx).map((bt) => bt.type);
    rows = await db
      .select()
      .from(schema.blockPresets)
      .where(inArray(schema.blockPresets.type, allowed))
      .orderBy(desc(schema.blockPresets.createdAt));
  } else {
    rows = await db.select().from(schema.blockPresets).orderBy(desc(schema.blockPresets.createdAt));
  }

  return new Response(JSON.stringify(rows), { status: 200, headers: { "Content-Type": "application/json" } });
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return new Response(JSON.stringify({ error: "Dados invalidos" }), { status: 400 });

  if (!BLOCK_TYPES.some((bt) => bt.type === parsed.data.type)) {
    return new Response(JSON.stringify({ error: "Tipo de bloco desconhecido" }), { status: 400 });
  }

  const check = blockSchema.safeParse({ id: "preset", type: parsed.data.type, data: parsed.data.data });
  if (!check.success) {
    return new Response(JSON.stringify({ error: "Dados invalidos para este tipo" }), { status: 400 });
  }

  const [row] = await db
    .insert(schema.blockPresets)
    .values({
      name: parsed.data.name,
      type: parsed.data.type,
      data: parsed.data.data,
      createdByUserId: locals.user.id,
    })
    .returning();

  return new Response(JSON.stringify(row), { status: 201, headers: { "Content-Type": "application/json" } });
};
```

- [ ] **Step 2: Create the delete endpoint**

```ts
// src/pages/api/admin/block-presets/[id].ts
import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { db, schema } from "../../../../db/client";

export const prerender = false;

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!locals.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return new Response(JSON.stringify({ error: "Id invalido" }), { status: 400 });
  }
  await db.delete(schema.blockPresets).where(eq(schema.blockPresets.id, id));
  return new Response(JSON.stringify({ success: true }), { status: 200 });
};
```

- [ ] **Step 3: Manual test**

```bash
curl -i -X POST 'http://localhost:4321/api/admin/block-presets' \
  -H 'Content-Type: application/json' \
  -b 'adriana-session=<session-jwt>' \
  -d '{"name":"Hero home","type":"hero","data":{"title":"Olá","titleAccent":"","subtitle":"","buttonText":"","buttonUrl":"","imageUrl":""}}'
```
Expected: 201 with the new row.

```bash
curl -s 'http://localhost:4321/api/admin/block-presets?context=page' -b 'adriana-session=<session-jwt>' | head
```
Expected: JSON array containing the preset.

- [ ] **Step 4: Commit**

```bash
git add src/pages/api/admin/block-presets/index.ts src/pages/api/admin/block-presets/[id].ts
git commit -m "feat(api): block presets GET/POST/DELETE endpoints"
```

---

### Task 6: SVG block illustrations (18 files + dispatcher + Frame)

**Files:**
- Create: `src/components/admin/block-illustrations/Frame.tsx`
- Create: `src/components/admin/block-illustrations/BlockIllustration.tsx`
- Create: `src/components/admin/block-illustrations/<type>.tsx` × 18

- [ ] **Step 1: Create the shared Frame**

```tsx
// src/components/admin/block-illustrations/Frame.tsx
import type { ReactNode } from "react";

export default function Frame({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 200 120" className="h-full w-full" role="img" aria-hidden>
      <rect x="0" y="0" width="200" height="120" fill="var(--color-rosa-50, #fdf2f8)" rx="10" />
      {children}
    </svg>
  );
}
```

- [ ] **Step 2: Create the dispatcher**

```tsx
// src/components/admin/block-illustrations/BlockIllustration.tsx
import type { BlockType } from "../../../lib/blocks";
import Hero from "./hero";
import Text from "./text";
import ProductGrid from "./product-grid";
import CategoryGrid from "./category-grid";
import ImageGallery from "./image-gallery";
import CtaBanner from "./cta-banner";
import Faq from "./faq";
import ContactInfo from "./contact-info";
import Testimonials from "./testimonials";
import Newsletter from "./newsletter";
import ImageTextSplit from "./image-text-split";
import VideoEmbed from "./video-embed";
import Divider from "./divider";
import ProductGallery from "./product-gallery";
import ProductInfo from "./product-info";
import ProductLongDescription from "./product-long-description";
import ProductRelated from "./product-related";
import CatalogGridBound from "./catalog-grid-bound";

const MAP: Record<BlockType, () => JSX.Element> = {
  hero: Hero,
  text: Text,
  "product-grid": ProductGrid,
  "category-grid": CategoryGrid,
  "image-gallery": ImageGallery,
  "cta-banner": CtaBanner,
  faq: Faq,
  "contact-info": ContactInfo,
  testimonials: Testimonials,
  newsletter: Newsletter,
  "image-text-split": ImageTextSplit,
  "video-embed": VideoEmbed,
  divider: Divider,
  "product-gallery": ProductGallery,
  "product-info": ProductInfo,
  "product-long-description": ProductLongDescription,
  "product-related": ProductRelated,
  "catalog-grid-bound": CatalogGridBound,
};

export default function BlockIllustration({ type }: { type: BlockType }) {
  const Component = MAP[type];
  return <Component />;
}
```

- [ ] **Step 3: Create each of the 18 illustrations**

Create each file with the exact content below.

`hero.tsx`:
```tsx
import Frame from "./Frame";
export default function HeroIllustration() {
  return (
    <Frame>
      <rect x="10" y="14" width="180" height="70" rx="8" fill="#fbcfe8" />
      <rect x="22" y="90" width="70" height="8" rx="3" fill="#be185d" />
      <rect x="100" y="90" width="40" height="10" rx="5" fill="#ED7396" />
    </Frame>
  );
}
```

`text.tsx`:
```tsx
import Frame from "./Frame";
export default function TextIllustration() {
  return (
    <Frame>
      {[20, 34, 48, 62, 76, 90].map((y, i) => (
        <rect key={i} x="20" y={y} width={i % 2 ? 140 : 160} height="4" rx="2" fill="#d4d4d8" />
      ))}
    </Frame>
  );
}
```

`product-grid.tsx`:
```tsx
import Frame from "./Frame";
export default function ProductGridIllustration() {
  return (
    <Frame>
      <rect x="20" y="14" width="80" height="4" rx="2" fill="#be185d" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={15 + i * 44} y="30" width="38" height="70" rx="6" fill="#fbcfe8" />
      ))}
    </Frame>
  );
}
```

`category-grid.tsx`:
```tsx
import Frame from "./Frame";
export default function CategoryGridIllustration() {
  return (
    <Frame>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <circle cx={40 + i * 60} cy="50" r="22" fill="#fbcfe8" />
          <rect x={22 + i * 60} y="84" width="36" height="4" rx="2" fill="#d4d4d8" />
        </g>
      ))}
    </Frame>
  );
}
```

`image-gallery.tsx`:
```tsx
import Frame from "./Frame";
export default function ImageGalleryIllustration() {
  return (
    <Frame>
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={15 + (i % 2) * 92} y={15 + Math.floor(i / 2) * 48} width="80" height="40" rx="4" fill="#fbcfe8" />
      ))}
    </Frame>
  );
}
```

`cta-banner.tsx`:
```tsx
import Frame from "./Frame";
export default function CtaBannerIllustration() {
  return (
    <Frame>
      <rect x="10" y="30" width="180" height="60" rx="10" fill="#111111" />
      <rect x="26" y="48" width="90" height="6" rx="3" fill="#ffffff" />
      <rect x="26" y="62" width="60" height="4" rx="2" fill="#8a8a8a" />
      <rect x="130" y="55" width="44" height="14" rx="7" fill="#ED7396" />
    </Frame>
  );
}
```

`faq.tsx`:
```tsx
import Frame from "./Frame";
export default function FaqIllustration() {
  return (
    <Frame>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x="16" y={18 + i * 28} width="168" height="22" rx="5" fill="#ffffff" stroke="#eaeaea" />
          <rect x="26" y={25 + i * 28} width="100" height="4" rx="2" fill="#d4d4d8" />
          <path d={`M176 ${28 + i * 28} l-4 4 l-4 -4`} stroke="#8a8a8a" fill="none" strokeWidth="1.5" />
        </g>
      ))}
    </Frame>
  );
}
```

`contact-info.tsx`:
```tsx
import Frame from "./Frame";
export default function ContactInfoIllustration() {
  return (
    <Frame>
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <circle cx="28" cy={26 + i * 20} r="6" fill="#fbcfe8" />
          <rect x="42" y={23 + i * 20} width="120" height="4" rx="2" fill="#d4d4d8" />
        </g>
      ))}
    </Frame>
  );
}
```

`testimonials.tsx`:
```tsx
import Frame from "./Frame";
export default function TestimonialsIllustration() {
  return (
    <Frame>
      {[0, 1].map((i) => (
        <g key={i}>
          <rect x={15 + i * 92} y="24" width="80" height="70" rx="8" fill="#ffffff" stroke="#eaeaea" />
          <circle cx={35 + i * 92} cy="40" r="8" fill="#fbcfe8" />
          <rect x={47 + i * 92} y={36} width="40" height="4" rx="2" fill="#d4d4d8" />
          <rect x={22 + i * 92} y={60} width="66" height="4" rx="2" fill="#d4d4d8" />
          <rect x={22 + i * 92} y={70} width="56" height="4" rx="2" fill="#d4d4d8" />
        </g>
      ))}
    </Frame>
  );
}
```

`newsletter.tsx`:
```tsx
import Frame from "./Frame";
export default function NewsletterIllustration() {
  return (
    <Frame>
      <rect x="30" y="30" width="120" height="6" rx="3" fill="#be185d" />
      <rect x="30" y="50" width="95" height="22" rx="11" fill="#ffffff" stroke="#eaeaea" />
      <rect x="130" y="50" width="40" height="22" rx="11" fill="#ED7396" />
    </Frame>
  );
}
```

`image-text-split.tsx`:
```tsx
import Frame from "./Frame";
export default function ImageTextSplitIllustration() {
  return (
    <Frame>
      <rect x="12" y="16" width="80" height="88" rx="8" fill="#fbcfe8" />
      <rect x="102" y="30" width="80" height="4" rx="2" fill="#be185d" />
      {[44, 56, 68, 80].map((y, i) => (
        <rect key={i} x="102" y={y} width={i === 3 ? 50 : 80} height="4" rx="2" fill="#d4d4d8" />
      ))}
    </Frame>
  );
}
```

`video-embed.tsx`:
```tsx
import Frame from "./Frame";
export default function VideoEmbedIllustration() {
  return (
    <Frame>
      <rect x="18" y="18" width="164" height="84" rx="8" fill="#111111" />
      <polygon points="95,50 95,80 118,65" fill="#ffffff" />
    </Frame>
  );
}
```

`divider.tsx`:
```tsx
import Frame from "./Frame";
export default function DividerIllustration() {
  return (
    <Frame>
      <line x1="20" y1="60" x2="180" y2="60" stroke="#d4d4d8" strokeWidth="2" />
    </Frame>
  );
}
```

`product-gallery.tsx`:
```tsx
import Frame from "./Frame";
export default function ProductGalleryIllustration() {
  return (
    <Frame>
      <rect x="16" y="14" width="100" height="90" rx="8" fill="#fbcfe8" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x="126" y={14 + i * 22} width="58" height="18" rx="4" fill="#f9a8d4" />
      ))}
    </Frame>
  );
}
```

`product-info.tsx`:
```tsx
import Frame from "./Frame";
export default function ProductInfoIllustration() {
  return (
    <Frame>
      <rect x="20" y="20" width="40" height="4" rx="2" fill="#8a8a8a" />
      <rect x="20" y="32" width="120" height="8" rx="3" fill="#111111" />
      <rect x="20" y="46" width="60" height="6" rx="2" fill="#ED7396" />
      {[62, 72, 82].map((y, i) => (
        <rect key={i} x="20" y={y} width={i === 2 ? 80 : 150} height="4" rx="2" fill="#d4d4d8" />
      ))}
      <rect x="20" y="96" width="80" height="14" rx="7" fill="#ED7396" />
    </Frame>
  );
}
```

`product-long-description.tsx`:
```tsx
import Frame from "./Frame";
export default function ProductLongDescriptionIllustration() {
  return (
    <Frame>
      <rect x="20" y="16" width="70" height="6" rx="2" fill="#be185d" />
      {[32, 44, 56, 68, 80, 92].map((y, i) => (
        <rect key={i} x="20" y={y} width={i === 5 ? 90 : 160} height="4" rx="2" fill="#d4d4d8" />
      ))}
    </Frame>
  );
}
```

`product-related.tsx`:
```tsx
import Frame from "./Frame";
export default function ProductRelatedIllustration() {
  return (
    <Frame>
      <rect x="20" y="16" width="100" height="4" rx="2" fill="#be185d" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={15 + i * 44} y="30" width="38" height="70" rx="6" fill="#fbcfe8" />
      ))}
    </Frame>
  );
}
```

`catalog-grid-bound.tsx`:
```tsx
import Frame from "./Frame";
export default function CatalogGridBoundIllustration() {
  return (
    <Frame>
      <rect x="16" y="14" width="168" height="10" rx="5" fill="#fbcfe8" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={15 + i * 44} y="32" width="38" height="70" rx="6" fill="#f9a8d4" />
      ))}
    </Frame>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run check`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/block-illustrations
git commit -m "feat(admin): SVG wireframe illustrations for all 18 block types"
```

---

### Task 7: `BlockPickerDialog` component (TDD)

**Files:**
- Create: `src/components/admin/BlockPickerDialog.tsx`
- Create: `src/components/admin/BlockPickerDialog.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// src/components/admin/BlockPickerDialog.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BlockPickerDialog from "./BlockPickerDialog";

describe("BlockPickerDialog", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] }) as any;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists page-context blocks only (no product-* / catalog-grid-bound)", () => {
    render(<BlockPickerDialog open context="page" onClose={() => {}} onInsertBlockType={() => {}} onInsertPreset={() => {}} />);
    expect(screen.getByText(/hero/i)).toBeInTheDocument();
    expect(screen.queryByText(/galeria do produto/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/grelha do catálogo/i)).not.toBeInTheDocument();
  });

  it("switching to 'Meus blocos' fetches presets", async () => {
    const user = userEvent.setup();
    render(<BlockPickerDialog open context="page" onClose={() => {}} onInsertBlockType={() => {}} onInsertPreset={() => {}} />);
    await user.click(screen.getByRole("tab", { name: /meus blocos/i }));
    await waitFor(() =>
      expect((globalThis.fetch as any)).toHaveBeenCalledWith(
        "/api/admin/block-presets?context=page",
      ),
    );
  });

  it("calls onInsertBlockType with the selected type when 'Inserir' is clicked", async () => {
    const user = userEvent.setup();
    const onInsertBlockType = vi.fn();
    render(<BlockPickerDialog open context="page" onClose={() => {}} onInsertBlockType={onInsertBlockType} onInsertPreset={() => {}} />);
    await user.click(screen.getByText(/hero/i));
    await user.click(screen.getByRole("button", { name: /inserir/i }));
    expect(onInsertBlockType).toHaveBeenCalledWith("hero");
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test -- BlockPickerDialog`
Expected: fails on missing module.

- [ ] **Step 3: Implement the dialog**

```tsx
// src/components/admin/BlockPickerDialog.tsx
import { useEffect, useMemo, useState } from "react";
import { blocksAllowedIn, type BlockType } from "../../lib/blocks";
import BlockIllustration from "./block-illustrations/BlockIllustration";

type Context = "page" | "template-catalog" | "template-product-detail";

type Preset = { id: number; name: string; type: BlockType; data: any };

interface Props {
  open: boolean;
  context: Context;
  onClose: () => void;
  onInsertBlockType: (type: BlockType) => void;
  onInsertPreset: (preset: Preset) => void;
}

export default function BlockPickerDialog({ open, context, onClose, onInsertBlockType, onInsertPreset }: Props) {
  const [tab, setTab] = useState<"blocos" | "presets">("blocos");
  const [selectedType, setSelectedType] = useState<BlockType | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loadingPresets, setLoadingPresets] = useState(false);

  const allowed = useMemo(() => blocksAllowedIn(context), [context]);

  useEffect(() => {
    if (!open || tab !== "presets") return;
    let cancelled = false;
    (async () => {
      setLoadingPresets(true);
      try {
        const res = await fetch(`/api/admin/block-presets?context=${context}`);
        if (!res.ok) return;
        const data = (await res.json()) as Preset[];
        if (!cancelled) setPresets(data);
      } finally {
        if (!cancelled) setLoadingPresets(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, tab, context]);

  if (!open) return null;

  const previewSrc = selectedPreset
    ? `/admin/block-preview/${selectedPreset.type}?data=${encodeURIComponent(JSON.stringify(selectedPreset.data))}`
    : selectedType
      ? `/admin/block-preview/${selectedType}`
      : "";

  const insert = () => {
    if (tab === "blocos" && selectedType) onInsertBlockType(selectedType);
    if (tab === "presets" && selectedPreset) onInsertPreset(selectedPreset);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-6">
      <div className="flex h-[85vh] w-[min(1100px,95vw)] flex-col overflow-hidden rounded-3xl border border-ink-line bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-line px-6 py-4">
          <div role="tablist" className="flex gap-1 rounded-full border border-ink-line p-1">
            <button role="tab" aria-selected={tab === "blocos"} onClick={() => setTab("blocos")} className={`px-4 py-1 text-sm font-medium rounded-full ${tab === "blocos" ? "bg-ink text-white" : "text-ink-soft"}`}>Blocos</button>
            <button role="tab" aria-selected={tab === "presets"} onClick={() => setTab("presets")} className={`px-4 py-1 text-sm font-medium rounded-full ${tab === "presets" ? "bg-ink text-white" : "text-ink-soft"}`}>Meus blocos</button>
          </div>
          <button onClick={onClose} className="text-sm text-ink-muted hover:text-rosa-500">Fechar ✕</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-1/2 overflow-y-auto border-r border-ink-line p-6">
            {tab === "blocos" ? (
              <div className="grid grid-cols-2 gap-3">
                {allowed.map((bt) => (
                  <button
                    key={bt.type}
                    onClick={() => setSelectedType(bt.type)}
                    className={`rounded-2xl border p-3 text-left transition ${selectedType === bt.type ? "border-rosa-400 bg-rosa-50" : "border-ink-line hover:border-rosa-300"}`}
                  >
                    <div className="mb-2 aspect-[5/3] overflow-hidden rounded-xl bg-rosa-50/40">
                      <BlockIllustration type={bt.type} />
                    </div>
                    <div className="text-sm font-semibold text-ink">{bt.label}</div>
                    <div className="text-[11px] text-ink-muted">{bt.description}</div>
                  </button>
                ))}
              </div>
            ) : (
              <>
                {loadingPresets && <div className="text-sm text-ink-muted">A carregar…</div>}
                {!loadingPresets && presets.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-ink-line p-6 text-sm text-ink-muted">
                    Ainda não tens blocos personalizados. Clica em "Guardar como bloco personalizado" dentro de qualquer bloco para começar.
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {presets.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPreset(p)}
                      className={`rounded-2xl border p-3 text-left transition ${selectedPreset?.id === p.id ? "border-rosa-400 bg-rosa-50" : "border-ink-line hover:border-rosa-300"}`}
                    >
                      <div className="mb-2 aspect-[5/3] overflow-hidden rounded-xl bg-rosa-50/40">
                        <BlockIllustration type={p.type} />
                      </div>
                      <div className="text-sm font-semibold text-ink">{p.name}</div>
                      <div className="text-[10px] uppercase tracking-wide text-rosa-600">{p.type}</div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="flex w-1/2 flex-col">
            <div className="flex-1 overflow-hidden bg-ink-line/40">
              {previewSrc ? (
                <iframe src={previewSrc} title="Preview" className="h-full w-full border-0" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-ink-muted">Seleciona um bloco para pré-visualizar</div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-ink-line p-4">
              <button onClick={onClose} className="rounded-full border border-ink-line px-4 py-2 text-sm text-ink-soft">Cancelar</button>
              <button
                onClick={insert}
                disabled={!(tab === "blocos" ? selectedType : selectedPreset)}
                className="rounded-full bg-rosa-400 px-5 py-2 text-sm font-medium text-white hover:bg-rosa-500 disabled:opacity-40"
              >
                Inserir
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npm test -- BlockPickerDialog`
Expected: all three tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/BlockPickerDialog.tsx src/components/admin/BlockPickerDialog.test.tsx
git commit -m "feat(admin): BlockPickerDialog with illustrations + preset tab"
```

---

### Task 8: Wire `BlockPickerDialog` into `PageEditor`

**Files:**
- Modify: `src/components/admin/PageEditor.tsx`

- [ ] **Step 1: Replace the inline picker**

Replace the `{showPicker ? ... : ...}` JSX block in `PageEditor.tsx` with:
```tsx
<button
  type="button"
  onClick={() => setShowPicker(true)}
  className="w-full rounded-3xl border border-dashed border-ink-line p-4 text-sm text-ink-muted hover:border-rosa-300 hover:text-rosa-500"
>
  + Adicionar bloco
</button>
<BlockPickerDialog
  open={showPicker}
  context="page"
  onClose={() => setShowPicker(false)}
  onInsertBlockType={async (type) => {
    await addBlock(type);
    setShowPicker(false);
  }}
  onInsertPreset={async (preset) => {
    const block = { id: crypto.randomUUID().slice(0, 10), type: preset.type, data: preset.data } as any;
    setBlocks((prev) => [...prev, block]);
    setExpanded(block.id);
    await fetch(`/api/admin/pages/${slug}/blocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ block }),
    });
    setHasDraft(true);
    setShowPicker(false);
  }}
/>
```

Add the import at the top of the file:
```tsx
import BlockPickerDialog from "./BlockPickerDialog";
```

- [ ] **Step 2: Dev-server verification**

Open `/admin/pages/home`. Click "+ Adicionar bloco" — the modal opens with SVG previews. Select one, click Inserir — the block appears in the sidebar and in the iframe preview.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/PageEditor.tsx
git commit -m "feat(admin): PageEditor uses BlockPickerDialog"
```

---

### Task 9: Save-as-preset on `BlockCard` (TDD)

**Files:**
- Modify: `src/components/admin/BlockCard.tsx`
- Modify: `src/components/admin/BlockCard.test.tsx`

- [ ] **Step 1: Extend the test file**

Append to `src/components/admin/BlockCard.test.tsx`:
```tsx
it("POSTs to /api/admin/block-presets when 'Guardar como bloco personalizado' is clicked", async () => {
  const user = userEvent.setup();
  vi.spyOn(window, "prompt").mockReturnValue("Hero home");
  render(
    <BlockCard
      slug="home"
      block={hero}
      expanded
      onChange={() => {}}
      onMoveUp={() => {}}
      onMoveDown={() => {}}
      onRemove={() => {}}
      onToggleExpand={() => {}}
      canMoveUp
      canMoveDown
    />,
  );
  await user.click(screen.getByRole("button", { name: /mais opções/i }));
  await user.click(screen.getByRole("menuitem", { name: /guardar como bloco personalizado/i }));
  await waitFor(() =>
    expect((globalThis.fetch as any)).toHaveBeenCalledWith(
      "/api/admin/block-presets",
      expect.objectContaining({ method: "POST" }),
    ),
  );
});
```

- [ ] **Step 2: Run test to confirm failure**

Run: `npm test -- BlockCard`
Expected: the new test fails.

- [ ] **Step 3: Add the overflow menu to `BlockCard.tsx`**

Near the other `useState` declarations, add:
```tsx
const [menuOpen, setMenuOpen] = useState(false);
const [savingPreset, setSavingPreset] = useState(false);

const saveAsPreset = async () => {
  const name = window.prompt("Nome do bloco personalizado?");
  if (!name || !name.trim()) return;
  setSavingPreset(true);
  try {
    await fetch("/api/admin/block-presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), type: block.type, data: block.data }),
    });
    setMenuOpen(false);
  } finally {
    setSavingPreset(false);
  }
};
```

Inside the existing action-buttons `<div>` (the one with the move + remove buttons) in the header, add **before** the `✕` remove button:
```tsx
<div className="relative">
  <button
    type="button"
    onClick={() => setMenuOpen((v) => !v)}
    aria-label="Mais opções"
    className="rounded-lg p-1.5 text-ink-muted hover:bg-rosa-50 hover:text-rosa-500"
  >
    ⋯
  </button>
  {menuOpen && (
    <div role="menu" className="absolute right-0 top-full z-10 mt-1 w-56 rounded-xl border border-ink-line bg-white p-1 shadow-lg">
      <button
        role="menuitem"
        type="button"
        onClick={saveAsPreset}
        disabled={savingPreset}
        className="block w-full rounded-lg px-3 py-2 text-left text-xs text-ink-soft hover:bg-rosa-50 hover:text-rosa-500 disabled:opacity-40"
      >
        {savingPreset ? "A guardar…" : "Guardar como bloco personalizado"}
      </button>
    </div>
  )}
</div>
```

- [ ] **Step 4: Run tests**

Run: `npm test -- BlockCard`
Expected: all three tests (disabled-until-dirty, save-block, save-as-preset) pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/BlockCard.tsx src/components/admin/BlockCard.test.tsx
git commit -m "feat(admin): save block as preset from BlockCard overflow menu"
```

---

### Task 10: Wire `BlockPickerDialog` into `TemplateEditor` + `SlotEditor`

**Files:**
- Modify: `src/components/admin/TemplateEditor.tsx`
- Modify: `src/components/admin/SlotEditor.tsx`

- [ ] **Step 1: Read both editors**

Open `src/components/admin/TemplateEditor.tsx` and `src/components/admin/SlotEditor.tsx`. Locate each editor's existing inline picker (the `{showPicker ? <grid/> : <+button/>}` pattern).

- [ ] **Step 2: Replace each inline picker with the dialog**

In `TemplateEditor.tsx` — the component already knows its `kind`. Replace the inline picker with:
```tsx
<BlockPickerDialog
  open={showPicker}
  context={kind === "catalog" ? "template-catalog" : "template-product-detail"}
  onClose={() => setShowPicker(false)}
  onInsertBlockType={(type) => { addBlock(type); setShowPicker(false); }}
  onInsertPreset={(preset) => {
    const block = { id: crypto.randomUUID().slice(0, 10), type: preset.type, data: preset.data } as any;
    setBlocks((prev) => [...prev, block]);
    setShowPicker(false);
  }}
/>
```

Keep the `+ Adicionar bloco` button. Import at top:
```tsx
import BlockPickerDialog from "./BlockPickerDialog";
```

In `SlotEditor.tsx`, do the same with `context="page"` (slots don't get product context).

- [ ] **Step 3: Manual verification**

- `/admin/templates` → open a catalog template. "Adicionar bloco" opens the modal with general blocks + `catalog-grid-bound`.
- Open a product-detail template. Modal offers `product-*` block types.
- `/admin/slots` → modal shows general blocks only.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/TemplateEditor.tsx src/components/admin/SlotEditor.tsx
git commit -m "feat(admin): template + slot editors use BlockPickerDialog"
```

---

### Task 11: Manual end-to-end verification

- [ ] **Step 1: Walkthrough**

1. `npm run dev`.
2. Log in.
3. `/admin/pages/home` → click "+ Adicionar bloco" → modal opens with 13 illustration cards (page context).
4. Click "Hero" → iframe renders sample hero on the right.
5. Click Inserir → hero appended, iframe reloads, sidebar shows a new Hero card.
6. Edit the hero title → click Guardar bloco → change persists to draft.
7. Click the ⋯ menu on the Hero card → "Guardar como bloco personalizado" → enter "Hero home".
8. Click + Adicionar bloco → switch to "Meus blocos" → "Hero home" appears.
9. Click it → right-pane iframe shows the customized hero.
10. Click Inserir → a new Hero (same data, new id) is appended.
11. `/admin/templates` → open product-detail template. "Adicionar bloco" shows `product-*` blocks; "Meus blocos" tab does NOT show "Hero home" (filtered by context).
12. Delete the preset:
    ```bash
    curl -i -X DELETE 'http://localhost:4321/api/admin/block-presets/<id>' -b 'adriana-session=<session-jwt>'
    ```
    Reopen modal → preset gone.

- [ ] **Step 2: No commit (verification only).**

---

## Self-review checklist

- [ ] `npm test` green.
- [ ] `npm run check` green.
- [ ] `npm run build` succeeds.
- [ ] Spec coverage:
  - Visual picker with previews ✓ (Tasks 6, 7)
  - Live preview iframe for selected type ✓ (Task 4 route + Task 7 iframe)
  - Save block as preset ✓ (Task 9)
  - Presets tab + insertion ✓ (Tasks 7, 8)
  - Context-aware filtering ✓ (`blocksAllowedIn` in API + dialog)
  - `block_presets` schema + API ✓ (Tasks 1, 5)
- [ ] Placeholder scan: none.
- [ ] Type consistency: `Preset` type mirrors the DB row shape used by the API. `Context` values in the dialog match the query params accepted by the API.
