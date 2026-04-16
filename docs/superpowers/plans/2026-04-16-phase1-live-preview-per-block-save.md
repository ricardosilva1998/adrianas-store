# Phase 1: Live Preview + Per-Block Save

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The `/admin/pages/[slug]` edit view shows a live storefront preview iframe that updates as the admin types. Each block has its own "Guardar" button that persists just that block's `data` into the page's `draftBlocks`, without touching other blocks. "Publicar" still promotes the whole draft.

**Architecture:** Pure block-mutation helpers unit-tested in `src/lib/page-blocks.ts`. Thin API routes under `/api/admin/pages/[slug]/blocks/*` call them. Preview-token store extended with a page-preview table. A new `PagePreviewShell` React component wraps the editor, hosts the iframe, and manages the debounced preview-token lifecycle (same pattern as `PreviewShell.tsx`). The block editor is split into `PageEditor` → list of `BlockCard` children, each card owning its own dirty state and save button. Per-type forms move out of `BlockEditor.tsx` into `BlockForm.tsx` so the new `BlockCard` can import them.

**Tech Stack:** Astro 6 SSR + React 19 islands, Drizzle ORM on Postgres, Zod for validation, nanostores (unchanged), Vitest + RTL (from Phase 0).

**Prerequisites:** Phase 0 must be complete (`npm test` passes). `npm run dev` works end-to-end. Admin login + page edit flow works.

---

### Task 1: Pure page-block mutation helpers (TDD)

**Files:**
- Create: `src/lib/page-blocks.ts`
- Create: `src/lib/page-blocks.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/page-blocks.test.ts
import { describe, it, expect } from "vitest";
import {
  replaceBlockData,
  appendBlock,
  removeBlockById,
  reorderBlocks,
} from "./page-blocks";
import type { Block } from "./blocks";

const hero: Block = { id: "a", type: "hero", data: { title: "Olá", titleAccent: "", subtitle: "", buttonText: "", buttonUrl: "", imageUrl: "" } };
const text: Block = { id: "b", type: "text", data: { markdown: "# hi" } };
const faq: Block = { id: "c", type: "faq", data: { title: "", items: [] } };

describe("replaceBlockData", () => {
  it("replaces data on matching id, preserves order", () => {
    const out = replaceBlockData([hero, text, faq], "b", { markdown: "# new" });
    expect(out.ok).toBe(true);
    expect(out.blocks[1]).toEqual({ id: "b", type: "text", data: { markdown: "# new" } });
    expect(out.blocks.map((b) => b.id)).toEqual(["a", "b", "c"]);
  });

  it("returns ok:false when id is missing", () => {
    const out = replaceBlockData([hero, text], "zzz", { markdown: "no" });
    expect(out.ok).toBe(false);
    expect(out.blocks).toEqual([hero, text]);
  });

  it("rejects data that fails the block schema", () => {
    const out = replaceBlockData([text], "b", { markdown: 42 as unknown as string });
    expect(out.ok).toBe(false);
  });
});

describe("appendBlock", () => {
  it("appends to the end and returns a new array", () => {
    const out = appendBlock([hero], text);
    expect(out.blocks).toEqual([hero, text]);
    expect(out.ok).toBe(true);
  });

  it("rejects a block whose data doesn't match its type", () => {
    const bad = { id: "x", type: "hero", data: { title: 1 } } as unknown as Block;
    const out = appendBlock([], bad);
    expect(out.ok).toBe(false);
  });
});

describe("removeBlockById", () => {
  it("removes matching id", () => {
    const out = removeBlockById([hero, text, faq], "b");
    expect(out.ok).toBe(true);
    expect(out.blocks.map((b) => b.id)).toEqual(["a", "c"]);
  });

  it("returns ok:false when id is missing", () => {
    const out = removeBlockById([hero], "zzz");
    expect(out.ok).toBe(false);
  });
});

describe("reorderBlocks", () => {
  it("reorders to match ids sequence", () => {
    const out = reorderBlocks([hero, text, faq], ["c", "a", "b"]);
    expect(out.ok).toBe(true);
    expect(out.blocks.map((b) => b.id)).toEqual(["c", "a", "b"]);
  });

  it("returns ok:false when ids sequence is a different set", () => {
    const out = reorderBlocks([hero, text], ["a", "zzz"]);
    expect(out.ok).toBe(false);
  });

  it("returns ok:false when ids sequence has wrong length", () => {
    const out = reorderBlocks([hero, text, faq], ["a", "b"]);
    expect(out.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npm test -- page-blocks`
Expected: suite fails with `Cannot find module './page-blocks'`.

- [ ] **Step 3: Implement the helpers**

```ts
// src/lib/page-blocks.ts
import { blockSchema, type Block } from "./blocks";

export type MutationResult = { ok: true; blocks: Block[] } | { ok: false; blocks: Block[] };

export function replaceBlockData(
  blocks: Block[],
  id: string,
  data: unknown,
): MutationResult {
  const idx = blocks.findIndex((b) => b.id === id);
  if (idx === -1) return { ok: false, blocks };
  const candidate = { ...blocks[idx], data: { ...(blocks[idx].data as object), ...(data as object) } };
  const parsed = blockSchema.safeParse(candidate);
  if (!parsed.success) return { ok: false, blocks };
  const next = blocks.slice();
  next[idx] = parsed.data;
  return { ok: true, blocks: next };
}

export function appendBlock(blocks: Block[], block: unknown): MutationResult {
  const parsed = blockSchema.safeParse(block);
  if (!parsed.success) return { ok: false, blocks };
  return { ok: true, blocks: [...blocks, parsed.data] };
}

export function removeBlockById(blocks: Block[], id: string): MutationResult {
  const idx = blocks.findIndex((b) => b.id === id);
  if (idx === -1) return { ok: false, blocks };
  return { ok: true, blocks: blocks.filter((b) => b.id !== id) };
}

export function reorderBlocks(blocks: Block[], ids: string[]): MutationResult {
  if (ids.length !== blocks.length) return { ok: false, blocks };
  const byId = new Map(blocks.map((b) => [b.id, b]));
  if (ids.some((id) => !byId.has(id))) return { ok: false, blocks };
  return { ok: true, blocks: ids.map((id) => byId.get(id)!) };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npm test -- page-blocks`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/page-blocks.ts src/lib/page-blocks.test.ts
