# Block-Based CMS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the limited markdown page editor with a block-based CMS that lets admins build any page using predefined block types (hero, text, product grid, category grid, image gallery, CTA banner, FAQ, contact info).

**Architecture:** JSONB `blocks` column on the existing `pages` table. Each block has a type and data object validated by Zod. A React `BlockEditor` component in the admin handles editing; Astro components in `src/components/blocks/` handle storefront rendering. A catch-all `[...slug].astro` route replaces individual page files.

**Tech Stack:** Astro 6 SSR, React 19, Drizzle ORM (PostgreSQL), Zod 4, Tailwind CSS 4, marked (for markdown blocks), nanoid (for block IDs).

**Spec:** `docs/superpowers/specs/2026-04-16-block-based-cms-design.md`

---

## File Structure

### New files
- `src/lib/blocks.ts` — Block type definitions, Zod schemas, default data factories
- `src/components/admin/BlockEditor.tsx` — Admin block editor React component
- `src/components/blocks/HeroBlock.astro` — Storefront hero block renderer
- `src/components/blocks/TextBlock.astro` — Storefront text/markdown block renderer
- `src/components/blocks/ProductGridBlock.astro` — Storefront product grid renderer
- `src/components/blocks/CategoryGridBlock.astro` — Storefront category grid renderer
- `src/components/blocks/ImageGalleryBlock.astro` — Storefront image gallery renderer
- `src/components/blocks/CtaBannerBlock.astro` — Storefront CTA banner renderer
- `src/components/blocks/FaqBlock.astro` — Storefront FAQ accordion renderer
- `src/components/blocks/ContactInfoBlock.astro` — Storefront contact info renderer
- `src/components/blocks/BlockRenderer.astro` — Dispatcher that renders a block by type
- `src/pages/[...slug].astro` — Catch-all CMS page route
- `src/pages/admin/pages/new.astro` — Admin page for creating new pages
- `src/pages/api/admin/pages/index.ts` — POST endpoint for creating pages
- `scripts/migrate-to-blocks.ts` — One-time migration script

### Modified files
- `src/db/schema.ts` — Add `blocks` and `published` columns to `pages` table
- `src/lib/queries.ts` — Add `getPublishedPage` query, update `getPage` return type
- `src/pages/api/admin/pages/[slug].ts` — Update PUT to accept blocks, add DELETE
- `src/pages/admin/pages/index.astro` — Add "New page" button, published status, delete
- `src/pages/admin/pages/[slug].astro` — Use BlockEditor instead of PageEditor

### Deleted files
- `src/pages/index.astro` — Replaced by catch-all with slug "home"
- `src/pages/sobre-nos.astro` — Replaced by catch-all
- `src/pages/como-encomendar.astro` — Replaced by catch-all
- `src/pages/termos-condicoes.astro` — Replaced by catch-all
- `src/components/Hero.astro` — Replaced by HeroBlock.astro
- `src/components/admin/PageEditor.tsx` — Replaced by BlockEditor.tsx

---

### Task 1: Add `nanoid` dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install nanoid**

```bash
npm install nanoid
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add nanoid dependency for block IDs"
```

---

### Task 2: Update database schema

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Add `blocks` and `published` columns to the `pages` table**

In `src/db/schema.ts`, replace the `pages` table definition:

```typescript
export const pages = pgTable("pages", {
  slug: text("slug").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  blocks: jsonb("blocks").$type<Block[]>().notNull().default([]),
  published: boolean("published").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
```

The `Block` type will be imported from `src/lib/blocks.ts` (created in Task 3). For now, use a temporary inline type — we'll fix the import after Task 3.

Actually, since `blocks.ts` doesn't exist yet, use a forward-compatible approach: define the column as `jsonb("blocks").notNull().default([])` without the `$type` for now. We'll add the type annotation in Task 3.

Replace the current pages definition:

```typescript
export const pages = pgTable("pages", {
  slug: text("slug").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  blocks: jsonb("blocks").notNull().default([]),
  published: boolean("published").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
```

- [ ] **Step 2: Add the `Page` type export update**

The existing `Page` type export (`export type Page = typeof pages.$inferSelect;`) will automatically pick up the new columns. No change needed.

- [ ] **Step 3: Generate the migration**

```bash
DATABASE_URL=postgresql://postgres:IkarZNWINRJiOEjQcXcgtpPhhXpUhHii@monorail.proxy.rlwy.net:13815/railway npm run db:generate
```

Review the generated SQL in `src/db/migrations/` — it should add `blocks` (jsonb, default `'[]'`) and `published` (boolean, default `true`) to the `pages` table.

- [ ] **Step 4: Run the migration**

```bash
DATABASE_URL=postgresql://postgres:IkarZNWINRJiOEjQcXcgtpPhhXpUhHii@monorail.proxy.rlwy.net:13815/railway npm run db:migrate
```

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts src/db/migrations/
git commit -m "feat: add blocks and published columns to pages table"
```

---

### Task 3: Create block type definitions and Zod schemas

**Files:**
- Create: `src/lib/blocks.ts`

- [ ] **Step 1: Create `src/lib/blocks.ts`**

```typescript
import { z } from "zod";
import { nanoid } from "nanoid";

// --- Block data schemas ---

const heroDataSchema = z.object({
  title: z.string().default(""),
  subtitle: z.string().default(""),
  buttonText: z.string().default(""),
  buttonUrl: z.string().default(""),
  imageUrl: z.string().default(""),
});

const textDataSchema = z.object({
  markdown: z.string().default(""),
});

const productGridDataSchema = z.object({
  title: z.string().default(""),
  subtitle: z.string().default(""),
  filter: z.string().default("bestsellers"), // "bestsellers" | "all" | "category:<slug>"
});

const categoryGridDataSchema = z.object({
  title: z.string().default(""),
  subtitle: z.string().default(""),
  categories: z.array(z.string()).default([]),
});

const imageGalleryDataSchema = z.object({
  images: z.array(z.object({
    url: z.string(),
    alt: z.string().default(""),
  })).default([]),
});

const ctaBannerDataSchema = z.object({
  title: z.string().default(""),
  subtitle: z.string().default(""),
  buttonText: z.string().default(""),
  buttonUrl: z.string().default(""),
  bgColor: z.enum(["rosa", "ink"]).default("ink"),
});

const faqDataSchema = z.object({
  title: z.string().default(""),
  items: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })).default([]),
});

const contactInfoDataSchema = z.object({
  email: z.string().default(""),
  whatsapp: z.string().default(""),
  instagram: z.string().default(""),
  address: z.string().default(""),
});

// --- Block schema (discriminated union) ---

const heroBlockSchema = z.object({
  id: z.string(),
  type: z.literal("hero"),
  data: heroDataSchema,
});

const textBlockSchema = z.object({
  id: z.string(),
  type: z.literal("text"),
  data: textDataSchema,
});

const productGridBlockSchema = z.object({
  id: z.string(),
  type: z.literal("product-grid"),
  data: productGridDataSchema,
});

const categoryGridBlockSchema = z.object({
  id: z.string(),
  type: z.literal("category-grid"),
  data: categoryGridDataSchema,
});

