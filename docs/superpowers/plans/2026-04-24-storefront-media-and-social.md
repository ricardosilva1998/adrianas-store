# Storefront Media & Social Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 3 independent storefront features for drisclub.com: video slides in the product carousel, overlay-free hero with wider padding on the `background-image` layout, and a new reusable `social-links` CMS block mirroring the `shipping-strip` UX with rosa-brand rounded tiles.

**Architecture:** Feature 1 extends the existing `product_images` table with a `kind` column (image|video) and upgrades the R2 upload pipeline to accept video MIME types up to 50 MB, with `ProductGallery.tsx` rendering `<video>` slides with muted autoplay + unmute toggle. Feature 2 surgically edits `HeroBlock.astro`. Feature 3 adds a 19th block type following the same file pattern as `shipping-strip` (Zod schema, admin form, Astro renderer, block registry entry), plus 7 new social SVG icon paths.

**Tech Stack:** Astro SSR + React islands, Drizzle ORM + PostgreSQL, Zod validation, Embla Carousel, Tailwind v4, Cloudflare R2 storage, Vitest.

---

## File Structure

### Feature 1: Video in product carousel

- **Modify** `src/db/schema.ts` — add `kind` column to `productImages`
- **Create** `src/db/migrations/0011_product_media_kind.sql` — generated migration
- **Modify** `src/db/migrations/meta/_journal.json` — append new entry
- **Modify** `src/lib/r2.ts` — rename `uploadImage` → `uploadMedia` + accept video content types
- **Modify** `src/pages/api/admin/upload.ts` — allow video MIME types, 50 MB limit, return `{ url, kind }`
- **Modify** `src/lib/queries.ts` — include `kind` in `ProductWithExtras.images`
- **Modify** `src/pages/api/admin/products/index.ts` — accept `kind` in image items
- **Modify** `src/pages/api/admin/products/[id].ts` — accept `kind` in image items
- **Modify** `src/components/admin/ProductForm.tsx` — section renamed, video upload button, video thumbnail rendering
- **Modify** `src/pages/admin/products/[id].astro` — pass `kind` through to the form
- **Modify** `src/components/islands/ProductGallery.tsx` — render video slides with muted autoplay + mute toggle + inter-slide pause
- **Modify** `src/components/blocks/ProductGalleryBlock.astro` — pass `kind` into the island
- **Modify** `src/pages/catalogo/[slug].astro` — pass `kind` in fallback gallery render

### Feature 2: Hero adjustments

- **Modify** `src/components/blocks/HeroBlock.astro` — `background-image` layout only

### Feature 3: `social-links` block

- **Modify** `src/lib/icons.ts` — add `SocialIconName` type + `SOCIAL_ICON_PATHS` record
- **Modify** `src/lib/blocks.ts` — add `socialLinksDataSchema`, register block in discriminated union, `BLOCK_TYPES`, `createBlock()`
- **Create** `src/lib/blocks.test.ts` — Zod round-trip test for the new schema (TDD)
- **Create** `src/components/admin/SocialIconPreview.tsx` — renders a social SVG for the admin picker
- **Modify** `src/components/admin/BlockForm.tsx` — add `SocialLinksForm` + `SocialIconPicker`
- **Create** `src/components/blocks/SocialLinksBlock.astro` — storefront renderer
- **Modify** `src/components/blocks/BlockRenderer.astro` — dispatch `social-links`

---

## Feature 1 — Video in product carousel

### Task 1: Add `kind` column to `productImages` schema

**Files:**
- Modify: `src/db/schema.ts:92-104`

- [ ] **Step 1: Edit `src/db/schema.ts`** — change the `productImages` table definition:

```ts
export const productImages = pgTable(
  "product_images",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    alt: text("alt").notNull().default(""),
    position: integer("position").notNull().default(0),
    kind: text("kind").notNull().default("image"),
  },
  (t) => [index("product_images_product_idx").on(t.productId)],
);
```

Also add right below (alongside the other type exports at the bottom of the file):

```ts
export type ProductMediaKind = "image" | "video";
```

- [ ] **Step 2: Generate the migration**

Run: `npm run db:generate`

Expected: Drizzle prints the new migration file path under `src/db/migrations/` (next sequence number `0011_*.sql`) and updates `meta/_journal.json`. The SQL should contain `ALTER TABLE "product_images" ADD COLUMN "kind" text DEFAULT 'image' NOT NULL;`.

- [ ] **Step 3: Rename the generated migration for clarity**

Drizzle uses random names (e.g. `0011_young_nebula.sql`). Rename to a descriptive name and update the journal:

```bash
mv src/db/migrations/0011_*.sql src/db/migrations/0011_product_media_kind.sql
```