git commit -m "feat(blocks): pure page-block mutation helpers with tests"
```

---

### Task 2: Page-preview store (TDD)

**Files:**
- Modify: `src/lib/preview-store.ts`
- Create: `src/lib/preview-store.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/preview-store.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  putPagePreview,
  upsertPagePreview,
  getPagePreview,
  clearPagePreview,
} from "./preview-store";

const makePayload = (slug = "home") => ({
  slug,
  title: "Home",
  blocks: [
    {
      id: "a",
      type: "hero" as const,
      data: { title: "", titleAccent: "", subtitle: "", buttonText: "", buttonUrl: "", imageUrl: "" },
    },
  ],
});

describe("page preview store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("putPagePreview returns a unique string token", () => {
    const a = putPagePreview(makePayload());
    const b = putPagePreview(makePayload());
    expect(a).not.toBe(b);
    expect(typeof a).toBe("string");
  });

  it("getPagePreview retrieves the stored payload", () => {
    const token = putPagePreview(makePayload("sobre"));
    expect(getPagePreview(token)?.slug).toBe("sobre");
  });

  it("upsertPagePreview overwrites an existing entry", () => {
    const token = putPagePreview(makePayload("home"));
    upsertPagePreview(token, makePayload("sobre"));
    expect(getPagePreview(token)?.slug).toBe("sobre");
  });

  it("clearPagePreview removes the entry", () => {
    const token = putPagePreview(makePayload());
    clearPagePreview(token);
    expect(getPagePreview(token)).toBeNull();
  });

  it("expires after the TTL", () => {
    const token = putPagePreview(makePayload());
    vi.advanceTimersByTime(11 * 60 * 1000);
    expect(getPagePreview(token)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npm test -- preview-store`
Expected: fails on missing exports.

- [ ] **Step 3: Extend `src/lib/preview-store.ts`**

Add after the existing `clearPreview` export:

```ts
import type { Block } from "./blocks";

export type PagePreviewValue = {
  slug: string;
  title: string;
  blocks: Block[];
};

type PageEntry = { value: PagePreviewValue; expiresAt: number };
const pageStore = new Map<string, PageEntry>();

function pageGc() {
  const now = Date.now();
  for (const [token, entry] of pageStore) {
    if (entry.expiresAt <= now) pageStore.delete(token);
  }
}

export function putPagePreview(value: PagePreviewValue): string {
  pageGc();
  const token = nanoid(16);
  pageStore.set(token, { value, expiresAt: Date.now() + TTL_MS });
  return token;
}

export function upsertPagePreview(token: string, value: PagePreviewValue): void {
  pageGc();
  pageStore.set(token, { value, expiresAt: Date.now() + TTL_MS });
}

export function getPagePreview(token: string): PagePreviewValue | null {
  pageGc();
  return pageStore.get(token)?.value ?? null;
}

export function clearPagePreview(token: string): void {
  pageStore.delete(token);
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npm test -- preview-store`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/preview-store.ts src/lib/preview-store.test.ts
git commit -m "feat(preview): add page-preview store with tests"
```

---

### Task 3: Add `pagePreview` to Astro locals types

**Files:**
- Modify: `src/env.d.ts`

- [ ] **Step 1: Read the file and locate the `App.Locals` interface**

Open `src/env.d.ts`. Find the declaration `namespace App { interface Locals { ... } }`.

- [ ] **Step 2: Add the new field**

Inside `Locals`, add:
```ts
pagePreview?: import("./lib/preview-store").PagePreviewValue;
```

Also ensure `previewConfig?: import("./lib/config").SiteConfig;` exists (it should, since middleware already writes it).

- [ ] **Step 3: Run typechecker**

Run: `npm run check`
Expected: passes (or only pre-existing failures unrelated to this change).

- [ ] **Step 4: Commit**

```bash
git add src/env.d.ts
git commit -m "types(astro): add pagePreview to App.Locals"
```

---

### Task 4: Middleware hydrates `locals.pagePreview`

**Files:**
- Modify: `src/middleware.ts`

- [ ] **Step 1: Update the preview-token branch**

Replace the existing preview-token `if (previewToken)` block with:
```ts
const previewToken = context.url.searchParams.get("preview");
if (previewToken) {
  const user = context.locals.user ?? (await getSessionUser(context.cookies));
  if (user) {
    const pendingConfig = getPreview(previewToken);
    if (pendingConfig) {
      context.locals.previewConfig = pendingConfig;
    }
    const pendingPage = getPagePreview(previewToken);
    if (pendingPage) {
      context.locals.pagePreview = pendingPage;
    }
  }
}
```

Update the import at the top:
```ts
import { getPreview, getPagePreview } from "./lib/preview-store";
```

- [ ] **Step 2: Run typechecker**

Run: `npm run check`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(middleware): hydrate locals.pagePreview from token"
```

---

### Task 5: Storefront catch-all honours `pagePreview`

**Files:**
- Modify: `src/pages/[...slug].astro`

- [ ] **Step 1: Update the page resolution + block selection logic**

Replace the block / page resolution section with:
```astro
const pagePreview = Astro.locals.pagePreview;
const isLivePreview = !!pagePreview && pagePreview.slug === slug;

const isDraftPreview =
  Astro.url.searchParams.get("draft") === "1" && !!Astro.locals.user;

const dbPage = isDraftPreview
  ? await getDraftPage(slug)
  : await getPublishedPage(slug);

if (!dbPage && !isLivePreview) {
  return new Response(null, { status: 404 });
}

const title = isLivePreview ? pagePreview!.title : dbPage!.title;
const blocks = (
  isLivePreview
    ? pagePreview!.blocks
    : isDraftPreview && dbPage!.draftBlocks
      ? dbPage!.draftBlocks
      : dbPage!.blocks
) as Array<{ id?: string; type: string; data: any }>;
```

Update the banner block to mention live preview:
```astro
<BaseLayout title={slug === "home" ? undefined : title}>
  {isLivePreview && (
    <div class="bg-rosa-50 border-b border-rosa-200 text-rosa-700 text-xs text-center py-2">
      A mostrar pré-visualização ao vivo
    </div>
  )}
  {isDraftPreview && !isLivePreview && dbPage?.draftBlocks && (
    <div class="bg-yellow-50 border-b border-yellow-300 text-yellow-900 text-xs text-center py-2">
      A mostrar rascunho (não publicado) · <a href={`/${slug === "home" ? "" : slug}`} class="underline">ver versão pública</a>
    </div>
  )}
  {(blocks ?? []).map((block) => (
    <BlockRenderer block={block} />
  ))}
</BaseLayout>
```

- [ ] **Step 2: Dev-server sanity check**

Run: `npm run dev`. Open `http://localhost:4321/` — the home page renders as before.

- [ ] **Step 3: Run typechecker**

Run: `npm run check`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/pages/[...slug].astro
git commit -m "feat(storefront): render pagePreview when hydrated by middleware"
```

---

### Task 6: `/api/admin/pages/[slug]/preview` endpoint

**Files:**
- Create: `src/pages/api/admin/pages/[slug]/preview.ts`

- [ ] **Step 1: Create the endpoint**

```ts
import type { APIRoute } from "astro";
import { z } from "zod";
import { blocksArraySchema } from "../../../../../lib/blocks";
import {
  putPagePreview,
  upsertPagePreview,
  clearPagePreview,
} from "../../../../../lib/preview-store";

export const prerender = false;

const BodySchema = z.object({
  title: z.string().min(1).max(200),
  blocks: blocksArraySchema,
});

export const POST: APIRoute = async ({ params, request, locals }) => {
  if (!locals.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const slug = params.slug;
  if (!slug) return new Response(JSON.stringify({ error: "Slug em falta" }), { status: 400 });
  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return new Response(JSON.stringify({ error: "Dados invalidos" }), { status: 400 });
  const token = putPagePreview({ slug, title: parsed.data.title, blocks: parsed.data.blocks });
  return new Response(JSON.stringify({ token }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};

export const PUT: APIRoute = async ({ url, params, request, locals }) => {
  if (!locals.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const slug = params.slug;
  const token = url.searchParams.get("token");
  if (!slug || !token) return new Response(JSON.stringify({ error: "Parâmetros em falta" }), { status: 400 });
  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return new Response(JSON.stringify({ error: "Dados invalidos" }), { status: 400 });
  upsertPagePreview(token, { slug, title: parsed.data.title, blocks: parsed.data.blocks });
  return new Response(JSON.stringify({ success: true }), { status: 200 });
};

export const DELETE: APIRoute = async ({ url, locals }) => {
  if (!locals.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const token = url.searchParams.get("token");
  if (token) clearPagePreview(token);
  return new Response(null, { status: 204 });
};
```

- [ ] **Step 2: Manual test with curl**

With `npm run dev` running and you logged in at `/admin/login` (copy the cookie from browser devtools):

```bash
curl -i -X POST 'http://localhost:4321/api/admin/pages/home/preview' \
  -H 'Content-Type: application/json' \
  -b 'adriana-session=<session-jwt>' \
  -d '{"title":"Home","blocks":[]}'
```

Expected: 201 with `{"token":"..."}`. Then:
```bash
curl -i 'http://localhost:4321/?preview=<token>' -b 'adriana-session=<session-jwt>'
```
Expected: 200, page body includes the `A mostrar pré-visualização ao vivo` banner.

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/admin/pages/[slug]/preview.ts
git commit -m "feat(api): page preview POST/PUT/DELETE endpoints"
```

---

### Task 7: PATCH + DELETE `/api/admin/pages/[slug]/blocks/[blockId]`

**Files:**
- Create: `src/pages/api/admin/pages/[slug]/blocks/[blockId].ts`

- [ ] **Step 1: Create the endpoint**

```ts
import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../../../../../../db/client";
import type { Block } from "../../../../../../lib/blocks";
import { blocksArraySchema } from "../../../../../../lib/blocks";
import { replaceBlockData, removeBlockById } from "../../../../../../lib/page-blocks";

export const prerender = false;

async function loadEditableBlocks(slug: string): Promise<Block[] | null> {
  const [row] = await db.select().from(schema.pages).where(eq(schema.pages.slug, slug)).limit(1);
  if (!row) return null;
  const raw = (row.draftBlocks ?? row.blocks) as unknown;
  const parsed = blocksArraySchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}

async function writeDraft(slug: string, blocks: Block[]) {
  await db
    .update(schema.pages)
    .set({ draftBlocks: blocks, updatedAt: new Date() })
    .where(eq(schema.pages.slug, slug));
}

const PatchSchema = z.object({ data: z.record(z.unknown()) });

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  if (!locals.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const { slug, blockId } = params;
  if (!slug || !blockId) return new Response(JSON.stringify({ error: "Parâmetros em falta" }), { status: 400 });

  const body = await request.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return new Response(JSON.stringify({ error: "Dados invalidos" }), { status: 400 });

  const blocks = await loadEditableBlocks(slug);
  if (blocks === null) return new Response(JSON.stringify({ error: "Pagina nao encontrada" }), { status: 404 });

  const out = replaceBlockData(blocks, blockId, parsed.data.data);
  if (!out.ok) return new Response(JSON.stringify({ error: "Bloco invalido ou inexistente" }), { status: 404 });

  await writeDraft(slug, out.blocks);
  return new Response(JSON.stringify({ success: true }), { status: 200 });
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!locals.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const { slug, blockId } = params;
  if (!slug || !blockId) return new Response(JSON.stringify({ error: "Parâmetros em falta" }), { status: 400 });

  const blocks = await loadEditableBlocks(slug);
  if (blocks === null) return new Response(JSON.stringify({ error: "Pagina nao encontrada" }), { status: 404 });

  const out = removeBlockById(blocks, blockId);
  if (!out.ok) return new Response(JSON.stringify({ error: "Bloco inexistente" }), { status: 404 });

  await writeDraft(slug, out.blocks);
  return new Response(JSON.stringify({ success: true }), { status: 200 });
};
```

- [ ] **Step 2: Manual test**

Pick a block id from the home page (visible in `/admin/pages/home`). Example:
```bash
curl -i -X PATCH 'http://localhost:4321/api/admin/pages/home/blocks/<blockId>' \
  -H 'Content-Type: application/json' \
  -b 'adriana-session=<session-jwt>' \
  -d '{"data":{"title":"Editado"}}'
```
Expected: 200. Reload `/admin/pages/home` and confirm the draftBlocks holds the new title.

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/admin/pages/[slug]/blocks/[blockId].ts
git commit -m "feat(api): PATCH/DELETE single block endpoint"
```

---

### Task 8: POST `/api/admin/pages/[slug]/blocks` (append)

**Files:**
- Create: `src/pages/api/admin/pages/[slug]/blocks/index.ts`

- [ ] **Step 1: Create the endpoint**

```ts
import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../../../../../../db/client";
import { blockSchema, blocksArraySchema, type Block } from "../../../../../../lib/blocks";
import { appendBlock } from "../../../../../../lib/page-blocks";

export const prerender = false;

const PostSchema = z.object({ block: blockSchema });

export const POST: APIRoute = async ({ params, request, locals }) => {
  if (!locals.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const slug = params.slug;
  if (!slug) return new Response(JSON.stringify({ error: "Slug em falta" }), { status: 400 });
  const body = await request.json().catch(() => null);
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) return new Response(JSON.stringify({ error: "Dados invalidos" }), { status: 400 });

  const [row] = await db.select().from(schema.pages).where(eq(schema.pages.slug, slug)).limit(1);
  if (!row) return new Response(JSON.stringify({ error: "Pagina nao encontrada" }), { status: 404 });

  const current = (row.draftBlocks ?? row.blocks) as unknown;
  const asArr = blocksArraySchema.safeParse(current);
  const baseBlocks: Block[] = asArr.success ? asArr.data : [];

  const out = appendBlock(baseBlocks, parsed.data.block);
  if (!out.ok) return new Response(JSON.stringify({ error: "Bloco invalido" }), { status: 400 });

  await db
    .update(schema.pages)
    .set({ draftBlocks: out.blocks, updatedAt: new Date() })
    .where(eq(schema.pages.slug, slug));

  return new Response(JSON.stringify({ success: true, block: parsed.data.block }), { status: 201 });
};
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/api/admin/pages/[slug]/blocks/index.ts
git commit -m "feat(api): POST append block endpoint"
```

---

### Task 9: PUT `/api/admin/pages/[slug]/blocks/order`

**Files:**
- Create: `src/pages/api/admin/pages/[slug]/blocks/order.ts`

- [ ] **Step 1: Create the endpoint**

```ts
import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../../../../../../db/client";
import { blocksArraySchema, type Block } from "../../../../../../lib/blocks";
import { reorderBlocks } from "../../../../../../lib/page-blocks";

export const prerender = false;

const BodySchema = z.object({ ids: z.array(z.string()).min(1) });

export const PUT: APIRoute = async ({ params, request, locals }) => {
  if (!locals.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const slug = params.slug;
  if (!slug) return new Response(JSON.stringify({ error: "Slug em falta" }), { status: 400 });
  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return new Response(JSON.stringify({ error: "Dados invalidos" }), { status: 400 });

  const [row] = await db.select().from(schema.pages).where(eq(schema.pages.slug, slug)).limit(1);
  if (!row) return new Response(JSON.stringify({ error: "Pagina nao encontrada" }), { status: 404 });

  const current = (row.draftBlocks ?? row.blocks) as unknown;
  const asArr = blocksArraySchema.safeParse(current);
  const baseBlocks: Block[] = asArr.success ? asArr.data : [];

  const out = reorderBlocks(baseBlocks, parsed.data.ids);
  if (!out.ok) return new Response(JSON.stringify({ error: "Sequência de ids invalida" }), { status: 400 });

  await db
    .update(schema.pages)
    .set({ draftBlocks: out.blocks, updatedAt: new Date() })
    .where(eq(schema.pages.slug, slug));

  return new Response(JSON.stringify({ success: true }), { status: 200 });
};
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/api/admin/pages/[slug]/blocks/order.ts
git commit -m "feat(api): PUT block order endpoint"
```

---

### Task 10: POST `/api/admin/pages/[slug]/discard-draft`

**Files:**
- Create: `src/pages/api/admin/pages/[slug]/discard-draft.ts`

- [ ] **Step 1: Create the endpoint**

```ts
import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { db, schema } from "../../../../../db/client";

export const prerender = false;

export const POST: APIRoute = async ({ params, locals }) => {
  if (!locals.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const slug = params.slug;
  if (!slug) return new Response(JSON.stringify({ error: "Slug em falta" }), { status: 400 });

  await db
    .update(schema.pages)
    .set({ draftBlocks: null, updatedAt: new Date() })
    .where(eq(schema.pages.slug, slug));

  return new Response(JSON.stringify({ success: true }), { status: 200 });
};
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/api/admin/pages/[slug]/discard-draft.ts
git commit -m "feat(api): discard draft endpoint"
```

---

### Task 11: BlockRenderer exposes `data-block-id`; BaseLayout handles new postMessages

**Files:**
- Modify: `src/components/blocks/BlockRenderer.astro`
- Modify: `src/layouts/BaseLayout.astro`

- [ ] **Step 1: Update `BlockRenderer.astro`**

Change the `Props` interface and wrap the dispatch in a single `<div>`:
```astro
interface Props {
  block: { id?: string; type: string; data: any };
  context?: TemplateContext;
}
const { block, context } = Astro.props;
---
<div data-block-id={block.id}>
  {block.type === "hero" && <HeroBlock data={block.data} />}
  {block.type === "text" && <TextBlock data={block.data} />}
  {block.type === "product-grid" && <ProductGridBlock data={block.data} />}
  {block.type === "category-grid" && <CategoryGridBlock data={block.data} />}
  {block.type === "image-gallery" && <ImageGalleryBlock data={block.data} />}
  {block.type === "cta-banner" && <CtaBannerBlock data={block.data} />}
  {block.type === "faq" && <FaqBlock data={block.data} />}
  {block.type === "contact-info" && <ContactInfoBlock data={block.data} />}
  {block.type === "testimonials" && <TestimonialsBlock data={block.data} />}
  {block.type === "newsletter" && <NewsletterBlock data={block.data} />}
  {block.type === "image-text-split" && <ImageTextSplitBlock data={block.data} />}
  {block.type === "video-embed" && <VideoEmbedBlock data={block.data} />}
  {block.type === "divider" && <DividerBlock data={block.data} />}

  {block.type === "product-gallery" && context?.product && (
    <ProductGalleryBlock data={block.data} product={context.product} />
  )}
  {block.type === "product-info" && context?.product && (
    <ProductInfoBlock data={block.data} product={context.product} />
  )}
  {block.type === "product-long-description" && context?.product && (
    <ProductLongDescriptionBlock data={block.data} product={context.product} />
  )}
  {block.type === "product-related" && (
    <ProductRelatedBlock data={block.data} relatedProducts={context?.relatedProducts ?? []} />
  )}
  {block.type === "catalog-grid-bound" && (
    <CatalogGridBoundBlock
      data={block.data}
      products={context?.products ?? []}
      activeCategory={context?.activeCategory}
    />
  )}
</div>
```

- [ ] **Step 2: Extend the preview script in `src/layouts/BaseLayout.astro`**

Inside the `{isPreview && (<script is:inline>...</script>)}` block, keep the existing `preview-theme-css` branch and add two more branches to the same listener:
```js
if (ev.data.kind === "scroll-to-block" && typeof ev.data.id === "string") {
  const el = document.querySelector(`[data-block-id="${ev.data.id}"]`);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.animate(
      [
        { outline: "2px solid #ED7396", outlineOffset: "4px" },
        { outline: "2px solid transparent", outlineOffset: "4px" }
      ],
      { duration: 800 }
    );
  }
}

if (ev.data.kind === "page-preview-reload") {
  window.location.reload();
}
```

- [ ] **Step 3: Dev-server sanity check**

Open `/` in the browser, then in devtools:
```js
document.querySelectorAll("[data-block-id]").length
```
Expected: > 0 (matches number of blocks on the homepage).

- [ ] **Step 4: Commit**

```bash
git add src/components/blocks/BlockRenderer.astro src/layouts/BaseLayout.astro
git commit -m "feat(preview): data-block-id + scroll-to-block/reload postMessages"
```

---

### Task 12: Extract per-type block forms to `BlockForm.tsx`

**Files:**
- Create: `src/components/admin/BlockForm.tsx`
- Create: `src/components/admin/BlockForm.test.tsx`
- Modify: `src/components/admin/BlockEditor.tsx`

- [ ] **Step 1: Write failing component tests for two representative forms**

```tsx
// src/components/admin/BlockForm.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BlockForm from "./BlockForm";
import type { Block } from "../../lib/blocks";

describe("BlockForm(hero)", () => {
  it("calls onChange when title is edited", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const block: Block = {
      id: "a",
      type: "hero",
      data: { title: "", titleAccent: "", subtitle: "", buttonText: "", buttonUrl: "", imageUrl: "" },
    };
    render(<BlockForm block={block} onChange={onChange} />);
    const titleInput = screen.getAllByRole("textbox")[0];
    await user.type(titleInput, "Olá");
    expect(onChange).toHaveBeenCalled();
  });
});

describe("BlockForm(faq)", () => {
  it("shows an 'add question' affordance", () => {
    const block: Block = { id: "c", type: "faq", data: { title: "", items: [] } };
    render(<BlockForm block={block} onChange={() => {}} />);
    expect(screen.getByText(/adicionar pergunta/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npm test -- BlockForm`
Expected: fails on missing module.

- [ ] **Step 3: Move the per-type forms out of `BlockEditor.tsx`**

Create `src/components/admin/BlockForm.tsx`. Move the following from `BlockEditor.tsx` into the new file (everything from the comment `// --- Per-block-type forms ---` down to the end of the file):
- The `BlockForm` dispatcher function
- `HeroForm`, `TextForm`, `ProductGridForm`, `CategoryGridForm`, `ImageGalleryForm`, `CtaBannerForm`, `FaqForm`, `ContactInfoForm`, `TestimonialsForm`, `NewsletterForm`, `ImageTextSplitForm`, `VideoEmbedForm`, `DividerForm`, `ProductGalleryForm`, `ProductInfoForm`, `ProductLongDescriptionForm`, `ProductRelatedForm`, `CatalogGridBoundForm`
- The `CATEGORIES` constant

At the top of the new `BlockForm.tsx`, add:
```tsx
import { marked } from "marked";
import type { Block } from "../../lib/blocks";
import ImagePicker from "./ImagePicker";
```

Make `BlockForm` the **default export**:
```tsx
export default function BlockForm({ block, onChange }: { block: Block; onChange: (data: any) => void }) {
  switch (block.type) {
    // ... all cases as in BlockEditor.tsx today
  }
}
```

In `BlockEditor.tsx`:
- Remove the moved code.
- Replace the local `BlockForm` dispatcher with: `import BlockForm from "./BlockForm";`
- Remove the `import { marked } from "marked";` if it's no longer used elsewhere in the file.

After the edit, `BlockEditor.tsx` should be ~300 lines.

- [ ] **Step 4: Run the component tests**

Run: `npm test -- BlockForm`
Expected: both tests pass.

- [ ] **Step 5: Dev-server sanity check**

Reload `/admin/pages/home`. The existing editor should look and behave identically (no visual regression).

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/BlockForm.tsx src/components/admin/BlockForm.test.tsx src/components/admin/BlockEditor.tsx
git commit -m "refactor(admin): extract per-type BlockForm from BlockEditor"
```

---

### Task 13: `BlockCard` component with per-block save (TDD)

**Files:**
- Create: `src/components/admin/BlockCard.tsx`
- Create: `src/components/admin/BlockCard.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// src/components/admin/BlockCard.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BlockCard from "./BlockCard";
import type { Block } from "../../lib/blocks";

const hero: Block = {
  id: "h1",
  type: "hero",
  data: { title: "Old", titleAccent: "", subtitle: "", buttonText: "", buttonUrl: "", imageUrl: "" },
};

describe("BlockCard", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) }) as any;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("disables the Save button until the form is dirty", () => {
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
    expect(screen.getByRole("button", { name: /guardar bloco/i })).toBeDisabled();
  });

  it("enables Save after editing and calls PATCH on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <BlockCard
        slug="home"
        block={hero}
        expanded
        onChange={onChange}
        onMoveUp={() => {}}
        onMoveDown={() => {}}
        onRemove={() => {}}
        onToggleExpand={() => {}}
        canMoveUp
        canMoveDown
      />,
    );
    const titleInput = screen.getByDisplayValue("Old");
    await user.clear(titleInput);
    await user.type(titleInput, "New");
    const save = screen.getByRole("button", { name: /guardar bloco/i });
    expect(save).toBeEnabled();
    await user.click(save);

    await waitFor(() => {
      expect((globalThis.fetch as any)).toHaveBeenCalledWith(
        "/api/admin/pages/home/blocks/h1",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
    expect(await screen.findByText(/guardado/i)).toBeInTheDocument();
    expect(save).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npm test -- BlockCard`
Expected: fails on missing module.

- [ ] **Step 3: Implement `BlockCard`**

```tsx
// src/components/admin/BlockCard.tsx
import { useState } from "react";
import type { Block, BlockType } from "../../lib/blocks";
import { BLOCK_TYPES } from "../../lib/blocks";
import BlockForm from "./BlockForm";

interface Props {
  slug: string;
  block: Block;
  expanded: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChange: (block: Block) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onToggleExpand: () => void;
}

const blockLabel = (type: BlockType) =>
  BLOCK_TYPES.find((bt) => bt.type === type)?.label ?? type;

export default function BlockCard({
  slug,
  block,
  expanded,
  canMoveUp,
  canMoveDown,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
  onToggleExpand,
}: Props) {
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFormChange = (data: any) => {
    onChange({ ...block, data: { ...block.data, ...data } });
    setDirty(true);
    setJustSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/pages/${slug}/blocks/${block.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: block.data }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({ error: `Erro ${res.status}` }));
        throw new Error(msg ?? "Erro ao guardar");
      }
      setDirty(false);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-3xl border border-ink-line bg-white">
      <div className="flex cursor-pointer items-center justify-between px-6 py-4" onClick={onToggleExpand}>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-rosa-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-rosa-600">
            {blockLabel(block.type)}
          </span>
          <span className="text-xs text-ink-muted">{expanded ? "▼" : "▶"}</span>
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={onMoveUp} disabled={!canMoveUp} className="rounded-lg p-1.5 text-ink-muted hover:bg-rosa-50 hover:text-rosa-500 disabled:opacity-30">↑</button>
          <button type="button" onClick={onMoveDown} disabled={!canMoveDown} className="rounded-lg p-1.5 text-ink-muted hover:bg-rosa-50 hover:text-rosa-500 disabled:opacity-30">↓</button>
          <button type="button" onClick={onRemove} className="rounded-lg p-1.5 text-ink-muted hover:bg-red-50 hover:text-red-500">✕</button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-ink-line px-6 py-5">
          <BlockForm block={block} onChange={handleFormChange} />
          <div className="mt-5 flex items-center justify-between">
            <div className="text-xs">
              {error && <span className="text-red-600">{error}</span>}
              {justSaved && !error && <span className="text-emerald-600">Guardado!</span>}
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saving}
              className="rounded-full border border-ink-line px-4 py-2 text-sm font-medium text-ink-soft hover:border-rosa-300 hover:text-rosa-500 disabled:opacity-40"
            >
              {saving ? "A guardar…" : "Guardar bloco"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npm test -- BlockCard`
Expected: both tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/BlockCard.tsx src/components/admin/BlockCard.test.tsx
git commit -m "feat(admin): BlockCard with per-block save + dirty state"
```

---

### Task 14: `PagePreviewShell` component (TDD)

**Files:**
- Create: `src/components/admin/PagePreviewShell.tsx`
- Create: `src/components/admin/PagePreviewShell.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// src/components/admin/PagePreviewShell.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import PagePreviewShell from "./PagePreviewShell";

describe("PagePreviewShell", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ token: "t1" }) }) as any;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("creates a preview token on mount", async () => {
    render(
      <PagePreviewShell
        slug="home"
        title="Home"
        blocks={[]}
        onPublish={async () => {}}
        onDiscardDraft={async () => {}}
      >
        <div />
      </PagePreviewShell>,
    );
    await waitFor(() =>
      expect((globalThis.fetch as any)).toHaveBeenCalledWith(
        "/api/admin/pages/home/preview",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("debounces preview PUTs after props change", async () => {
    const { rerender } = render(
      <PagePreviewShell
        slug="home"
        title="Home"
        blocks={[]}
        onPublish={async () => {}}
        onDiscardDraft={async () => {}}
      >
        <div />
      </PagePreviewShell>,
    );
    await waitFor(() => expect((globalThis.fetch as any)).toHaveBeenCalledTimes(1));

    rerender(
      <PagePreviewShell
        slug="home"
        title="Home v2"
        blocks={[]}
        onPublish={async () => {}}
        onDiscardDraft={async () => {}}
      >
        <div />
      </PagePreviewShell>,
    );
    expect((globalThis.fetch as any)).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(400);

    await waitFor(() =>
      expect((globalThis.fetch as any)).toHaveBeenLastCalledWith(
        expect.stringContaining("/api/admin/pages/home/preview?token=t1"),
        expect.objectContaining({ method: "PUT" }),
      ),
    );
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npm test -- PagePreviewShell`
Expected: fails on missing module.

- [ ] **Step 3: Implement `PagePreviewShell`**

```tsx
// src/components/admin/PagePreviewShell.tsx
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Block } from "../../lib/blocks";

interface Props {
  slug: string;
  title: string;
  blocks: Block[];
  publishing?: boolean;
  discarding?: boolean;
  hasDraft?: boolean;
  children: ReactNode;
  onPublish: () => Promise<void>;
  onDiscardDraft: () => Promise<void>;
}

type Device = "desktop" | "mobile";

export default function PagePreviewShell({
  slug,
  title,
  blocks,
  publishing = false,
  discarding = false,
  hasDraft = false,
  children,
  onPublish,
  onDiscardDraft,
}: Props) {
  const [device, setDevice] = useState<Device>("desktop");
  const [token, setToken] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/admin/pages/${slug}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, blocks }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { token: string };
      if (!cancelled) setToken(data.token);
    })();
    return () => {
      cancelled = true;
      if (token) {
        fetch(`/api/admin/pages/${slug}/preview?token=${token}`, { method: "DELETE" });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!token) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      fetch(`/api/admin/pages/${slug}/preview?token=${token}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, blocks }),
      }).then(() => {
        iframeRef.current?.contentWindow?.postMessage({ kind: "page-preview-reload" }, "*");
      });
    }, 300);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [title, blocks, token, slug]);

  const previewPath = slug === "home" ? "/" : `/${slug}`;
  const iframeSrc = token ? `${previewPath}?preview=${token}` : previewPath;

  return (
    <div className="flex h-[calc(100vh-80px)] flex-col">
      <div className="flex items-center justify-between border-b border-ink-line bg-white px-6 py-3">
        <div className="flex gap-1 rounded-full border border-ink-line p-1">
          <button type="button" onClick={() => setDevice("desktop")} className={`px-3 py-1 text-xs font-medium rounded-full ${device === "desktop" ? "bg-ink text-white" : "text-ink-soft"}`}>Desktop</button>
          <button type="button" onClick={() => setDevice("mobile")} className={`px-3 py-1 text-xs font-medium rounded-full ${device === "mobile" ? "bg-ink text-white" : "text-ink-soft"}`}>Mobile</button>
        </div>
        <div className="flex items-center gap-3">
          {hasDraft && (
            <button type="button" onClick={onDiscardDraft} disabled={discarding} className="rounded-full border border-ink-line px-4 py-2 text-sm font-medium text-ink-soft hover:border-red-300 hover:text-red-500 disabled:opacity-40">
              {discarding ? "A descartar…" : "Descartar rascunho"}
            </button>
          )}
          <button type="button" onClick={onPublish} disabled={publishing} className="rounded-full bg-rosa-400 px-5 py-2 text-sm font-medium text-white hover:bg-rosa-500 disabled:opacity-40">
            {publishing ? "A publicar…" : "Publicar"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-[460px] shrink-0 overflow-y-auto border-r border-ink-line bg-white p-6">
          {children}
        </aside>
        <div className="flex-1 overflow-hidden bg-ink-line/40 p-4">
          <div className="mx-auto h-full overflow-hidden rounded-2xl border border-ink-line bg-white shadow-sm" style={{ maxWidth: device === "mobile" ? 390 : "100%" }}>
            <iframe ref={iframeRef} src={iframeSrc} className="h-full w-full" title="Preview" />
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npm test -- PagePreviewShell`
Expected: both tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/PagePreviewShell.tsx src/components/admin/PagePreviewShell.test.tsx
git commit -m "feat(admin): PagePreviewShell with debounced preview-token lifecycle"
```

---

### Task 15: `PageEditor` top-level component (TDD)

**Files:**
- Create: `src/components/admin/PageEditor.tsx`
- Create: `src/components/admin/PageEditor.test.tsx`

- [ ] **Step 1: Write a focused test**

```tsx
// src/components/admin/PageEditor.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PageEditor from "./PageEditor";
import type { Block } from "../../lib/blocks";

const hero: Block = {
  id: "h1",
  type: "hero",
  data: { title: "Olá", titleAccent: "", subtitle: "", buttonText: "", buttonUrl: "", imageUrl: "" },
};

describe("PageEditor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ token: "t1", success: true }) }) as any;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("renders a block card per block", () => {
    render(<PageEditor slug="home" title="Home" initialBlocks={[hero]} published hasDraft={false} />);
    expect(screen.getByText(/hero/i)).toBeInTheDocument();
  });

  it("Publicar calls PUT /api/admin/pages/home with saveAsDraft:false", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<PageEditor slug="home" title="Home" initialBlocks={[hero]} published hasDraft={false} />);
    await user.click(screen.getByRole("button", { name: /publicar/i }));
    await waitFor(() =>
      expect((globalThis.fetch as any)).toHaveBeenCalledWith(
        "/api/admin/pages/home",
        expect.objectContaining({ method: "PUT" }),
      ),
    );
    const lastCall = (globalThis.fetch as any).mock.calls.at(-1);
    const body = JSON.parse(lastCall?.[1]?.body);
    expect(body.saveAsDraft).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npm test -- PageEditor`
Expected: fails on missing module.

- [ ] **Step 3: Implement `PageEditor`**

```tsx
// src/components/admin/PageEditor.tsx
import { useEffect, useState } from "react";
import type { Block, BlockType } from "../../lib/blocks";
import { BLOCK_TYPES, createBlock } from "../../lib/blocks";
import PagePreviewShell from "./PagePreviewShell";
import BlockCard from "./BlockCard";

interface Props {
  slug: string;
  title: string;
  initialBlocks: Block[];
  published: boolean;
  hasDraft: boolean;
}

export default function PageEditor({ slug, title: initialTitle, initialBlocks, published, hasDraft: initialHasDraft }: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [expanded, setExpanded] = useState<string | null>(initialBlocks[0]?.id ?? null);
  const [showPicker, setShowPicker] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [hasDraft, setHasDraft] = useState(initialHasDraft);

  useEffect(() => {
    const onBeforeUnload = (ev: BeforeUnloadEvent) => {
      if (JSON.stringify(blocks) !== JSON.stringify(initialBlocks)) {
        ev.preventDefault();
        ev.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [blocks, initialBlocks]);

  const upsertBlock = (updated: Block) => {
    setBlocks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  };

  const moveBlock = async (id: string, direction: "up" | "down") => {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx === -1) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= blocks.length) return;
    const next = blocks.slice();
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    setBlocks(next);
    await fetch(`/api/admin/pages/${slug}/blocks/order`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: next.map((b) => b.id) }),
    });
    setHasDraft(true);
  };

  const removeBlock = async (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    await fetch(`/api/admin/pages/${slug}/blocks/${id}`, { method: "DELETE" });
    setHasDraft(true);
  };

  const addBlock = async (type: BlockType) => {
    const block = createBlock(type);
    setBlocks((prev) => [...prev, block]);
    setExpanded(block.id);
    setShowPicker(false);
    await fetch(`/api/admin/pages/${slug}/blocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ block }),
    });
    setHasDraft(true);
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await fetch(`/api/admin/pages/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, blocks, published, saveAsDraft: false }),
      });
      setHasDraft(false);
    } finally {
      setPublishing(false);
    }
  };

  const handleDiscardDraft = async () => {
    if (!confirm("Descartar as alterações não publicadas?")) return;
    setDiscarding(true);
    try {
      await fetch(`/api/admin/pages/${slug}/discard-draft`, { method: "POST" });
      window.location.reload();
    } finally {
      setDiscarding(false);
    }
  };

  return (
    <PagePreviewShell
      slug={slug}
      title={title}
      blocks={blocks}
      publishing={publishing}
      discarding={discarding}
      hasDraft={hasDraft}
      onPublish={handlePublish}
      onDiscardDraft={handleDiscardDraft}
    >
      <div className="grid gap-4">
        <div className="rounded-3xl border border-ink-line bg-white p-6">
          <label className="field-label" htmlFor="title">Título</label>
          <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="field-input" />
        </div>

        {blocks.map((block, idx) => (
          <BlockCard
            key={block.id}
            slug={slug}
            block={block}
            expanded={expanded === block.id}
            canMoveUp={idx > 0}
            canMoveDown={idx < blocks.length - 1}
            onChange={upsertBlock}
            onMoveUp={() => moveBlock(block.id, "up")}
            onMoveDown={() => moveBlock(block.id, "down")}
            onRemove={() => removeBlock(block.id)}
            onToggleExpand={() => setExpanded(expanded === block.id ? null : block.id)}
          />
        ))}

        {showPicker ? (
          <div className="rounded-3xl border border-dashed border-rosa-300 bg-rosa-50/60 p-6">
            <h4 className="mb-4 text-sm font-semibold text-ink">Adicionar bloco</h4>
            <div className="grid grid-cols-2 gap-3">
              {BLOCK_TYPES.filter((bt) => !bt.allowedIn).map((bt) => (
                <button key={bt.type} type="button" onClick={() => addBlock(bt.type)} className="rounded-2xl border border-ink-line bg-white p-4 text-left hover:border-rosa-300">
                  <span className="text-sm font-semibold text-ink">{bt.label}</span>
                  <p className="mt-1 text-[11px] text-ink-muted">{bt.description}</p>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setShowPicker(false)} className="mt-4 text-xs text-ink-muted hover:text-rosa-500">Cancelar</button>
          </div>
        ) : (
          <button type="button" onClick={() => setShowPicker(true)} className="w-full rounded-3xl border border-dashed border-ink-line p-4 text-sm text-ink-muted hover:border-rosa-300 hover:text-rosa-500">
            + Adicionar bloco
          </button>
        )}
      </div>
    </PagePreviewShell>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npm test -- PageEditor`
Expected: tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/PageEditor.tsx src/components/admin/PageEditor.test.tsx
git commit -m "feat(admin): PageEditor with preview shell + per-block cards"
```

---

### Task 16: Wire `/admin/pages/[slug].astro` to use `PageEditor`

**Files:**
- Modify: `src/pages/admin/pages/[slug].astro`

- [ ] **Step 1: Replace the editor**

```astro
---
import AdminLayout from "../../../layouts/AdminLayout.astro";
import PageEditor from "../../../components/admin/PageEditor.tsx";
import { getPage } from "../../../lib/queries";

const user = Astro.locals.user;
if (!user) return Astro.redirect("/admin/login");

const { slug } = Astro.params;
if (!slug) return Astro.redirect("/admin/pages");

const page = await getPage(slug);
if (!page) {
  return new Response("Pagina nao encontrada", { status: 404 });
}

const editableBlocks = (page.draftBlocks ?? page.blocks ?? []) as any[];
const hasDraft = page.draftBlocks !== null;
---

<AdminLayout title={`Editar: ${page.title}`} user={user} hideLayoutPadding>
  <PageEditor
    client:load
    slug={slug}
    title={page.title}
    initialBlocks={editableBlocks}
    published={page.published}
    hasDraft={hasDraft}
  />
</AdminLayout>
```

- [ ] **Step 2: Manual end-to-end verification**

1. `npm run dev`.
2. Log into `/admin/login`.
3. Navigate to `/admin/pages/home`.
4. Confirm the split-pane editor loads.
5. Edit the hero title. Within ~500ms the iframe reloads with the new title.
6. Click "Guardar bloco" on the hero card. "Guardado!" appears briefly.
7. Open `/admin/pages/home` in a new tab — the draft title is preserved.
8. Click "Publicar". Open `http://localhost:4321/` in another tab — the new title is live.
9. Make another change, then click "Descartar rascunho" — the editor reloads without draft data.
10. Close the editor tab with a dirty block — browser prompts "Leave site?".

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/pages/[slug].astro
git commit -m "feat(admin): page editor uses live preview + per-block save"
```

---

### Task 17: Confirm new-page flow still works

**Files:**
- (read-only) `src/pages/admin/pages/new.astro`

- [ ] **Step 1: Confirm `new.astro` still uses `BlockEditor`**

Open `src/pages/admin/pages/new.astro`. Verify it imports `BlockEditor` with `mode="create"`. Do not change — the spec scopes live preview to edit mode. Since Task 12 only moved the per-type forms out of `BlockEditor.tsx`, create mode continues to work.

- [ ] **Step 2: Manual verification**

Visit `/admin/pages/new`. Create a page with a title and one block. Confirm the old editor still works and redirects to `/admin/pages/<new-slug>` after creation (which then opens the new PageEditor).

- [ ] **Step 3: No commit (no changes).**

---

## Self-review checklist

- [ ] `npm test` green (new tests + smoke tests from Phase 0).
- [ ] `npm run check` green.
- [ ] `npm run build` succeeds.
- [ ] Spec coverage for Phase 1:
  - Live iframe preview ✓ (Task 14 PagePreviewShell + Tasks 3–5 middleware/catch-all)
  - Per-block save ✓ (Tasks 7 + 13)
  - Scroll-to-block / outline pulse infrastructure in place ✓ (Task 11). Hooking PageEditor to post the scroll-to-block message on card focus is deliberately out of scope for this plan — the infra is ready for a polish follow-up.
  - Publicar ✓ (existing PUT, unchanged)
  - Descartar rascunho ✓ (Task 10 + shell button)
  - Structural changes write to draftBlocks ✓ (Tasks 7, 8, 9)
- [ ] Placeholder scan: no TBD/TODO left in the plan.
- [ ] Type consistency: `PagePreviewValue` exported from `preview-store.ts` and imported in `env.d.ts`. `MutationResult` shape `{ ok, blocks }` consistent across `page-blocks.ts` callers. `Block` import paths consistent (relative to each endpoint's depth).
