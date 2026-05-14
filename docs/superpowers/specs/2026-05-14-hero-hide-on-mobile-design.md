# Hero — "Esconder na versão mobile"

**Date:** 2026-05-14
**Status:** Approved — ready for implementation plan
**Scope:** Single feature, single implementation plan

## Problem

The admin needs to hide the Hero block on phones for specific pages while keeping it
visible on desktop. Today a Hero block always renders on every viewport; there is no
per-Hero control over mobile visibility.

## Goal

Add a per-Hero-block toggle, **"Esconder na versão mobile"**, that hides that Hero on
viewports below 768px and leaves desktop unchanged.

## Non-goals

- No generic "hide on mobile" for other block types — explicitly scoped to the `hero`
  block only (user decision). The `intro-hero` block is **not** included.
- No "hide on desktop / show only on mobile" — only the mobile-hide direction.
- No server-side viewport detection — the site serves one HTML output for all devices;
  hiding is done with CSS.
- No optimisation of the carousel island when hidden (see Edge cases).

## Constraints / context

- The site is Astro SSR: one HTML response is shared by all viewports. "Hide on mobile"
  therefore means CSS `display:none` below the breakpoint — the Hero stays in the page
  source but is not displayed on phones. This is the same mechanism the Hero already
  uses to hide its desktop-only image columns (`hidden md:block` in `HeroBlock.astro`).
- "Mobile" = `< 768px`. The project's responsive breakpoint is `@media (min-width: 768px)`
  throughout `global.css`; Tailwind's `md:` prefix is the `≥ 768px` boundary.
- Blocks are stored as a JSONB array on `pages` (and on `templates`, `slots`). Each block
  is `{ id, type, data }`, validated by a Zod discriminated union in `src/lib/blocks.ts`.
  Blocks are validated on save (API endpoints); the storefront render path
  (`[...slug].astro`, `Slot.astro`, template routes) does **not** re-parse blocks through
  Zod — it reads the stored JSON directly.

## Design

**Approach A (chosen):** apply the hide as a CSS class on the wrapper `<div>` that
`BlockRenderer.astro` already renders around every block. Chosen over applying it inside
`HeroBlock.astro`, which would touch 5 layout sections for no user-visible difference.

### 1. Schema — `src/lib/blocks.ts`

- Add `hideOnMobile: z.boolean().default(false)` to `heroDataSchema`.
- Add `hideOnMobile: false` to the `data` object in the `createBlock("hero")` factory
  branch, so newly created Hero blocks carry the field explicitly.

The `.default(false)` makes the field backwards-compatible: existing Hero blocks whose
stored JSON has no `hideOnMobile` parse as `false` when next validated on save.

### 2. Render — `src/components/blocks/BlockRenderer.astro`

In the frontmatter, after the existing `attrs` line:

```ts
const hideOnMobile = block.type === "hero" && block.data?.hideOnMobile === true;
```

Change the wrapper element from `<div {...attrs}>` to:

```astro
<div {...attrs} class={hideOnMobile ? "hidden md:block" : undefined}>
```

- `class={undefined}` renders no `class` attribute — every non-hero block and every Hero
  with the flag off renders byte-identically to today.
- `hidden md:block` = `display:none` below 768px, `display:block` at ≥768px.
- Because `BlockRenderer` is the single wrapper used by `[...slug].astro` (pages),
  `Slot.astro` (named slots) and the template routes, the toggle works for a Hero placed
  in any of those contexts.

### 3. Admin form — `src/components/admin/BlockForm.tsx` (`HeroForm`)

- Add a checkbox bound to `data.hideOnMobile`, following the existing boolean-field
  pattern in this file (e.g. the `autoplay` checkbox around `BlockForm.tsx:684`):
  `checked={data.hideOnMobile ?? false}`,
  `onChange={(e) => onChange({ hideOnMobile: e.target.checked })}`.
- **Placement:** near the top of `HeroForm`, immediately after the layout picker — it is
  a Hero-wide option that applies to all 5 layouts, like `layout` itself.
- Copy (pt-PT):
  - Label: **Esconder na versão mobile**
  - Helper text: *O hero deixa de aparecer em telemóveis (ecrãs com menos de 768px de
    largura). No computador continua visível normalmente.*

## Data flow

1. Admin ticks "Esconder na versão mobile" in the Hero block form → `onChange` merges
   `{ hideOnMobile: true }` into `block.data`.
2. Saved into the page's `blocks` (or `draftBlocks`) JSONB through the existing
   draft/publish flow; the API's Zod validation now includes the field.
3. On render, `BlockRenderer` reads `block.data.hideOnMobile`; for a Hero with it `true`,
   the wrapper `<div>` receives `hidden md:block`.
4. CSS hides the Hero below 768px and shows it at ≥768px.

## Edge cases / error handling

- **Existing Hero blocks** (JSON without the field): the render path does not re-parse
  through Zod, so the value is `undefined`; `block.data?.hideOnMobile === true` is `false`
  → Hero visible everywhere, behaviour unchanged. The `false` default is persisted the
  next time that page is saved. No DB migration.
- **Non-hero blocks:** guarded by `block.type === "hero"` — never affected.
- **Carousel layout:** `HeroCarousel` is a `client:load` island. When the Hero is
  `display:none` on mobile it remains in the DOM, so the island still downloads and
  hydrates — invisible to the user, a small amount of wasted JS on phones. Not a bug;
  accepted as a known tradeoff of the smallest-change approach. A future optimisation
  could pass the flag into the island so it skips hydration/autoplay when hidden.
- **Admin preview:** the preview iframe uses real CSS, so resizing it to a mobile width
  correctly shows the Hero hidden.

## Testing

- **`src/lib/blocks.test.ts`** (exists) — extend: a Hero block parses with `hideOnMobile`
  defaulting to `false` when absent, and accepts `true`.
- **`src/components/admin/BlockForm.test.tsx`** (exists) — add: `HeroForm` renders the
  "Esconder na versão mobile" checkbox; toggling it calls `onChange` with
  `{ hideOnMobile: true }`.
- **`BlockRenderer.astro`** — an Astro component, not covered by the Vitest/RTL harness
  (the project has no Astro-component tests). Verified by `npm run build` plus a manual
  check in the admin preview at a mobile width.
- Implementation follows TDD for the two unit-testable changes (schema, form); the
  renderer change is verified by build + preview.

## Files touched

| File | Change |
|---|---|
| `src/lib/blocks.ts` | `hideOnMobile` field on `heroDataSchema` + `createBlock("hero")` factory |
| `src/components/blocks/BlockRenderer.astro` | conditional `hidden md:block` on the wrapper `<div>` |
| `src/components/admin/BlockForm.tsx` | "Esconder na versão mobile" checkbox in `HeroForm` |
| `src/lib/blocks.test.ts` | schema default/accept test |
| `src/components/admin/BlockForm.test.tsx` | hero checkbox render + toggle test |

No new files, no DB migration, no new dependencies.
