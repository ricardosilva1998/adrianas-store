# Block-Based CMS Design

Replace the current limited page editor with a block-based CMS that lets admins build and edit any page from the admin dashboard using predefined block types.

## Scope

- All pages (homepage, institutional pages, new custom pages) use the block editor
- 8 block types at launch, extensible for future additions
- Replaces the current markdown-only page editor
- Moves hardcoded homepage content into editable blocks

## Data Model

### Pages table changes

Add two columns to the existing `pages` table:

| Column | Type | Description |
|--------|------|-------------|
| blocks | jsonb | Ordered array of block objects. Replaces `body` for rendering. |
| published | boolean | Controls storefront visibility. Defaults to `true`. |

Keep the `body` column temporarily for migration safety. It becomes unused once `blocks` is populated.

### Block schema

Each block in the JSONB array:

```json
{
  "id": "nanoid-string",
  "type": "hero | text | product-grid | category-grid | image-gallery | cta-banner | faq | contact-info",
  "data": { }
}
```

### Block type data shapes

**hero**
```json
{ "title": "", "subtitle": "", "buttonText": "", "buttonUrl": "", "imageUrl": "" }
```

**text**
```json
{ "markdown": "" }
```

**product-grid**
```json
{ "title": "", "subtitle": "", "filter": "bestsellers | category:<slug> | all" }
```

**category-grid**
```json
{ "title": "", "subtitle": "", "categories": ["tote-bags", "t-shirts"] }
```

**image-gallery**
```json
{ "images": [{ "url": "", "alt": "" }] }
```

**cta-banner**
```json
{ "title": "", "subtitle": "", "buttonText": "", "buttonUrl": "", "bgColor": "rosa | ink" }
```

**faq**
```json
{ "title": "", "items": [{ "question": "", "answer": "" }] }
```

**contact-info**
```json
{ "email": "", "whatsapp": "", "instagram": "", "address": "" }
```

### Validation

Zod schemas for each block type, validated on save (API layer). The `blocks` column is validated as an array of discriminated unions on the `type` field.

## Admin Block Editor

### New component: `BlockEditor.tsx`

Replaces `PageEditor.tsx`. A React island mounted on `/admin/pages/[slug]` and `/admin/pages/new`.

**Page settings (top of editor):**
- Title (text input)
- Slug (auto-generated from title, editable)
- Published toggle

**Block list:**
- Vertical list of collapsible panels, one per block
- Each panel header shows: block type label, collapse/expand toggle, up/down reorder buttons, delete button
- Expanded panel shows the block-specific form fields
- Reorder via up/down buttons (same pattern as existing product image reordering)

**Add block:**
- Button at the bottom of the block list
- Opens a picker showing the 8 block types with labels and brief descriptions
- Inserts new block at the end with default empty data

**Per-block forms:**
- `hero`: text inputs for title, subtitle, buttonText, buttonUrl; image upload for imageUrl
- `text`: markdown textarea (reuse existing markdown preview from PageEditor)
- `product-grid`: text inputs for title/subtitle; select for filter (bestsellers, all, or category dropdown)
- `category-grid`: text inputs for title/subtitle; checkbox list of categories
- `image-gallery`: image list with upload/URL add, alt text, reorder (same pattern as product images)
- `cta-banner`: text inputs for title/subtitle/buttonText/buttonUrl; color picker (rosa/ink)
- `faq`: title input; dynamic list of question/answer pairs with add/remove
- `contact-info`: text inputs for email, whatsapp, instagram, address

### Admin pages list (`/admin/pages/`)

- Add "New page" button at the top
- Show published/draft status per page
- Show slug as a link to the storefront page
- Delete page action (with confirmation)

### API changes

**PUT `/api/admin/pages/[slug]`** — update to accept `{ title, slug, blocks, published }` instead of `{ title, body }`.

**POST `/api/admin/pages`** (new) — create a new page.

**DELETE `/api/admin/pages/[slug]`** (already exists) — no changes needed.

## Storefront Rendering

### Dynamic page route

A catch-all route `/src/pages/[...slug].astro` that:

1. Extracts the slug from the URL (empty slug = `"home"`)
2. Fetches the page from the database by slug
3. Returns 404 if page not found or not published
4. Loops through `page.blocks` and renders the corresponding Astro component per block type

### Block renderer components

One Astro component per block type in `src/components/blocks/`:

- `HeroBlock.astro` — reuses the existing Hero visual design
- `TextBlock.astro` — renders markdown with `marked`, wrapped in prose classes
- `ProductGridBlock.astro` — fetches products based on filter, renders grid of ProductCard components
- `CategoryGridBlock.astro` — renders category cards for the selected categories
- `ImageGalleryBlock.astro` — responsive image grid
- `CtaBannerBlock.astro` — colored section with text and CTA button
- `FaqBlock.astro` — collapsible accordion with details/summary elements
- `ContactInfoBlock.astro` — displays contact details with icons

### Routing changes

- Remove `/src/pages/index.astro` — homepage served by `[...slug].astro` with slug `"home"`
- Remove `/src/pages/sobre-nos.astro`, `/src/pages/como-encomendar.astro`, `/src/pages/termos-condicoes.astro` — served by the catch-all
- Keep `/src/pages/catalogo/`, `/src/pages/carrinho.astro`, `/src/pages/checkout.astro`, `/src/pages/obrigado.astro` as-is (these are app routes, not CMS pages)
- The catch-all route must not conflict with these existing routes

## Migration

### Existing institutional pages

Convert the `body` markdown of the 3 existing pages into a single `text` block:

```json
{ "blocks": [{ "id": "...", "type": "text", "data": { "markdown": "<existing body>" } }], "published": true }
```

### Homepage

Create a new page with slug `"home"` containing blocks that replicate the current hardcoded homepage:

1. `hero` block — with current hero text, subtitle, CTA
2. `product-grid` block — filter `"bestsellers"`, current section title/subtitle
3. `category-grid` block — current featured categories
4. `cta-banner` block — current personalization CTA section

### Site config

Move `src/lib/site.ts` contact values into a `contact-info` block on the homepage (or a shared footer mechanism). Navigation links remain in code for now (editable nav is a separate feature).

### Migration script

A one-time migration script (`scripts/migrate-to-blocks.ts`) that:
1. Updates existing pages with blocks derived from their body
2. Creates the "home" page with blocks derived from the current homepage
3. Is idempotent (safe to run multiple times)

## What stays hardcoded

- Navigation links (header/footer) — separate feature if needed later
- Cart, checkout, and thank-you pages — app logic, not content
- Catalog listing and product detail pages — driven by product data, not CMS blocks
- CSS/styling and layout structure within each block type