const imageGalleryBlockSchema = z.object({
  id: z.string(),
  type: z.literal("image-gallery"),
  data: imageGalleryDataSchema,
});

const ctaBannerBlockSchema = z.object({
  id: z.string(),
  type: z.literal("cta-banner"),
  data: ctaBannerDataSchema,
});

const faqBlockSchema = z.object({
  id: z.string(),
  type: z.literal("faq"),
  data: faqDataSchema,
});

const contactInfoBlockSchema = z.object({
  id: z.string(),
  type: z.literal("contact-info"),
  data: contactInfoDataSchema,
});

export const blockSchema = z.discriminatedUnion("type", [
  heroBlockSchema,
  textBlockSchema,
  productGridBlockSchema,
  categoryGridBlockSchema,
  imageGalleryBlockSchema,
  ctaBannerBlockSchema,
  faqBlockSchema,
  contactInfoBlockSchema,
]);

export const blocksArraySchema = z.array(blockSchema);

export type Block = z.infer<typeof blockSchema>;
export type BlockType = Block["type"];

export type HeroData = z.infer<typeof heroDataSchema>;
export type TextData = z.infer<typeof textDataSchema>;
export type ProductGridData = z.infer<typeof productGridDataSchema>;
export type CategoryGridData = z.infer<typeof categoryGridDataSchema>;
export type ImageGalleryData = z.infer<typeof imageGalleryDataSchema>;
export type CtaBannerData = z.infer<typeof ctaBannerDataSchema>;
export type FaqData = z.infer<typeof faqDataSchema>;
export type ContactInfoData = z.infer<typeof contactInfoDataSchema>;

// --- Block metadata for the admin picker ---

export const BLOCK_TYPES: Array<{ type: BlockType; label: string; description: string }> = [
  { type: "hero", label: "Hero", description: "Banner com titulo, subtitulo, botao e imagem" },
  { type: "text", label: "Texto", description: "Bloco de texto com suporte a Markdown" },
  { type: "product-grid", label: "Grelha de Produtos", description: "Mostra produtos (mais vendidos, por categoria, ou todos)" },
  { type: "category-grid", label: "Grelha de Categorias", description: "Mostra cartoes de categorias" },
  { type: "image-gallery", label: "Galeria de Imagens", description: "Grelha de imagens" },
  { type: "cta-banner", label: "Banner CTA", description: "Seccao colorida com texto e botao" },
  { type: "faq", label: "FAQ", description: "Perguntas e respostas em acordeao" },
  { type: "contact-info", label: "Contacto", description: "Email, WhatsApp, Instagram, morada" },
];

// --- Default data factories ---

