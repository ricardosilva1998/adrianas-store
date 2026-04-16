# Block Variants + New Block Types

Date: 2026-04-16

## Why

The admin asked for more ways to compose pages. Today every block has exactly one layout; Hero always puts the image on the right, CTA banner is always a flat coloured strip, Product grid always renders a 4-col grid. Also, the merchandising vocabulary is thin — no stats, no trust/shipping row, no feature list.

## Goals

1. Let the admin pick **layout variants** on four existing blocks (Hero, CTA banner, Image+text split, Product grid) via simple pill/select controls — no raw HTML, no new concepts the user has to learn.
2. Add three **new block types** (`stats`, `shipping-strip`, `feature-list`) that follow the existing BlockType pattern end-to-end.
3. Preserve backward compatibility — pages already saved with the old shapes must continue to render identically.

## Non-goals

- External integrations (Instagram embed, map provider).
- Complex blocks with per-page state (hotspotted product images, interactive timeline).
- Per-block A/B variants or feature flags.

## Variants on existing blocks

### Hero
Add `layout` enum: `image-right` (default — matches today's behaviour), `image-left`, `background-image`, `centered`.
- `image-right` / `image-left`: two-column split (today's layout, mirrored).
- `background-image`: `imageUrl` fills the hero; content sits over a solid `bg-black/40` scrim (always readable, no tuning knobs).
- `centered`: no image; title + subtitle + button centred.

### CTA banner
Add optional `backgroundImage` (URL) + `align` (`left` | `center`, default `left`).
- With `backgroundImage`: image fills the banner, `bg-black/50` scrim.
- Without: falls back to existing `bgColor` (ink/rosa).
- `align: center` centres the content block inside the banner.

### Image + text split
Extend `layout` to include `image-top` and `image-bottom` (stacked rather than side-by-side). Add `imageAspect`: `square` | `landscape` | `portrait` (default `landscape`). Existing `image-left`/`image-right` unchanged.

### Product grid
Add `columns` (`2` | `3` | `4`, default `4`) and `layout` (`grid` | `carousel`, default `grid`). Carousel = horizontal scroll with snap points, good on mobile.

## New block types

All three are static-content blocks (allowed in pages, templates, slots). No data-binding.

### `stats`
```ts
{ title?: string, items: Array<{ value: string, label: string }> } // 1..4 items
```
Renders as a horizontal row of large values (e.g., `500+`) with a small caption label (e.g., `peças vendidas`). On mobile, collapses to 2 columns.

### `shipping-strip`
```ts
{ items: Array<{ icon: Icon, title: string, subtitle?: string }> } // 1..4 items
```
Thin horizontal strip with an icon + two-line text per item. Good for "envios grátis > 40€ · pagamento seguro · devoluções 14 dias". Collapses to a 2-column grid on mobile.

### `feature-list`
```ts
{ title?: string, subtitle?: string, items: Array<{ icon: Icon, title: string, description: string }> } // 1..6 items
```
Three-column grid of `icon + title + description`. Single column on mobile.

### Icon enum
Shared across `shipping-strip` and `feature-list`:
```
truck | lock | return | flag | heart | star | shield | sparkle
```
Icons are inline SVGs (no new dependency). A shared `<Icon name="...">` Astro component lives in `src/components/blocks/Icon.astro`; a matching React component `src/components/admin/IconPreview.tsx` renders the same paths for the admin form.

## Data model + backward compat

- Every new field on existing blocks gets a Zod `.default(...)` so data persisted before this change parses unchanged.
- Three new entries in the `blockSchema` discriminated union.
- `BLOCK_TYPES` gets three new metadata rows (static-content tier, allowed everywhere).
- `createBlock()` gains three cases with sensible defaults.
- `SAMPLE_BLOCK_DATA` in `src/lib/block-samples.ts` gains three new entries (and continues to auto-validate via the existing "every sample passes the schema" test).
- No DB migration. `pages.blocks` is jsonb.

## UI

### Storefront renderers (Astro)
- Hero/CtaBanner/ImageTextSplit/ProductGrid updated to branch on the new fields.
- Three new `src/components/blocks/<Type>Block.astro` files.
- `BlockRenderer.astro` dispatch extended.

### Admin forms (React)
- `HeroForm`, `CtaBannerForm`, `ImageTextSplitForm`, `ProductGridForm` in `BlockForm.tsx` get pill-style layout switchers and, where relevant, an `ImagePicker` for the new optional image.
- Three new forms: `StatsForm`, `ShippingStripForm`, `FeatureListForm`. Each uses the same add/remove/reorder-item pattern as `TestimonialsForm` / `FaqForm`.
- Icon picker: a grid of the 8 icons, click to select.

### Picker illustrations
Three new SVG wireframes in `src/components/admin/block-illustrations/`, plus `BlockIllustration` dispatcher entries.

## Testing

- `blocks.test.ts`: one test per new type — parse a minimal shape, parse data saved in old shape (for the updated blocks), assert defaults fill in correctly.
- `block-samples.test.ts`: the existing "every sample passes the schema" test will cover the three new samples automatically.
- Component tests: a smoke test per new form verifying it renders and fires `onChange` on a field edit.

## Scope / rollout

Ship as one bundle. ~13 tasks. All changes are local (no migrations, no external services).

## Open decisions committed to

- **Scrim behaviour on Hero `background-image`:** solid `bg-black/40` overlay, not configurable. Simplest path that always produces readable text.
- **Icon set is an enum**, not free-form SVG paste. Admins pick from a curated list.
- **Carousel for Product grid** uses CSS scroll-snap, no JS library. Works everywhere, no new deps.