Then open `src/db/migrations/meta/_journal.json` and change the `"tag"` field of the newest entry to `"0011_product_media_kind"` (keep the `when` timestamp and `idx`).

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.ts src/db/migrations/0011_product_media_kind.sql src/db/migrations/meta/_journal.json src/db/migrations/meta/0011_snapshot.json
git commit -m "feat(db): add kind column to product_images for video support"
```

---

### Task 2: Extend R2 upload helper to accept videos

**Files:**
- Modify: `src/lib/r2.ts:25-51`

- [ ] **Step 1: Edit `src/lib/r2.ts`** — rename `uploadImage` → `uploadMedia` and pick the storage prefix based on content type:

```ts
export const uploadMedia = async (
  file: Buffer,
  contentType: string,
  filename: string,
): Promise<string> => {
  if (!client || !bucket || !publicUrl) {
    throw new Error(
      "Cloudflare R2 não configurado. Define R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET e R2_PUBLIC_URL.",
    );
  }

  const isVideo = contentType.startsWith("video/");
  const prefix = isVideo ? "products/videos" : "products";
  const key = `${prefix}/${Date.now()}-${filename.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return `${publicUrl.replace(/\/$/, "")}/${key}`;
};

// Back-compat alias so older imports keep working
export const uploadImage = uploadMedia;
```

- [ ] **Step 2: Verify no other callers break**

Run: `grep -rn "uploadImage\|uploadMedia" src/`

Expected: `src/pages/api/admin/upload.ts` uses `uploadImage` and still resolves via the alias. No build errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/r2.ts
git commit -m "feat(r2): rename uploadImage to uploadMedia, keep alias, separate video prefix"
```

---

### Task 3: Accept video uploads at `/api/admin/upload`

**Files:**
- Modify: `src/pages/api/admin/upload.ts`

- [ ] **Step 1: Rewrite the upload handler** with MIME allowlist, differentiated size limits, and `kind` response field:

```ts
import type { APIRoute } from "astro";
import { uploadMedia, r2Configured } from "../../../lib/r2";

export const prerender = false;

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  if (!r2Configured) {
    return new Response(
      JSON.stringify({
        error:
          "Cloudflare R2 não configurado. Define R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET e R2_PUBLIC_URL nas env vars. Alternativa: usa 'Adicionar URL' com uma imagem alojada externamente.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return new Response(JSON.stringify({ error: "Sem ficheiro" }), { status: 400 });
  }

  const isImage = ALLOWED_IMAGE_TYPES.has(file.type);
  const isVideo = ALLOWED_VIDEO_TYPES.has(file.type);

  if (!isImage && !isVideo) {
    return new Response(
      JSON.stringify({
        error: `Tipo de ficheiro não suportado (${file.type || "desconhecido"}). Usa JPG/PNG/WEBP/GIF para imagens ou MP4/WebM/MOV para vídeos.`,
      }),
      { status: 415 },
    );
  }

  const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / 1024 / 1024);
    return new Response(
      JSON.stringify({ error: `Ficheiro demasiado grande (máx ${mb}MB)` }),
      { status: 413 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadMedia(buffer, file.type, file.name);
    const kind = isVideo ? "video" : "image";
    return new Response(JSON.stringify({ url, kind }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[upload] Falha:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Erro no upload",
      }),
      { status: 500 },
    );
  }
};
```

- [ ] **Step 2: Manually smoke-test**

With the dev server running (`npm run dev`), use the admin UI to upload an image — it should succeed. Try uploading a `.txt` file renamed to `.mp4` — it should 415. Try a 60MB fake file via `dd if=/dev/urandom of=/tmp/big.mp4 bs=1M count=60` — it should 413.

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/admin/upload.ts
git commit -m "feat(api): accept video uploads up to 50MB with MIME allowlist"
```

---

### Task 4: Include `kind` in `ProductWithExtras`

**Files:**
- Modify: `src/lib/queries.ts:20-22, 46-73`

- [ ] **Step 1: Update the `images` field type** in `ProductWithExtras`:

```ts
images: Array<{ url: string; alt: string; position: number; kind: "image" | "video" }>;
```

- [ ] **Step 2: Update the mapper inside `attachExtras`** (the line that builds `images` from `allImages`):

```ts
images: allImages
  .filter((i) => i.productId === p.id)
  .sort((a, b) => a.position - b.position)
  .map((i) => ({
    url: i.url,
    alt: i.alt,
    position: i.position,
    kind: (i.kind === "video" ? "video" : "image") as "image" | "video",
  })),
```

The narrowing guards against future schema changes where `kind` might drift — any non-`"video"` value falls back to `"image"` (safe default matching the DB default).

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/queries.ts
git commit -m "feat(queries): surface kind field in ProductWithExtras.images"
```

---

### Task 5: Accept `kind` in admin product create/update APIs

**Files:**
- Modify: `src/pages/api/admin/products/index.ts:30-32, 78-87`
- Modify: `src/pages/api/admin/products/[id].ts` — same pattern in its ProductSchema + update block

- [ ] **Step 1: Update `ProductSchema` in `src/pages/api/admin/products/index.ts`** — change the `images` line:

```ts
  images: z
    .array(
      z.object({
        url: z.string(),
        alt: z.string().default(""),
        kind: z.enum(["image", "video"]).default("image"),
      }),
    )
    .default([]),
```

And update the `insert` block that writes images (around line 78) to include `kind`:

```ts
      if (parsed.data.images.length > 0) {
        await tx.insert(schema.productImages).values(
          parsed.data.images.map((img, i) => ({
            productId: product.id,
            url: img.url,
            alt: img.alt,
            position: i,
            kind: img.kind,
          })),
        );
      }
```

- [ ] **Step 2: Apply the same two edits to `src/pages/api/admin/products/[id].ts`**

Find the matching `ProductSchema` (around line 30-something) and the `insert(schema.productImages)` block (inside the UPDATE/PUT handler) and mirror the changes from Step 1.

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/api/admin/products/index.ts src/pages/api/admin/products/[id].ts
git commit -m "feat(api): persist image/video kind on product create/update"
```

---

### Task 6: Extend `ProductForm.tsx` with video upload

**Files:**
- Modify: `src/components/admin/ProductForm.tsx`

- [ ] **Step 1: Update the `ProductFormData` type** — the `images` field:

```ts
images: Array<{ url: string; alt: string; kind: "image" | "video" }>;
```

And keep `emptyProduct.images` as `[]` (unchanged, but note that `kind` is now required on any row that gets added).

- [ ] **Step 2: Replace `handleImageUpload` with `handleMediaUpload(file, kind)`** — accepts the kind argument explicitly rather than inferring:

```tsx
const handleMediaUpload = async (file: File, kind: "image" | "video") => {
  setUploading(true);
  setError(null);
  try {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/upload", {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Erro ${res.status}`);
    }
    const body = (await res.json()) as { url: string; kind: "image" | "video" };
    update("images", [...data.images, { url: body.url, alt: "", kind: body.kind ?? kind }]);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Falha no upload");
  } finally {
    setUploading(false);
  }
};
```

- [ ] **Step 3: Update `handleImageUrlAdd`** — the URL-paste path stays image-only and explicitly tags the kind:

```tsx
const handleImageUrlAdd = () => {
  const url = prompt("URL da imagem:");
  if (!url) return;
  update("images", [...data.images, { url, alt: "", kind: "image" }]);
};
```

- [ ] **Step 4: Update the media-list renderer** inside the section to show a video thumbnail and badge when `img.kind === "video"`. Replace the current `<img>` thumbnail block (the `<div class="h-16 w-16 shrink-0 ...">` inside `data.images.map`):

```tsx
<div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-rosa-50">
  {img.kind === "video" ? (
    <>
      <video
        src={img.url}
        preload="metadata"
        muted
        playsInline
        className="h-full w-full object-cover"
      />
      <span className="pointer-events-none absolute bottom-0.5 left-0.5 rounded bg-ink/80 px-1 text-[8px] font-semibold uppercase text-white">
        Vídeo
      </span>
    </>
  ) : (
    <img src={img.url} alt={img.alt} className="h-full w-full object-cover" />
  )}