export function createBlock(type: BlockType): Block {
  const id = nanoid(10);
  switch (type) {
    case "hero":
      return { id, type, data: { title: "", subtitle: "", buttonText: "", buttonUrl: "", imageUrl: "" } };
    case "text":
      return { id, type, data: { markdown: "" } };
    case "product-grid":
      return { id, type, data: { title: "", subtitle: "", filter: "bestsellers" } };
    case "category-grid":
      return { id, type, data: { title: "", subtitle: "", categories: [] } };
    case "image-gallery":
      return { id, type, data: { images: [] } };
    case "cta-banner":
      return { id, type, data: { title: "", subtitle: "", buttonText: "", buttonUrl: "", bgColor: "ink" } };
    case "faq":
      return { id, type, data: { title: "", items: [] } };
    case "contact-info":
      return { id, type, data: { email: "", whatsapp: "", instagram: "", address: "" } };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/blocks.ts
git commit -m "feat: add block type definitions, Zod schemas, and factories"
```

---

### Task 4: Update page queries

**Files:**
- Modify: `src/lib/queries.ts`

- [ ] **Step 1: Add `getPublishedPage` and `getProductsByCategory` queries**

Add these after the existing `getPage` function in `src/lib/queries.ts`:

```typescript
export const getPublishedPage = async (slug: string) => {
  const [page] = await db
    .select()
    .from(schema.pages)
    .where(and(eq(schema.pages.slug, slug), eq(schema.pages.published, true)))
    .limit(1);
  return page ?? null;
};

export const getProductsByCategory = async (
  category: string,
  limit = 8,
): Promise<ProductWithExtras[]> => {
  const rows = await db
    .select()
    .from(schema.products)
    .where(
      and(
        eq(schema.products.category, category as ProductCategorySlug),
        eq(schema.products.active, true),
      ),
    )
    .orderBy(asc(schema.products.sortOrder))
    .limit(limit);
  return attachExtras(rows);
};
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/queries.ts
git commit -m "feat: add getPublishedPage and getProductsByCategory queries"
```

---

### Task 5: Update pages API (PUT, POST, DELETE)

**Files:**
- Modify: `src/pages/api/admin/pages/[slug].ts`
- Create: `src/pages/api/admin/pages/index.ts`

- [ ] **Step 1: Update PUT endpoint in `src/pages/api/admin/pages/[slug].ts`**

Replace the entire file:

```typescript
import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../../../../db/client";
import { blocksArraySchema } from "../../../../lib/blocks";

export const prerender = false;

const UpdateSchema = z.object({
  title: z.string().min(1).max(200),
  blocks: blocksArraySchema,
  published: z.boolean(),
});

export const PUT: APIRoute = async ({ params, request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const slug = params.slug;
  if (!slug) {
    return new Response(JSON.stringify({ error: "Slug em falta" }), { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Dados invalidos", issues: parsed.error.format() }),
      { status: 400 },
    );
  }

  try {
    await db
      .update(schema.pages)
      .set({
        title: parsed.data.title,
        blocks: parsed.data.blocks,
        published: parsed.data.published,
        updatedAt: new Date(),
      })
      .where(eq(schema.pages.slug, slug));

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error("[pages] Falha a atualizar:", err);
    return new Response(JSON.stringify({ error: "Erro ao guardar" }), { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const slug = params.slug;
  if (!slug) {
    return new Response(JSON.stringify({ error: "Slug em falta" }), { status: 400 });
  }

  // Prevent deleting the homepage
  if (slug === "home") {
    return new Response(JSON.stringify({ error: "Nao podes apagar a homepage" }), { status: 400 });
  }

  try {
    await db.delete(schema.pages).where(eq(schema.pages.slug, slug));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error("[pages] Falha a apagar:", err);
    return new Response(JSON.stringify({ error: "Erro ao apagar" }), { status: 500 });
  }
};
```

- [ ] **Step 2: Create POST endpoint at `src/pages/api/admin/pages/index.ts`**

```typescript
import type { APIRoute } from "astro";
import { z } from "zod";
import { db, schema } from "../../../../db/client";
import { blocksArraySchema } from "../../../../lib/blocks";

export const prerender = false;

const CreateSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug invalido"),
  blocks: blocksArraySchema,
  published: z.boolean(),
});

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Dados invalidos", issues: parsed.error.format() }),
      { status: 400 },
    );
  }

  try {
    await db.insert(schema.pages).values({
      slug: parsed.data.slug,
      title: parsed.data.title,
      body: "",
      blocks: parsed.data.blocks,
      published: parsed.data.published,
    });

    return new Response(JSON.stringify({ success: true, slug: parsed.data.slug }), { status: 201 });
  } catch (err: any) {
    if (err?.code === "23505") {
      return new Response(JSON.stringify({ error: "Ja existe uma pagina com este slug" }), { status: 409 });
    }
    console.error("[pages] Falha a criar:", err);
    return new Response(JSON.stringify({ error: "Erro ao criar" }), { status: 500 });
  }
};
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/admin/pages/[slug].ts src/pages/api/admin/pages/index.ts
git commit -m "feat: update pages API with blocks support, add POST and DELETE"
```

---

### Task 6: Build the BlockEditor admin component

**Files:**
- Create: `src/components/admin/BlockEditor.tsx`

- [ ] **Step 1: Create `src/components/admin/BlockEditor.tsx`**

This is the largest single file. It contains:
- Page settings (title, slug, published toggle)
- Block list with collapsible panels
- Add/remove/reorder blocks
- Per-block type forms
- Save handler

```typescript
import { useState } from "react";
import { marked } from "marked";
import type { Block, BlockType } from "../../lib/blocks";
import { BLOCK_TYPES, createBlock } from "../../lib/blocks";

interface Props {
  slug: string;
  title: string;
  blocks: Block[];
  published: boolean;
  mode: "create" | "edit";
}

export default function BlockEditor({
  slug: initialSlug,
  title: initialTitle,
  blocks: initialBlocks,
  published: initialPublished,
  mode,
}: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [slug, setSlug] = useState(initialSlug);
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [published, setPublished] = useState(initialPublished);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [expandedBlock, setExpandedBlock] = useState<string | null>(
    initialBlocks[0]?.id ?? null,
  );
  const [showPicker, setShowPicker] = useState(false);

  const updateBlock = (id: string, data: any) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, data: { ...b.data, ...data } } : b)),
    );
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const moveBlock = (id: string, direction: "up" | "down") => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx === -1) return prev;
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
      return copy;
    });
  };

  const addBlock = (type: BlockType) => {
    const block = createBlock(type);
    setBlocks((prev) => [...prev, block]);
    setExpandedBlock(block.id);
    setShowPicker(false);
  };

  const autoSlug = (value: string) => {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (mode === "create") {
      setSlug(autoSlug(value));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const url =
        mode === "create" ? "/api/admin/pages" : `/api/admin/pages/${initialSlug}`;
      const method = mode === "create" ? "POST" : "PUT";
      const payload: any = { title, blocks, published };
      if (mode === "create") payload.slug = slug;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erro ${res.status}`);
      }

      if (mode === "create") {
        const data = await res.json();
        window.location.href = `/admin/pages/${data.slug}`;
        return;
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao guardar");
    } finally {
      setSaving(false);
    }
  };

  const blockLabel = (type: BlockType) =>
    BLOCK_TYPES.find((bt) => bt.type === type)?.label ?? type;

  return (
    <div className="grid gap-6">
      {/* Page settings */}
      <div className="rounded-3xl border border-ink-line bg-white p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="title">Titulo</label>
            <input
              id="title"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="field-input"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="slug">Slug (URL)</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-ink-muted">/</span>
              <input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="field-input"
                readOnly={mode === "edit"}
              />
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              className="h-4 w-4 rounded border-ink-line text-rosa-500 focus:ring-rosa-500"
            />
            Publicado
          </label>
        </div>
      </div>

      {/* Block list */}
      <div className="grid gap-4">
        {blocks.map((block, idx) => (
          <div
            key={block.id}
            className="rounded-3xl border border-ink-line bg-white"
          >
            {/* Block header */}
            <div
              className="flex cursor-pointer items-center justify-between px-6 py-4"
              onClick={() =>
                setExpandedBlock(expandedBlock === block.id ? null : block.id)
              }
            >
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-rosa-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-rosa-600">
                  {blockLabel(block.type)}
                </span>
                <span className="text-xs text-ink-muted">
                  {expandedBlock === block.id ? "▼" : "▶"}
                </span>
              </div>
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => moveBlock(block.id, "up")}
                  disabled={idx === 0}
                  className="rounded-lg p-1.5 text-ink-muted hover:bg-rosa-50 hover:text-rosa-500 disabled:opacity-30"
                  title="Mover para cima"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveBlock(block.id, "down")}
                  disabled={idx === blocks.length - 1}
                  className="rounded-lg p-1.5 text-ink-muted hover:bg-rosa-50 hover:text-rosa-500 disabled:opacity-30"
                  title="Mover para baixo"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeBlock(block.id)}
                  className="rounded-lg p-1.5 text-ink-muted hover:bg-red-50 hover:text-red-500"
                  title="Remover bloco"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Block form (expanded) */}
            {expandedBlock === block.id && (
              <div className="border-t border-ink-line px-6 py-5">
                <BlockForm block={block} onChange={(data) => updateBlock(block.id, data)} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add block button / picker */}
      {showPicker ? (
        <div className="rounded-3xl border border-dashed border-rosa-300 bg-rosa-50/60 p-6">
          <h4 className="mb-4 text-sm font-semibold text-ink">Adicionar bloco</h4>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {BLOCK_TYPES.map((bt) => (
              <button
                key={bt.type}
                type="button"
                onClick={() => addBlock(bt.type)}
                className="rounded-2xl border border-ink-line bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-rosa-300 hover:shadow"
              >
                <span className="text-sm font-semibold text-ink">{bt.label}</span>
                <p className="mt-1 text-[11px] text-ink-muted">{bt.description}</p>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowPicker(false)}
            className="mt-4 text-xs text-ink-muted hover:text-rosa-500"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="w-full rounded-3xl border border-dashed border-ink-line p-4 text-sm text-ink-muted transition hover:border-rosa-300 hover:text-rosa-500"
        >
          + Adicionar bloco
        </button>
      )}

      {/* Save bar */}
      <div className="flex items-center justify-between">
        <div>
          {error && <p className="text-xs text-rosa-600">{error}</p>}
          {success && <p className="text-xs text-emerald-600">Guardado!</p>}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-primary"
        >
          {saving ? "A guardar..." : mode === "create" ? "Criar pagina" : "Guardar alteracoes"}
        </button>
      </div>
    </div>
  );
}

// --- Per-block-type forms ---

function BlockForm({ block, onChange }: { block: Block; onChange: (data: any) => void }) {
  switch (block.type) {
    case "hero":
      return <HeroForm data={block.data} onChange={onChange} />;
    case "text":
      return <TextForm data={block.data} onChange={onChange} />;
    case "product-grid":
      return <ProductGridForm data={block.data} onChange={onChange} />;
    case "category-grid":
      return <CategoryGridForm data={block.data} onChange={onChange} />;
    case "image-gallery":
      return <ImageGalleryForm data={block.data} onChange={onChange} />;
    case "cta-banner":
      return <CtaBannerForm data={block.data} onChange={onChange} />;
    case "faq":
      return <FaqForm data={block.data} onChange={onChange} />;
    case "contact-info":
      return <ContactInfoForm data={block.data} onChange={onChange} />;
  }
}

function HeroForm({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  return (
    <div className="grid gap-4">
      <div>
        <label className="field-label">Titulo</label>
        <input value={data.title} onChange={(e) => onChange({ title: e.target.value })} className="field-input" />
      </div>
      <div>
        <label className="field-label">Subtitulo</label>
        <input value={data.subtitle} onChange={(e) => onChange({ subtitle: e.target.value })} className="field-input" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="field-label">Texto do botao</label>
          <input value={data.buttonText} onChange={(e) => onChange({ buttonText: e.target.value })} className="field-input" />
        </div>
        <div>
          <label className="field-label">URL do botao</label>
          <input value={data.buttonUrl} onChange={(e) => onChange({ buttonUrl: e.target.value })} className="field-input" />
        </div>
      </div>
      <div>
        <label className="field-label">URL da imagem</label>
        <input value={data.imageUrl} onChange={(e) => onChange({ imageUrl: e.target.value })} className="field-input" />
      </div>
    </div>
  );
}

function TextForm({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const html = marked.parse(data.markdown || "", { async: false }) as string;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <label className="field-label">Conteudo (Markdown)</label>
        <textarea
          value={data.markdown}
          onChange={(e) => onChange({ markdown: e.target.value })}
          rows={16}
          className="mt-2 w-full resize-y rounded-xl border border-ink-line bg-white p-4 font-mono text-xs leading-relaxed"
        />
      </div>
      <div>
        <span className="field-label">Preview</span>
        <article
          className="prose prose-sm mt-2 max-w-none text-ink-soft"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}

const CATEGORIES = [
  { value: "tote-bags", label: "Tote Bags" },
  { value: "t-shirts", label: "T-Shirts" },
  { value: "necessaire", label: "Bolsas Necessaire" },
  { value: "frascos-vidro", label: "Frascos de Vidro" },
  { value: "porta-chaves", label: "Porta-Chaves" },
  { value: "capas-telemovel", label: "Capas de Telemovel" },
  { value: "garrafas", label: "Garrafas de Agua" },
  { value: "porta-joias", label: "Porta-Joias" },
];

function ProductGridForm({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  return (
    <div className="grid gap-4">
      <div>
        <label className="field-label">Titulo</label>
        <input value={data.title} onChange={(e) => onChange({ title: e.target.value })} className="field-input" />
      </div>
      <div>
        <label className="field-label">Subtitulo</label>
        <input value={data.subtitle} onChange={(e) => onChange({ subtitle: e.target.value })} className="field-input" />
      </div>
      <div>
        <label className="field-label">Filtro</label>
        <select
          value={data.filter}
          onChange={(e) => onChange({ filter: e.target.value })}
          className="field-input"
        >
          <option value="bestsellers">Mais vendidos</option>
          <option value="all">Todos</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={`category:${c.value}`}>
              Categoria: {c.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function CategoryGridForm({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const toggleCategory = (slug: string) => {
    const current: string[] = data.categories ?? [];
    const next = current.includes(slug)
      ? current.filter((c: string) => c !== slug)
      : [...current, slug];
    onChange({ categories: next });
  };

  return (
    <div className="grid gap-4">
      <div>
        <label className="field-label">Titulo</label>
        <input value={data.title} onChange={(e) => onChange({ title: e.target.value })} className="field-input" />
      </div>
      <div>
        <label className="field-label">Subtitulo</label>
        <input value={data.subtitle} onChange={(e) => onChange({ subtitle: e.target.value })} className="field-input" />
      </div>
      <div>
        <label className="field-label">Categorias</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <label
              key={c.value}
              className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                (data.categories ?? []).includes(c.value)
                  ? "border-rosa-300 bg-rosa-100 text-rosa-600"
                  : "border-ink-line bg-white text-ink-muted hover:border-rosa-200"
              }`}
            >
              <input
                type="checkbox"
                checked={(data.categories ?? []).includes(c.value)}
                onChange={() => toggleCategory(c.value)}
                className="sr-only"
              />
              {c.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function ImageGalleryForm({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const images: Array<{ url: string; alt: string }> = data.images ?? [];
  const [newUrl, setNewUrl] = useState("");

  const addImage = () => {
    if (!newUrl.trim()) return;
    onChange({ images: [...images, { url: newUrl.trim(), alt: "" }] });
    setNewUrl("");
  };

  const removeImage = (idx: number) => {
    onChange({ images: images.filter((_, i) => i !== idx) });
  };

  const updateAlt = (idx: number, alt: string) => {
    onChange({ images: images.map((img, i) => (i === idx ? { ...img, alt } : img)) });
  };

  const moveImage = (idx: number, direction: "up" | "down") => {
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= images.length) return;
    const copy = [...images];
    [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
    onChange({ images: copy });
  };

  const handleUpload = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
    if (!res.ok) return;
    const { url } = await res.json();
    onChange({ images: [...images, { url, alt: "" }] });
  };

  return (
    <div className="grid gap-4">
      <label className="field-label">Imagens</label>
      {images.map((img, idx) => (
        <div key={idx} className="flex items-center gap-3 rounded-xl border border-ink-line bg-white p-3">
          <img src={img.url} alt={img.alt} className="h-16 w-16 rounded-lg object-cover" />
          <input
            value={img.alt}
            onChange={(e) => updateAlt(idx, e.target.value)}
            placeholder="Texto alternativo"
            className="field-input flex-1"
          />
          <button type="button" onClick={() => moveImage(idx, "up")} disabled={idx === 0} className="text-ink-muted hover:text-rosa-500 disabled:opacity-30">↑</button>
          <button type="button" onClick={() => moveImage(idx, "down")} disabled={idx === images.length - 1} className="text-ink-muted hover:text-rosa-500 disabled:opacity-30">↓</button>
          <button type="button" onClick={() => removeImage(idx)} className="text-ink-muted hover:text-red-500">✕</button>
        </div>
      ))}
      <div className="flex gap-2">
        <input
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          placeholder="URL da imagem"
          className="field-input flex-1"
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addImage())}
        />
        <button type="button" onClick={addImage} className="btn-secondary">Adicionar URL</button>
        <label className="btn-secondary cursor-pointer">
          Upload
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
          />
        </label>
      </div>
    </div>
  );
}

function CtaBannerForm({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  return (
    <div className="grid gap-4">
      <div>
        <label className="field-label">Titulo</label>
        <input value={data.title} onChange={(e) => onChange({ title: e.target.value })} className="field-input" />
      </div>
      <div>
        <label className="field-label">Subtitulo</label>
        <textarea value={data.subtitle} onChange={(e) => onChange({ subtitle: e.target.value })} rows={3} className="field-input" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="field-label">Texto do botao</label>
          <input value={data.buttonText} onChange={(e) => onChange({ buttonText: e.target.value })} className="field-input" />
        </div>
        <div>
          <label className="field-label">URL do botao</label>
          <input value={data.buttonUrl} onChange={(e) => onChange({ buttonUrl: e.target.value })} className="field-input" />
        </div>
      </div>
      <div>
        <label className="field-label">Cor de fundo</label>
        <div className="mt-2 flex gap-3">
          {(["ink", "rosa"] as const).map((color) => (
            <label
              key={color}
              className={`flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition ${
                data.bgColor === color
                  ? "border-rosa-300 bg-rosa-100 text-rosa-600"
                  : "border-ink-line bg-white text-ink-muted"
              }`}
            >
              <input
                type="radio"
                name="bgColor"
                value={color}
                checked={data.bgColor === color}
                onChange={() => onChange({ bgColor: color })}
                className="sr-only"
              />
              <span className={`h-4 w-4 rounded-full ${color === "ink" ? "bg-ink" : "bg-rosa-400"}`} />
              {color === "ink" ? "Escuro" : "Rosa"}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function FaqForm({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const items: Array<{ question: string; answer: string }> = data.items ?? [];

  const addItem = () => {
    onChange({ items: [...items, { question: "", answer: "" }] });
  };

  const removeItem = (idx: number) => {
    onChange({ items: items.filter((_, i) => i !== idx) });
  };

  const updateItem = (idx: number, field: "question" | "answer", value: string) => {
    onChange({ items: items.map((item, i) => (i === idx ? { ...item, [field]: value } : item)) });
  };

  return (
    <div className="grid gap-4">
      <div>
        <label className="field-label">Titulo</label>
        <input value={data.title} onChange={(e) => onChange({ title: e.target.value })} className="field-input" />
      </div>
      <label className="field-label">Perguntas & Respostas</label>
      {items.map((item, idx) => (
        <div key={idx} className="grid gap-2 rounded-xl border border-ink-line bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">#{idx + 1}</span>
            <button type="button" onClick={() => removeItem(idx)} className="text-xs text-ink-muted hover:text-red-500">Remover</button>
          </div>
          <input
            value={item.question}
            onChange={(e) => updateItem(idx, "question", e.target.value)}
            placeholder="Pergunta"
            className="field-input"
          />
          <textarea
            value={item.answer}
            onChange={(e) => updateItem(idx, "answer", e.target.value)}
            placeholder="Resposta"
            rows={3}
            className="field-input"
          />
        </div>
      ))}
      <button type="button" onClick={addItem} className="btn-secondary w-fit">
        + Adicionar pergunta
      </button>
    </div>
  );
}

function ContactInfoForm({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <label className="field-label">Email</label>
        <input value={data.email} onChange={(e) => onChange({ email: e.target.value })} className="field-input" />
      </div>
      <div>
        <label className="field-label">WhatsApp</label>
        <input value={data.whatsapp} onChange={(e) => onChange({ whatsapp: e.target.value })} className="field-input" />
      </div>
      <div>
        <label className="field-label">Instagram</label>
        <input value={data.instagram} onChange={(e) => onChange({ instagram: e.target.value })} className="field-input" />
      </div>
      <div>
        <label className="field-label">Morada</label>
        <input value={data.address} onChange={(e) => onChange({ address: e.target.value })} className="field-input" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/BlockEditor.tsx
git commit -m "feat: add BlockEditor admin component with all block type forms"
```

---

### Task 7: Update admin pages list and editor pages

**Files:**
- Modify: `src/pages/admin/pages/index.astro`
- Modify: `src/pages/admin/pages/[slug].astro`
- Create: `src/pages/admin/pages/new.astro`

- [ ] **Step 1: Update `src/pages/admin/pages/index.astro`**

Replace the entire file:

```astro
---
import AdminLayout from "../../../layouts/AdminLayout.astro";
import { db, schema } from "../../../db/client";

const user = Astro.locals.user;
if (!user) return Astro.redirect("/admin/login");

const allPages = await db.select().from(schema.pages);
---

<AdminLayout title="Paginas" user={user}>
  <div class="flex items-center justify-between">
    <p class="text-sm text-ink-soft">
      Gere as paginas do site. Adiciona blocos, edita conteudo, publica ou despublica.
    </p>
    <a href="/admin/pages/new" class="btn-primary">+ Nova pagina</a>
  </div>

  <div class="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
    {allPages.map((p) => (
      <a
        href={`/admin/pages/${p.slug}`}
        class="group rounded-3xl border border-ink-line bg-white p-6 transition hover:-translate-y-0.5 hover:border-rosa-300"
      >
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-semibold uppercase tracking-wide text-rosa-500">
            /{p.slug}
          </span>
          <span class={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${p.published ? "bg-emerald-100 text-emerald-700" : "bg-ink-line text-ink-muted"}`}>
            {p.published ? "Publicado" : "Rascunho"}
          </span>
        </div>
        <h3 class="mt-2 text-lg font-semibold text-ink group-hover:text-rosa-500">
          {p.title}
        </h3>
        <p class="mt-2 text-xs text-ink-muted">
          {(p.blocks as any[])?.length ?? 0} blocos · Ultima edicao: {new Date(p.updatedAt).toLocaleDateString("pt-PT")}
        </p>
      </a>
    ))}
  </div>
</AdminLayout>
```

- [ ] **Step 2: Update `src/pages/admin/pages/[slug].astro`**

Replace the entire file:

```astro
---
import AdminLayout from "../../../layouts/AdminLayout.astro";
import BlockEditor from "../../../components/admin/BlockEditor.tsx";
import { getPage } from "../../../lib/queries";

const user = Astro.locals.user;
if (!user) return Astro.redirect("/admin/login");

const { slug } = Astro.params;
if (!slug) return Astro.redirect("/admin/pages");

const page = await getPage(slug);
if (!page) {
  return new Response("Pagina nao encontrada", { status: 404 });
}

const blocks = (page.blocks ?? []) as any[];
---

<AdminLayout title={`Editar: ${page.title}`} user={user}>
  <div class="mb-6 flex items-center justify-between">
    <a href="/admin/pages" class="text-xs text-ink-muted hover:text-rosa-500">
      ← Todas as paginas
    </a>
    <a
      href={`/${slug === "home" ? "" : slug}`}
      target="_blank"
      rel="noopener"
      class="text-xs text-ink-muted hover:text-rosa-500"
    >
      Ver no site →
    </a>
  </div>

  <BlockEditor
    client:load
    slug={slug}
    title={page.title}
    blocks={blocks}
    published={page.published}
    mode="edit"
  />
</AdminLayout>
```

- [ ] **Step 3: Create `src/pages/admin/pages/new.astro`**

```astro
---
import AdminLayout from "../../../layouts/AdminLayout.astro";
import BlockEditor from "../../../components/admin/BlockEditor.tsx";

const user = Astro.locals.user;
if (!user) return Astro.redirect("/admin/login");
---

<AdminLayout title="Nova Pagina" user={user}>
  <div class="mb-6">
    <a href="/admin/pages" class="text-xs text-ink-muted hover:text-rosa-500">
      ← Todas as paginas
    </a>
  </div>

  <BlockEditor
    client:load
    slug=""
    title=""
    blocks={[]}
    published={false}
    mode="create"
  />
</AdminLayout>
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/pages/index.astro src/pages/admin/pages/[slug].astro src/pages/admin/pages/new.astro
git commit -m "feat: update admin pages UI to use BlockEditor, add new page creation"
```

---

### Task 8: Create storefront block renderer components

**Files:**
- Create: `src/components/blocks/BlockRenderer.astro`
- Create: `src/components/blocks/HeroBlock.astro`
- Create: `src/components/blocks/TextBlock.astro`
- Create: `src/components/blocks/ProductGridBlock.astro`
- Create: `src/components/blocks/CategoryGridBlock.astro`
- Create: `src/components/blocks/ImageGalleryBlock.astro`
- Create: `src/components/blocks/CtaBannerBlock.astro`
- Create: `src/components/blocks/FaqBlock.astro`
- Create: `src/components/blocks/ContactInfoBlock.astro`

- [ ] **Step 1: Create `src/components/blocks/BlockRenderer.astro`**

```astro
---
import HeroBlock from "./HeroBlock.astro";
import TextBlock from "./TextBlock.astro";
import ProductGridBlock from "./ProductGridBlock.astro";
import CategoryGridBlock from "./CategoryGridBlock.astro";
import ImageGalleryBlock from "./ImageGalleryBlock.astro";
import CtaBannerBlock from "./CtaBannerBlock.astro";
import FaqBlock from "./FaqBlock.astro";
import ContactInfoBlock from "./ContactInfoBlock.astro";

interface Props {
  block: { type: string; data: any };
}

const { block } = Astro.props;
---

{block.type === "hero" && <HeroBlock data={block.data} />}
{block.type === "text" && <TextBlock data={block.data} />}
{block.type === "product-grid" && <ProductGridBlock data={block.data} />}
{block.type === "category-grid" && <CategoryGridBlock data={block.data} />}
{block.type === "image-gallery" && <ImageGalleryBlock data={block.data} />}
{block.type === "cta-banner" && <CtaBannerBlock data={block.data} />}
{block.type === "faq" && <FaqBlock data={block.data} />}
{block.type === "contact-info" && <ContactInfoBlock data={block.data} />}
```

- [ ] **Step 2: Create `src/components/blocks/HeroBlock.astro`**

Based on the existing `src/components/Hero.astro` design:

```astro
---
interface Props {
  data: {
    title: string;
    subtitle: string;
    buttonText: string;
    buttonUrl: string;
    imageUrl: string;
  };
}

const { data } = Astro.props;
---

<section class="relative overflow-hidden bg-white">
  <div class="absolute inset-0">
    <div class="absolute -left-24 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-rosa-200 opacity-50 blur-3xl"></div>
    <div class="absolute -right-32 top-16 h-96 w-96 rounded-full bg-rosa-100 opacity-60 blur-3xl"></div>
  </div>

  <div class="section relative grid gap-12 py-20 md:grid-cols-2 md:py-28 lg:py-32">
    <div class="flex flex-col justify-center">
      {data.title && (
        <h1 class="text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl lg:text-6xl" set:html={data.title} />
      )}

      {data.subtitle && (
        <p class="mt-6 max-w-lg text-base leading-relaxed text-ink-soft sm:text-lg">
          {data.subtitle}
        </p>
      )}

      {data.buttonText && data.buttonUrl && (
        <div class="mt-10">
          <a href={data.buttonUrl} class="btn-primary">
            {data.buttonText}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </a>
        </div>
      )}
    </div>

    {data.imageUrl && (
      <div class="relative hidden md:block">
        <div class="relative mx-auto aspect-[4/5] w-full max-w-lg">
          <div class="absolute inset-0 rounded-[40px] bg-rosa-100"></div>
          <div class="absolute inset-6 overflow-hidden rounded-[32px] border-8 border-white bg-white shadow-2xl">
            <img src={data.imageUrl} alt={data.title} class="h-full w-full object-cover" />
          </div>
        </div>
      </div>
    )}
  </div>
</section>
```

- [ ] **Step 3: Create `src/components/blocks/TextBlock.astro`**

```astro
---
import { marked } from "marked";

interface Props {
  data: { markdown: string };
}

const { data } = Astro.props;
const html = data.markdown ? (marked.parse(data.markdown, { async: false }) as string) : "";
---

{html && (
  <section class="py-16">
    <div class="section max-w-3xl">
      <article class="prose prose-sm max-w-none text-ink-soft sm:prose-base" set:html={html} />
    </div>
  </section>
)}
```

- [ ] **Step 4: Create `src/components/blocks/ProductGridBlock.astro`**

```astro
---
import ProductCard from "../ProductCard.astro";
import { getBestsellers, getActiveProducts } from "../../lib/queries";
import { getProductsByCategory } from "../../lib/queries";

interface Props {
  data: { title: string; subtitle: string; filter: string };
}

const { data } = Astro.props;

let products;
if (data.filter === "bestsellers") {
  products = await getBestsellers(8);
} else if (data.filter === "all") {
  products = await getActiveProducts();
} else if (data.filter.startsWith("category:")) {
  const category = data.filter.replace("category:", "");
  products = await getProductsByCategory(category, 8);
} else {
  products = await getBestsellers(8);
}
---

<section class="py-20">
  <div class="section">
    {(data.title || data.subtitle) && (
      <div class="mb-12">
        {data.title && <h2 class="text-3xl font-semibold text-ink sm:text-4xl">{data.title}</h2>}
        {data.subtitle && <p class="mt-3 max-w-lg text-sm text-ink-soft">{data.subtitle}</p>}
      </div>
    )}

    {products.length === 0 ? (
      <div class="rounded-3xl border border-dashed border-ink-line bg-rosa-50/60 p-10 text-center text-sm text-ink-soft">
        Sem produtos para mostrar.
      </div>
    ) : (
      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((p) => (
          <ProductCard
            slug={p.slug}
            name={p.name}
            price={p.priceCents / 100}
            image={p.images[0]?.url ?? "/placeholders/product.svg"}
            category={p.category}
            bestseller={p.bestseller}
          />
        ))}
      </div>
    )}
  </div>
</section>
```

- [ ] **Step 5: Create `src/components/blocks/CategoryGridBlock.astro`**

```astro
---
import { categories } from "../../lib/site";

interface Props {
  data: { title: string; subtitle: string; categories: string[] };
}

const { data } = Astro.props;
const selectedCategories = data.categories.length > 0
  ? categories.filter((c) => data.categories.includes(c.slug))
  : categories.slice(0, 4);
---

<section class="bg-rosa-50/60 py-20">
  <div class="section">
    {(data.title || data.subtitle) && (
      <div class="mb-12 text-center">
        {data.title && <h2 class="text-3xl font-semibold text-ink sm:text-4xl">{data.title}</h2>}
        {data.subtitle && <p class="mt-3 mx-auto max-w-lg text-sm text-ink-soft">{data.subtitle}</p>}
      </div>
    )}

    <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
      {selectedCategories.map((c) => (
        <a
          href={`/catalogo?categoria=${c.slug}`}
          class="group flex flex-col items-center rounded-3xl border border-ink-line bg-white p-6 text-center transition hover:-translate-y-0.5 hover:border-rosa-300 hover:shadow-lg"
        >
          <div class="flex h-20 w-20 items-center justify-center rounded-full bg-rosa-100 text-2xl text-rosa-500 transition group-hover:bg-rosa-400 group-hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="h-8 w-8">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <span class="mt-4 text-sm font-semibold text-ink">{c.label}</span>
        </a>
      ))}
    </div>
  </div>
</section>
```

- [ ] **Step 6: Create `src/components/blocks/ImageGalleryBlock.astro`**

```astro
---
interface Props {
  data: { images: Array<{ url: string; alt: string }> };
}

const { data } = Astro.props;
---

{data.images.length > 0 && (
  <section class="py-16">
    <div class="section">
      <div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {data.images.map((img) => (
          <div class="aspect-square overflow-hidden rounded-2xl bg-rosa-50">
            <img src={img.url} alt={img.alt} loading="lazy" class="h-full w-full object-cover" />
          </div>
        ))}
      </div>
    </div>
  </section>
)}
```

- [ ] **Step 7: Create `src/components/blocks/CtaBannerBlock.astro`**

```astro
---
interface Props {
  data: {
    title: string;
    subtitle: string;
    buttonText: string;
    buttonUrl: string;
    bgColor: "rosa" | "ink";
  };
}

const { data } = Astro.props;
const isInk = data.bgColor === "ink";
---

<section class="py-20">
  <div class="section">
    <div class={`rounded-[40px] px-8 py-16 text-center md:px-16 ${isInk ? "bg-ink text-white" : "bg-rosa-100 text-ink"}`}>
      {data.title && (
        <h2 class={`text-3xl font-semibold leading-tight sm:text-4xl ${isInk ? "text-white" : "text-ink"}`}>
          {data.title}
        </h2>
      )}
      {data.subtitle && (
        <p class={`mt-5 mx-auto max-w-xl text-sm leading-relaxed ${isInk ? "text-white/70" : "text-ink-soft"}`}>
          {data.subtitle}
        </p>
      )}
      {data.buttonText && data.buttonUrl && (
        <a
          href={data.buttonUrl}
          class={`mt-8 inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-medium transition ${
            isInk
              ? "border-white/20 text-white hover:border-rosa-300 hover:text-rosa-300"
              : "border-rosa-300 text-rosa-600 hover:bg-rosa-200"
          }`}
        >
          {data.buttonText}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </a>
      )}
    </div>
  </div>
</section>
```

- [ ] **Step 8: Create `src/components/blocks/FaqBlock.astro`**

```astro
---
interface Props {
  data: {
    title: string;
    items: Array<{ question: string; answer: string }>;
  };
}

const { data } = Astro.props;
---

{data.items.length > 0 && (
  <section class="py-16">
    <div class="section max-w-3xl">
      {data.title && <h2 class="mb-8 text-3xl font-semibold text-ink sm:text-4xl">{data.title}</h2>}
      <div class="grid gap-3">
        {data.items.map((item) => (
          <details class="group rounded-2xl border border-ink-line bg-white">
            <summary class="flex cursor-pointer items-center justify-between px-6 py-4 text-sm font-semibold text-ink">
              {item.question}
              <span class="ml-4 text-ink-muted transition group-open:rotate-180">▼</span>
            </summary>
            <div class="border-t border-ink-line px-6 py-4 text-sm leading-relaxed text-ink-soft">
              {item.answer}
            </div>
          </details>
        ))}
      </div>
    </div>
  </section>
)}
```

- [ ] **Step 9: Create `src/components/blocks/ContactInfoBlock.astro`**

```astro
---
interface Props {
  data: {
    email: string;
    whatsapp: string;
    instagram: string;
    address: string;
  };
}

const { data } = Astro.props;
const hasContent = data.email || data.whatsapp || data.instagram || data.address;
---

{hasContent && (
  <section class="py-16">
    <div class="section max-w-3xl">
      <div class="grid gap-6 sm:grid-cols-2">
        {data.email && (
          <a href={`mailto:${data.email}`} class="flex items-center gap-4 rounded-2xl border border-ink-line bg-white p-5 transition hover:border-rosa-300">
            <span class="flex h-10 w-10 items-center justify-center rounded-full bg-rosa-100 text-rosa-500">@</span>
            <div>
              <span class="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Email</span>
              <p class="text-sm font-medium text-ink">{data.email}</p>
            </div>
          </a>
        )}
        {data.whatsapp && (
          <a href={`https://wa.me/${data.whatsapp.replace(/[^0-9+]/g, "")}`} class="flex items-center gap-4 rounded-2xl border border-ink-line bg-white p-5 transition hover:border-rosa-300">
            <span class="flex h-10 w-10 items-center justify-center rounded-full bg-rosa-100 text-rosa-500">W</span>
            <div>
              <span class="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">WhatsApp</span>
              <p class="text-sm font-medium text-ink">{data.whatsapp}</p>
            </div>
          </a>
        )}
        {data.instagram && (
          <a href={`https://instagram.com/${data.instagram.replace("@", "")}`} class="flex items-center gap-4 rounded-2xl border border-ink-line bg-white p-5 transition hover:border-rosa-300">
            <span class="flex h-10 w-10 items-center justify-center rounded-full bg-rosa-100 text-rosa-500">IG</span>
            <div>
              <span class="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Instagram</span>
              <p class="text-sm font-medium text-ink">{data.instagram}</p>
            </div>
          </a>
        )}
        {data.address && (
          <div class="flex items-center gap-4 rounded-2xl border border-ink-line bg-white p-5">
            <span class="flex h-10 w-10 items-center justify-center rounded-full bg-rosa-100 text-rosa-500">M</span>
            <div>
              <span class="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Morada</span>
              <p class="text-sm font-medium text-ink">{data.address}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  </section>
)}
```

- [ ] **Step 10: Commit**

```bash
git add src/components/blocks/
git commit -m "feat: add all storefront block renderer components"
```

---

### Task 9: Create catch-all CMS page route and remove old page files

**Files:**
- Create: `src/pages/[...slug].astro`
- Delete: `src/pages/index.astro`
- Delete: `src/pages/sobre-nos.astro`
- Delete: `src/pages/como-encomendar.astro`
- Delete: `src/pages/termos-condicoes.astro`
- Delete: `src/components/Hero.astro`
- Delete: `src/components/admin/PageEditor.tsx`

- [ ] **Step 1: Create `src/pages/[...slug].astro`**

```astro
---
import BaseLayout from "../layouts/BaseLayout.astro";
import BlockRenderer from "../components/blocks/BlockRenderer.astro";
import { getPublishedPage } from "../lib/queries";

export const prerender = false;

const slugParts = Astro.params.slug;
const slug = slugParts || "home";

// Don't catch routes that belong to other pages
const reserved = ["catalogo", "carrinho", "checkout", "obrigado", "admin", "api"];
if (reserved.some((r) => slug === r || slug.startsWith(r + "/"))) {
  return new Response(null, { status: 404 });
}

const page = await getPublishedPage(slug);
if (!page) {
  return new Response(null, { status: 404 });
}

const blocks = (page.blocks ?? []) as Array<{ type: string; data: any }>;
---

<BaseLayout title={slug === "home" ? undefined : page.title}>
  {blocks.map((block) => (
    <BlockRenderer block={block} />
  ))}
</BaseLayout>
```

- [ ] **Step 2: Delete old page files**

```bash
rm src/pages/index.astro
rm src/pages/sobre-nos.astro
rm src/pages/como-encomendar.astro
rm src/pages/termos-condicoes.astro
rm src/components/Hero.astro
rm src/components/admin/PageEditor.tsx
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add catch-all CMS route, remove hardcoded page files"
```

---

### Task 10: Create migration script and run it

**Files:**
- Create: `scripts/migrate-to-blocks.ts`

- [ ] **Step 1: Create `scripts/migrate-to-blocks.ts`**

This script converts existing pages and creates the homepage:

```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, sql as drizzleSql } from "drizzle-orm";
import { nanoid } from "nanoid";
import * as schema from "../src/db/schema";

const url = process.env.DATABASE_URL ?? process.env.DATABASE_PUBLIC_URL;
if (!url) {
  console.error("DATABASE_URL nao configurado");
  process.exit(1);
}

const client = postgres(url, { max: 1, prepare: false });
const db = drizzle(client, { schema });

const main = async () => {
  try {
    // 1. Convert existing pages (body markdown -> text block)
    console.log("Converting existing pages to blocks...");
    const existingPages = await db.select().from(schema.pages);

    for (const page of existingPages) {
      if (page.slug === "home") {
        console.log(`  · ${page.slug} (homepage, skip)`);
        continue;
      }

      const blocks = (page.blocks as any[]) ?? [];
      if (blocks.length > 0) {
        console.log(`  · ${page.slug} (already has blocks, skip)`);
        continue;
      }

      if (page.body && page.body.trim()) {
        const textBlock = {
          id: nanoid(10),
          type: "text",
          data: { markdown: page.body },
        };

        await db
          .update(schema.pages)
          .set({ blocks: [textBlock] })
          .where(eq(schema.pages.slug, page.slug));

        console.log(`  ✔ ${page.slug} (converted body to text block)`);
      } else {
        console.log(`  · ${page.slug} (empty body, skip)`);
      }
    }

    // 2. Create homepage if it doesn't exist
    const [existingHome] = await db
      .select()
      .from(schema.pages)
      .where(eq(schema.pages.slug, "home"))
      .limit(1);

    if (existingHome) {
      console.log("  · home (already exists, skip)");
    } else {
      console.log("Creating homepage...");

      const homeBlocks = [
        {
          id: nanoid(10),
          type: "hero",
          data: {
            title: 'Pecas unicas,<br /><span class="text-rosa-500">feitas para ti.</span>',
            subtitle:
              "Pecas personalizadas com carinho. T-shirts, tote bags, bolsas e acessorios personalizados a mao no nosso atelier em Portugal.",
            buttonText: "Ver catalogo",
            buttonUrl: "/catalogo",
            imageUrl: "",
          },
        },
        {
          id: nanoid(10),
          type: "product-grid",
          data: {
            title: "Mais vendidos",
            subtitle:
              "As pecas que os nossos clientes mais pedem. T-shirts, tote bags e bolsas personalizadas com carinho.",
            filter: "bestsellers",
          },
        },
        {
          id: nanoid(10),
          type: "category-grid",
          data: {
            title: "Categorias em destaque",
            subtitle: "Encontra a peca ideal para personalizar ou oferecer.",
            categories: ["tote-bags", "t-shirts", "necessaire", "frascos-vidro"],
          },
        },
        {
          id: nanoid(10),
          type: "cta-banner",
          data: {
            title: "A tua frase, o teu doodle, a tua peca.",
            subtitle:
              "Em cada produto podes escrever uma frase ate 100 caracteres, escolher as cores e descrever o desenho que queres estampado. Nos fazemos o resto a mao.",
            buttonText: "Ver como encomendar",
            buttonUrl: "/como-encomendar",
            bgColor: "ink",
          },
        },
      ];

      await db.insert(schema.pages).values({
        slug: "home",
        title: "Homepage",
        body: "",
        blocks: homeBlocks,
        published: true,
      });

      console.log("  ✔ home (created with 4 blocks)");
    }

    console.log("✅ Migracao concluida.");
  } finally {
    await client.end();
  }
};

main().catch((err) => {
  console.error("❌ Migracao falhou:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Run the migration**

```bash
DATABASE_URL=postgresql://postgres:IkarZNWINRJiOEjQcXcgtpPhhXpUhHii@monorail.proxy.rlwy.net:13815/railway npx tsx scripts/migrate-to-blocks.ts
```

Expected output:
```
Converting existing pages to blocks...
  ✔ sobre-nos (converted body to text block)
  ✔ como-encomendar (converted body to text block)
  ✔ termos-condicoes (converted body to text block)
Creating homepage...
  ✔ home (created with 4 blocks)
✅ Migracao concluida.
```

- [ ] **Step 3: Commit**

```bash
git add scripts/migrate-to-blocks.ts
git commit -m "feat: add migration script to convert existing pages to blocks"
```

---

### Task 11: Test locally and verify

**Files:** None (verification only)

- [ ] **Step 1: Start the dev server**

```bash
DATABASE_URL=postgresql://postgres:IkarZNWINRJiOEjQcXcgtpPhhXpUhHii@monorail.proxy.rlwy.net:13815/railway npm run dev
```

- [ ] **Step 2: Verify storefront**

Open in browser and check:
- `http://localhost:4321/` — homepage renders hero, product grid, category grid, CTA banner blocks
- `http://localhost:4321/sobre-nos` — renders text block with existing markdown content
- `http://localhost:4321/como-encomendar` — renders text block
- `http://localhost:4321/termos-condicoes` — renders text block
- `http://localhost:4321/catalogo` — still works (not affected by catch-all)
- `http://localhost:4321/carrinho` — still works
- `http://localhost:4321/checkout` — still works

- [ ] **Step 3: Verify admin**

- `http://localhost:4321/admin/pages` — shows all pages with block counts and published status, "Nova pagina" button visible
- Click "home" page — BlockEditor loads with 4 blocks, can expand/collapse/reorder
- Click "sobre-nos" — BlockEditor loads with 1 text block
- Try creating a new page via "Nova pagina"
- Try adding, removing, and reordering blocks
- Try saving changes

- [ ] **Step 4: Fix any issues found during testing**

- [ ] **Step 5: Commit fixes if any**

```bash
git add -A
git commit -m "fix: address issues found during block CMS testing"
```

---

### Task 12: Build check, push, and deploy

- [ ] **Step 1: Run build**

```bash
npm run build
```

Fix any TypeScript or build errors.

- [ ] **Step 2: Commit any build fixes**

```bash
git add -A
git commit -m "fix: resolve build errors for block CMS"
```

- [ ] **Step 3: Push to deploy**

```bash
git push origin main
```