</div>
```

- [ ] **Step 5: Rename the section heading and swap the upload buttons**

Find the heading `<h2 className="text-lg font-semibold text-ink">Imagens</h2>` and change to:

```tsx
<h2 className="text-lg font-semibold text-ink">Imagens e vídeos</h2>
```

Update the helper text below it:

```tsx
<p className="mt-1 text-xs text-ink-muted">
  Adiciona fotos reais do produto e, opcionalmente, um vídeo curto (até 50 MB, MP4/WebM/MOV). Ordena com as setas ↑↓.
</p>
```

Replace the single `+ Upload de imagem` label block with two buttons + updated URL button:

```tsx
<div className="mt-4 flex flex-wrap gap-3">
  <label className="cursor-pointer rounded-full bg-rosa-400 px-4 py-2 text-xs font-medium text-white hover:bg-rosa-500">
    {uploading ? "A enviar…" : "+ Upload de imagem"}
    <input
      type="file"
      accept="image/*"
      className="hidden"
      disabled={uploading}
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) handleMediaUpload(f, "image");
        e.target.value = "";
      }}
    />
  </label>
  <label className="cursor-pointer rounded-full border border-rosa-300 bg-white px-4 py-2 text-xs font-medium text-rosa-500 hover:border-rosa-500">
    {uploading ? "A enviar…" : "+ Upload de vídeo"}
    <input
      type="file"
      accept="video/mp4,video/webm,video/quicktime"
      className="hidden"
      disabled={uploading}
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) handleMediaUpload(f, "video");
        e.target.value = "";
      }}
    />
  </label>
  <button
    type="button"
    onClick={handleImageUrlAdd}
    className="rounded-full border border-ink-line px-4 py-2 text-xs font-medium text-ink-soft hover:border-rosa-300 hover:text-rosa-500"
  >
    + Adicionar URL de imagem
  </button>
</div>
```

- [ ] **Step 6: Verify types compile**

Run: `npx tsc --noEmit`

Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/ProductForm.tsx
git commit -m "feat(admin): upload videos to product carousel via ProductForm"
```

---

### Task 7: Pass `kind` through the admin edit page loader

**Files:**
- Modify: `src/pages/admin/products/[id].astro:30-35`

- [ ] **Step 1: Find the object passed as `initial` to `<ProductForm>`** — update the `images` mapping to include `kind`:

```astro
  images: product.images.map((i) => ({ url: i.url, alt: i.alt, kind: i.kind })),
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`

Expected: no errors (the type in `ProductFormData.images` now requires `kind`).

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/products/[id].astro
git commit -m "feat(admin): surface media kind when editing existing products"
```

---

### Task 8: Render videos in the storefront carousel

**Files:**
- Modify: `src/components/blocks/ProductGalleryBlock.astro:18-24`
- Modify: `src/pages/catalogo/[slug].astro` (fallback render, around line 115)
- Modify: `src/components/islands/ProductGallery.tsx`

- [ ] **Step 1: Update `ProductGalleryBlock.astro`** — pass `kind` in the images prop:

```astro
  <ProductGallery
    client:load
    images={product.images.map((i) => ({ url: i.url, alt: i.alt, kind: i.kind }))}
    productName={product.name}
    showThumbs={data.showThumbs}
    showBadges={data.showBadges}
    badges={{ bestseller: product.bestseller, outOfStock: !available }}
  />
```

- [ ] **Step 2: Also update `src/pages/catalogo/[slug].astro`** — find the `<ProductGallery>` JSX block in the fallback layout (the one rendered when a product-detail template is not active) and change the `images` prop the same way:

```astro
  images={product.images.map((i) => ({ url: i.url, alt: i.alt, kind: i.kind }))}
```

- [ ] **Step 3: Update `src/components/islands/ProductGallery.tsx`** — expand the `Image` type:

```tsx
type MediaItem = { url: string; alt?: string; kind?: "image" | "video" };

type Props = {
  images: MediaItem[];
  productName: string;
  showThumbs?: boolean;
  showBadges?: boolean;
  badges?: { bestseller?: boolean; outOfStock?: boolean };
};
```

Rename the internal variable `safeImages` references to `safeMedia`:

```tsx
const safeMedia: MediaItem[] = images.length > 0 ? images : [{ url: "/placeholders/product.svg", alt: productName, kind: "image" }];
const single = safeMedia.length <= 1;
```

Everywhere the code used `safeImages`, use `safeMedia` instead.

- [ ] **Step 4: Add mute state + video-ref tracking**

Near the top of the `ProductGallery` function, after the existing `useState(0)`, add:

```tsx
const [muted, setMuted] = useState(true);
const videoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());
const hasAnyVideo = safeMedia.some((m) => m.kind === "video");
```

Also add `useRef` to the imports from `react` at the top of the file.

- [ ] **Step 5: Pause non-active videos, play the active one**

After the existing `useEffect` that subscribes to Embla's `select` event, add a new effect:

```tsx
useEffect(() => {
  videoRefs.current.forEach((video, idx) => {
    if (idx === selectedIndex) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  });
}, [selectedIndex]);
```

- [ ] **Step 6: Render videos inside the main slide track**

In the single-slide branch (the `if (single) { ... }` block), replace the single `<img>` with a conditional:

```tsx
if (single) {
  const media = safeMedia[0]!;
  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-square overflow-hidden rounded-3xl border border-ink-line bg-rosa-50">
        {media.kind === "video" ? (
          <video
            ref={(el) => { if (el) videoRefs.current.set(0, el); else videoRefs.current.delete(0); }}
            src={media.url}
            autoPlay
            muted={muted}
            loop
            playsInline
            className="h-full w-full object-cover"
            aria-label={media.alt || productName}
          />
        ) : (
          <img src={media.url} alt={media.alt || productName} className="h-full w-full object-cover" />
        )}
        {showBadges && <Badges {...badges} />}
        {media.kind === "video" && <MuteToggle muted={muted} onToggle={() => setMuted((m) => !m)} />}
      </div>
    </div>
  );
}
```

In the multi-slide branch, replace the slide body `<img>` with the same conditional (keep all the Embla wiring around it intact):

```tsx
{safeMedia.map((media, i) => (
  <div
    key={i}
    className="relative aspect-square w-full flex-[0_0_100%]"
    role="group"
    aria-roledescription="slide"
    aria-label={`${i + 1} de ${safeMedia.length}`}
  >
    {media.kind === "video" ? (
      <video
        ref={(el) => { if (el) videoRefs.current.set(i, el); else videoRefs.current.delete(i); }}
        src={media.url}
        autoPlay
        muted={muted}
        loop
        playsInline
        className="h-full w-full object-cover"
        aria-label={media.alt || productName}
      />
    ) : (
      <img
        src={media.url}
        alt={media.alt || productName}
        className="h-full w-full object-cover"
        draggable={false}
      />
    )}
  </div>
))}
```

And right after the prev/next buttons (before the dots pagination), conditionally add the mute toggle (only when there's at least one video in the carousel):

```tsx
{hasAnyVideo && (
  <MuteToggle muted={muted} onToggle={() => setMuted((m) => !m)} />
)}
```

- [ ] **Step 7: Add the `MuteToggle` helper component** at the bottom of the file (below `Badges`):

```tsx
function MuteToggle({ muted, onToggle }: { muted: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={muted ? "Ativar som" : "Desativar som"}
      aria-pressed={!muted}
      className="absolute bottom-3 right-3 z-10 rounded-full bg-white/90 p-2 text-ink shadow-md ring-1 ring-ink-line transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-rosa-500"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
        {muted ? (
          <>
            <path d="M11 5 6 9H2v6h4l5 4V5z" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </>
        ) : (
          <>
            <path d="M11 5 6 9H2v6h4l5 4V5z" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
          </>
        )}
      </svg>
    </button>
  );
}
```

- [ ] **Step 8: Update the thumbnail strip to show video preview frame + play icon**

Inside the `showThumbs` block, replace the thumbnail `<img>` with a conditional:

```tsx
{media.kind === "video" ? (
  <div className="relative h-full w-full">
    <video
      src={media.url}
      preload="metadata"
      muted
      playsInline
      className="h-full w-full object-cover"
    />
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="h-6 w-6 drop-shadow">
        <path d="M8 5v14l11-7z" />
      </svg>
    </span>
  </div>
) : (
  <img src={media.url} alt={media.alt || productName} className="h-full w-full object-cover" />
)}
```

- [ ] **Step 9: Verify types compile + run existing tests**

Run: `npx tsc --noEmit && npm test`

Expected: no new errors, no test regressions (existing tests don't touch this island).

- [ ] **Step 10: Smoke-test in the browser**

Run: `npm run dev`

Navigate to a product that has only images — carousel should work exactly as before. Then upload a video to that product via `/admin/products/[id]`, save, and reload the product page. Verify:
- Video autoplays muted on the slide where it sits
- Scrolling to another slide pauses the video
- Mute toggle button toggles sound
- Thumbnail shows a play overlay

- [ ] **Step 11: Commit**

```bash
git add src/components/blocks/ProductGalleryBlock.astro src/pages/catalogo/[slug].astro src/components/islands/ProductGallery.tsx
git commit -m "feat(storefront): render product videos in carousel with mute toggle"
```

---

## Feature 2 — Hero adjustments

### Task 9: Remove overlay + add drop-shadow + wider padding (background-image layout only)

**Files:**
- Modify: `src/components/blocks/HeroBlock.astro:23-52`

- [ ] **Step 1: Edit the `background-image` branch** (the entire `{layout === "background-image" ? (` block). Replace it with:

```astro
{layout === "background-image" ? (
  <section
    class="relative overflow-hidden bg-cover bg-center"
    style={`background-image:url('${data.imageUrl}')`}
  >
    <div class="relative mx-auto max-w-3xl px-6 py-28 text-center text-white sm:px-10 md:py-36 lg:px-16 lg:py-44">
      {(data.title || data.titleAccent) && (
        <h1 class="text-4xl font-semibold leading-tight tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)] sm:text-5xl lg:text-6xl">
          {data.title && <span>{data.title}</span>}
          {data.title && data.titleAccent && <br />}
          {data.titleAccent && <span class="text-rosa-300">{data.titleAccent}</span>}
        </h1>
      )}
      {subtitleHtml && (
        <div class="mx-auto mt-6 max-w-lg text-base leading-relaxed text-white/90 drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)] sm:text-lg" set:html={subtitleHtml} />
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
  </section>
) : layout === "centered" ? (
```

Key differences from the current code:
- The `<div class="absolute inset-0 bg-black/40"></div>` overlay element is gone.
- The content container no longer uses `.section` — explicit `mx-auto max-w-3xl px-6 sm:px-10 lg:px-16` instead, so we control the padding + max-width directly.
- `<h1>` got `drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]`.
- Subtitle `<div>` got `drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)]` and upgraded from `text-white/80` to `text-white/90` (sharper now that there's no overlay).

The other branches (`layout === "centered"`, `layout === "image-left"`, default `image-right`) stay **exactly unchanged**.

- [ ] **Step 2: Smoke-test in the browser**

Run: `npm run dev`

Go to `/admin/pages` → Início → edit the hero block, set `layout: "background-image"` with an image URL, publish, and reload `/`. Verify:
- No dark overlay on the photo
- Title and subtitle remain legible against both a light and a dark test image (swap imageUrl to a bright beach photo and to a dark indoor photo — text should read in both)
- On desktop (>1024px) text doesn't touch the edges

- [ ] **Step 3: Commit**

```bash
git add src/components/blocks/HeroBlock.astro
git commit -m "feat(hero): drop overlay in background-image layout, add drop-shadow + wider lateral padding"
```

---

## Feature 3 — `social-links` CMS block

### Task 10: Add social icon SVG paths

**Files:**
- Modify: `src/lib/icons.ts`

- [ ] **Step 1: Append the social icon type, paths, and icon list** — keep the existing `IconName` / `ICON_PATHS` block intact; add underneath:

```ts
export type SocialIconName =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "youtube"
  | "pinterest"
  | "whatsapp"
  | "email";

export const SOCIAL_ICON_PATHS: Record<SocialIconName, string> = {
  instagram:
    "M12 2.2c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.42.56.22.96.48 1.38.9.42.42.68.82.9 1.38.17.43.37 1.06.42 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.42 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.43.17-1.06.37-2.23.42-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.42-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.17-.43-.37-1.06-.42-2.23C2.21 15.58 2.2 15.2 2.2 12s.01-3.58.07-4.85c.05-1.17.25-1.8.42-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.43-.17 1.06-.37 2.23-.42C8.42 2.21 8.8 2.2 12 2.2zm0 2.16c-3.14 0-3.51.01-4.75.07-.93.04-1.44.2-1.77.33-.45.17-.77.38-1.1.71-.34.33-.54.65-.72 1.1-.13.33-.29.84-.33 1.77-.06 1.24-.07 1.61-.07 4.75s.01 3.51.07 4.75c.04.93.2 1.44.33 1.77.18.45.38.77.72 1.1.33.33.65.54 1.1.72.33.13.84.29 1.77.33 1.24.06 1.61.07 4.75.07s3.51-.01 4.75-.07c.93-.04 1.44-.2 1.77-.33.45-.18.77-.38 1.1-.72.33-.33.54-.65.72-1.1.13-.33.29-.84.33-1.77.06-1.24.07-1.61.07-4.75s-.01-3.51-.07-4.75c-.04-.93-.2-1.44-.33-1.77-.18-.45-.38-.77-.72-1.1-.33-.33-.65-.54-1.1-.71-.33-.13-.84-.29-1.77-.33-1.24-.06-1.61-.07-4.75-.07zm0 3.68a4 4 0 110 8 4 4 0 010-8zm0 2.16a1.84 1.84 0 100 3.68 1.84 1.84 0 000-3.68zm4.24-2.66a.96.96 0 110 1.92.96.96 0 010-1.92z",
  facebook:
    "M13.5 21v-7.5h2.5l.5-3h-3v-2c0-.9.25-1.5 1.5-1.5h1.6V4.1c-.28-.04-1.23-.1-2.33-.1-2.3 0-3.77 1.4-3.77 3.97V10.5H8v3h2.5V21z",
  tiktok:
    "M16.8 2.2c.18 1.6.97 3.03 2.25 3.97 1 .74 2.22 1.17 3.5 1.2v3.34c-1.88-.05-3.7-.62-5.27-1.63v7.38c0 4.25-3.37 7.7-7.51 7.7-2.12 0-4.03-.9-5.4-2.35a7.8 7.8 0 01-2.07-5.35c0-4.26 3.37-7.71 7.5-7.71.42 0 .83.04 1.23.1v3.42a4.33 4.33 0 00-1.23-.18c-2.33 0-4.22 1.94-4.22 4.34 0 2.4 1.89 4.34 4.22 4.34 2.33 0 4.22-1.94 4.22-4.34V2.2h2.78z",
  youtube:
    "M21.58 7.19c-.23-.86-.9-1.53-1.75-1.76C18.26 5 12 5 12 5s-6.26 0-7.83.43c-.85.23-1.52.9-1.75 1.76C2 8.77 2 12 2 12s0 3.23.42 4.81c.23.86.9 1.53 1.75 1.76C5.74 19 12 19 12 19s6.26 0 7.83-.43c.85-.23 1.52-.9 1.75-1.76C22 15.23 22 12 22 12s0-3.23-.42-4.81zM10 15V9l5.2 3-5.2 3z",
  pinterest:
    "M12 2C6.48 2 2 6.48 2 12c0 4.24 2.64 7.86 6.36 9.32-.09-.79-.17-2.01.04-2.87.19-.78 1.23-4.95 1.23-4.95s-.31-.63-.31-1.56c0-1.46.85-2.55 1.9-2.55.9 0 1.33.67 1.33 1.48 0 .9-.57 2.25-.87 3.51-.24 1.04.52 1.89 1.55 1.89 1.86 0 3.29-1.96 3.29-4.79 0-2.51-1.8-4.26-4.37-4.26-2.97 0-4.72 2.23-4.72 4.54 0 .9.35 1.87.78 2.39.08.11.1.2.07.31-.08.34-.26 1.04-.3 1.18-.05.2-.16.24-.37.14-1.37-.64-2.23-2.63-2.23-4.24 0-3.45 2.51-6.63 7.23-6.63 3.8 0 6.75 2.71 6.75 6.32 0 3.77-2.38 6.81-5.69 6.81-1.11 0-2.15-.58-2.51-1.26l-.68 2.6c-.25.96-.92 2.16-1.37 2.89.73.23 1.5.35 2.31.35 5.52 0 10-4.48 10-10S17.52 2 12 2z",
  whatsapp:
    "M17.5 14.38c-.28-.14-1.65-.81-1.9-.91-.26-.09-.44-.14-.63.14-.19.28-.72.91-.88 1.1-.16.19-.33.21-.6.07-.28-.14-1.18-.43-2.24-1.38-.83-.74-1.39-1.65-1.55-1.93-.16-.28-.02-.43.12-.57.13-.12.28-.33.42-.49.14-.16.19-.28.28-.47.09-.19.05-.35-.02-.49-.07-.14-.63-1.51-.86-2.07-.23-.54-.46-.47-.63-.48l-.54-.01c-.19 0-.49.07-.75.35-.26.28-.99.96-.99 2.35 0 1.39 1.01 2.73 1.15 2.92.14.19 2 3.05 4.85 4.28.68.29 1.2.46 1.61.59.68.21 1.29.18 1.78.11.54-.08 1.65-.67 1.89-1.33.23-.65.23-1.21.16-1.33-.07-.12-.26-.19-.54-.33zM12 2a10 10 0 00-8.6 15.07L2 22l5.08-1.33A10 10 0 1012 2z",
  email:
    "M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm0 2v.4l8 5 8-5V6H4zm0 2.6V18h16V8.6l-8 5-8-5z",
};

export const SOCIAL_ICONS: SocialIconName[] = [
  "instagram",
  "facebook",
  "tiktok",
  "youtube",
  "pinterest",
  "whatsapp",
  "email",
];
```

These paths are designed for a `viewBox="0 0 24 24"` with `fill="currentColor"` (not stroke).

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/icons.ts
git commit -m "feat(icons): add social media glyph paths (IG, FB, TikTok, YT, Pinterest, WhatsApp, Email)"
```

---

### Task 11: Write failing tests for `social-links` Zod schema

**Files:**
- Create: `src/lib/blocks.test.ts`

- [ ] **Step 1: Create the test file** with a round-trip test:

```ts
import { describe, expect, it } from "vitest";
import { blockSchema, createBlock } from "./blocks";

describe("social-links block", () => {
  it("round-trips a populated block through the schema", () => {
    const input = {
      id: "abc1234567",
      type: "social-links" as const,
      data: {
        title: "Segue-nos",
        subtitle: "",
        items: [
          { icon: "instagram" as const, label: "@drisclub", url: "https://instagram.com/drisclub" },
          { icon: "email" as const, label: "", url: "mailto:ola@drisclub.com" },
        ],
      },
    };
    const parsed = blockSchema.parse(input);
    expect(parsed).toEqual(input);
  });

  it("defaults title to 'Segue-nos' and starts with no items", () => {
    const fresh = createBlock("social-links");
    expect(fresh.type).toBe("social-links");
    if (fresh.type !== "social-links") throw new Error("type narrowing");
    expect(fresh.data.title).toBe("Segue-nos");
    expect(fresh.data.items).toEqual([]);
  });

  it("rejects unknown social icon values", () => {
    const bad = {
      id: "abc1234567",
      type: "social-links" as const,
      data: {
        title: "x",
        subtitle: "",
        items: [{ icon: "myspace", label: "", url: "https://example.com" }],
      },
    };
    expect(() => blockSchema.parse(bad)).toThrow();
  });

  it("caps items at 7 entries", () => {
    const icons = [
      "instagram",
      "facebook",
      "tiktok",
      "youtube",
      "pinterest",
      "whatsapp",
      "email",
      "instagram",
    ] as const;
    const input = {
      id: "abc1234567",
      type: "social-links" as const,
      data: {
        title: "x",
        subtitle: "",
        items: icons.map((icon) => ({ icon, label: "", url: "https://x" })),
      },
    };
    expect(() => blockSchema.parse(input)).toThrow();
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npm test -- blocks.test.ts`

Expected: FAILs because `"social-links"` isn't a valid block type yet.

---

### Task 12: Add `social-links` to the Zod schema + registry

**Files:**
- Modify: `src/lib/blocks.ts`

- [ ] **Step 1: Add the schema + types** — right after the `featureListDataSchema` definition (around line 173):

```ts
const socialIconSchema = z.enum([
  "instagram",
  "facebook",
  "tiktok",
  "youtube",
  "pinterest",
  "whatsapp",
  "email",
]);
export type SocialIcon = z.infer<typeof socialIconSchema>;

const socialLinksDataSchema = z.object({
  title: z.string().default("Segue-nos"),
  subtitle: z.string().default(""),
  items: z.array(z.object({
    icon: socialIconSchema.default("instagram"),
    label: z.string().default(""),
    url: safeUrl,
  })).max(7).default([]),
});
```

- [ ] **Step 2: Add the block schema wrapper** — next to the other `*BlockSchema` declarations (around line 177):

```ts
const socialLinksBlockSchema = z.object({
  id: z.string(),
  type: z.literal("social-links"),
  data: socialLinksDataSchema,
});
```

- [ ] **Step 3: Register it in the discriminated union** — inside `blockSchema`, add `socialLinksBlockSchema` to the array (keep the list tidy — put it next to `featureListBlockSchema`):

```ts
export const blockSchema = z.discriminatedUnion("type", [
  heroBlockSchema,
  textBlockSchema,
  productGridBlockSchema,
  categoryGridBlockSchema,
  imageGalleryBlockSchema,
  ctaBannerBlockSchema,
  faqBlockSchema,
  contactInfoBlockSchema,
  testimonialsBlockSchema,
  newsletterBlockSchema,
  imageTextSplitBlockSchema,
  videoEmbedBlockSchema,
  dividerBlockSchema,
  statsBlockSchema,
  shippingStripBlockSchema,
  featureListBlockSchema,
  socialLinksBlockSchema,
  productGalleryBlockSchema,
  productInfoBlockSchema,
  productLongDescriptionBlockSchema,
  productRelatedBlockSchema,
  catalogGridBoundBlockSchema,
]);
```

- [ ] **Step 4: Export the data type** — next to other `*Data` exports (around line 313):

```ts
export type SocialLinksData = z.infer<typeof socialLinksDataSchema>;
```

- [ ] **Step 5: Register in `BLOCK_TYPES`** — add an entry before the data-binding blocks start (between `feature-list` and `product-gallery`):

```ts
  { type: "social-links", label: "Redes Sociais", description: "Tiles com ícones das redes sociais da loja" },
```

- [ ] **Step 6: Add a case to `createBlock()`** — inside the switch, next to `feature-list`:

```ts
case "social-links":
  return { id, type, data: { title: "Segue-nos", subtitle: "", items: [] } };
```

- [ ] **Step 7: Run the tests again — expect PASS**

Run: `npm test -- blocks.test.ts`

Expected: all 4 tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/blocks.ts src/lib/blocks.test.ts
git commit -m "feat(blocks): add social-links block type with Zod schema + tests"
```

---

### Task 13: Create the Astro storefront renderer

**Files:**
- Create: `src/components/blocks/SocialLinksBlock.astro`
- Modify: `src/components/blocks/BlockRenderer.astro`

- [ ] **Step 1: Create `SocialLinksBlock.astro`**

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
          aria-label={`${item.icon} ${item.label}`.trim()}
        >
          <span class="flex h-12 w-12 items-center justify-center rounded-xl bg-rosa-500 text-white transition group-hover:-translate-y-0.5 group-hover:bg-rosa-600">
            <svg viewBox="0 0 24 24" class="h-6 w-6" fill="currentColor" aria-hidden="true">
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

- [ ] **Step 2: Register in `BlockRenderer.astro`** — add the import at the top (next to the other block imports):

```astro
import SocialLinksBlock from "./SocialLinksBlock.astro";
```

And the case in the body (next to `feature-list`):

```astro
{block.type === "social-links" && <SocialLinksBlock data={block.data} />}
```

- [ ] **Step 3: Smoke-test**

Run: `npm run dev`

Open `/admin/pages` → edit Início → click "+ Adicionar bloco" → pick "Redes Sociais" → add 3 items (Instagram, Facebook, Email) with test URLs → Publicar. Reload `/` and verify:
- Three tiles appear, rosa-brand background, rounded-xl corners
- Hovering a tile lifts it slightly + darkens
- Clicking opens the URL in a new tab
- On mobile (narrow viewport) tiles wrap gracefully

- [ ] **Step 4: Commit**

```bash
git add src/components/blocks/SocialLinksBlock.astro src/components/blocks/BlockRenderer.astro
git commit -m "feat(blocks): storefront renderer for social-links block"
```

---

### Task 14: Admin form for `social-links`

**Files:**
- Create: `src/components/admin/SocialIconPreview.tsx`
- Modify: `src/components/admin/BlockForm.tsx`

- [ ] **Step 1: Create `SocialIconPreview.tsx`** (small helper mirroring `IconPreview.tsx`):

```tsx
import { SOCIAL_ICON_PATHS, type SocialIconName } from "../../lib/icons";

export function SocialIconPreview({
  name,
  className = "h-5 w-5",
}: {
  name: SocialIconName;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d={SOCIAL_ICON_PATHS[name]} />
    </svg>
  );
}
```

- [ ] **Step 2: Import it in `BlockForm.tsx`** — add next to the existing `IconPreview` import at the top:

```tsx
import { SocialIconPreview } from "./SocialIconPreview";
import { SOCIAL_ICONS, type SocialIconName } from "../../lib/icons";
```

- [ ] **Step 3: Add `SocialIconPicker` and `SocialLinksForm` components** at the bottom of the file (after `FeatureListForm`):

```tsx
function SocialIconPicker({ value, onChange }: { value: SocialIconName; onChange: (next: SocialIconName) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {SOCIAL_ICONS.map((icon) => (
        <button
          key={icon}
          type="button"
          onClick={() => onChange(icon)}
          aria-label={icon}
          className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${
            value === icon ? "border-rosa-400 bg-rosa-500 text-white" : "border-ink-line bg-surface text-ink-soft hover:border-rosa-300"
          }`}
        >
          <SocialIconPreview name={icon} className="h-5 w-5" />
        </button>
      ))}
    </div>
  );
}

function SocialLinksForm({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const items: Array<{ icon: SocialIconName; label: string; url: string }> = data.items ?? [];
  const addItem = () =>
    items.length < 7 &&
    onChange({ items: [...items, { icon: "instagram" as SocialIconName, label: "", url: "" }] });
  const removeItem = (idx: number) =>
    onChange({ items: items.filter((_, i) => i !== idx) });
  const updateItem = (
    idx: number,
    patch: Partial<{ icon: SocialIconName; label: string; url: string }>,
  ) => onChange({ items: items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) });

  return (
    <div className="grid gap-4">
      <div>
        <label className="field-label">Título</label>
        <input
          value={data.title ?? ""}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Segue-nos"
          className="field-input"
        />
      </div>
      <div>
        <label className="field-label">Subtítulo (opcional)</label>
        <input
          value={data.subtitle ?? ""}
          onChange={(e) => onChange({ subtitle: e.target.value })}
          className="field-input"
        />
      </div>
      <label className="field-label">Redes (até 7)</label>
      {items.map((it, i) => (
        <div key={i} className="grid gap-2 rounded-xl border border-ink-line bg-surface p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">#{i + 1}</span>
            <button
              type="button"
              onClick={() => removeItem(i)}
              className="text-xs text-ink-muted hover:text-red-500"
            >
              Remover
            </button>
          </div>
          <SocialIconPicker value={it.icon} onChange={(icon) => updateItem(i, { icon })} />
          <input
            value={it.label}
            onChange={(e) => updateItem(i, { label: e.target.value })}
            placeholder="@drisclub (opcional)"
            className="field-input"
          />
          <input
            value={it.url}
            onChange={(e) => updateItem(i, { url: e.target.value })}
            placeholder="https://instagram.com/drisclub"
            className="field-input"
          />
        </div>
      ))}
      {items.length < 7 && (
        <button type="button" onClick={addItem} className="btn-secondary w-fit">
          + Adicionar rede social
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add the dispatch case** inside the top-level `BlockForm` switch (next to `feature-list`):

```tsx
case "social-links":
  return <SocialLinksForm data={block.data} onChange={onChange} />;
```

- [ ] **Step 5: Run the full build + tests**

Run: `npm test && npm run build`

Expected: all tests pass, build succeeds.

- [ ] **Step 6: Smoke-test admin flow end-to-end**

Run: `npm run dev`

Go to `/admin/pages` → Início → click "+ Adicionar bloco" → the picker shows "Redes Sociais" option → select it → form shows title + subtitle + icon picker + label + URL. Add 3 items (Instagram, WhatsApp, Email), save draft, publish. Reload `/` — tiles render as expected.

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/SocialIconPreview.tsx src/components/admin/BlockForm.tsx
git commit -m "feat(admin): editor form for social-links block with icon picker"
```

---

## Release

### Task 15: Final verification + prepare for deploy

- [ ] **Step 1: Run the full test + build pipeline**

Run: `npm test && npm run build`

Expected: green tests, successful build, no TypeScript errors.

- [ ] **Step 2: Walk through all three features on the running dev server**

With `npm run dev`:

1. **Product video** — upload an MP4 to a product, verify carousel on the storefront: autoplay muted, mute toggle works, slide change pauses video.
2. **Hero** — edit the homepage hero to `background-image` layout, confirm no overlay, text is legible, padding is comfortable on desktop and mobile.
3. **Social links** — add the `social-links` block to the homepage with at least 3 networks, verify tiles + hover + target="_blank".

- [ ] **Step 3: Check migration runs cleanly on a fresh DB**

Run: `npm run db:migrate`

Expected: migration `0011_product_media_kind` applies with no errors.

- [ ] **Step 4: Push and deploy**

```bash
git push origin main
```

Railway auto-deploys. Once live:
- Verify existing products still load on `drisclub.com` (regression check).
- Add a video to one product via `/admin/products/[id]` and confirm it plays in production.
- Edit the homepage hero to `background-image` layout and confirm the overlay is gone.
- Add a `social-links` block to the homepage and confirm the tiles render.

---

## Self-Review Notes

**Spec coverage:** All 3 features from `2026-04-24-storefront-media-and-social-design.md` have dedicated tasks. Variant-color feature was explicitly marked "no code changes needed" — that is preserved here (zero tasks, correct). ✅

**Placeholder scan:** No TBD/TODO/"add validation"/etc. Every step shows concrete code or concrete commands. ✅

**Type consistency:**
- `kind` as `"image" | "video"` is used consistently across schema, queries, API, form, and island.
- `SocialIconName` and `SOCIAL_ICONS` are defined once in `icons.ts` and imported everywhere else.
- `uploadMedia` is the new name; `uploadImage` remains as an alias to avoid breaking any stale import during the transition.
- The `SocialLinksData` type shape in the Astro renderer matches the Zod schema exactly.

**Testing reality check:** TDD is enforced only where unit tests add real value (Zod schema round-trip for the new block). The UI pieces (ProductGallery video, HeroBlock, SocialLinksBlock rendering) are Astro SSR or islands where unit tests would require a full browser stub — the plan relies on explicit smoke-test steps in the dev server for those.
