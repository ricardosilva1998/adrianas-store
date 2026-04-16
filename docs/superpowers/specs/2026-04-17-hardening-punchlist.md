# Hardening Punchlist — 2026-04-17

Session setup for tomorrow. Context: on 2026-04-16 we shipped 4 phases (test framework, live preview + per-block save, block picker + presets, dark mode), 3 block-variant batches (Hero/CTA/Split/Grid variants + stats/shipping-strip/feature-list new blocks), and 9 critical code-review fixes. Current state: `main` at commit `5abe97d`, 48 tests green, production build clean.

Tomorrow's job: a full UX/UI battery across desktop + mobile, plus the remaining hardening items from three parallel code reviews.

---

## Part A — UX/UI test battery (desktop + mobile)

Run each flow twice: once in a desktop viewport (1280×900), once in mobile (390×844). Use Chrome DevTools device toolbar for mobile.

Test against the deployed site after Railway finishes building. Log in as admin. For each test, note: pass/fail, screenshot if visual bug, brief description.

### Storefront smoke

- [ ] `/` renders the home page, no console errors.
- [ ] `/catalogo` renders the catalog grid.
- [ ] `/catalogo/<any-slug>` renders a product detail page.
- [ ] `/carrinho` (empty and with items) renders correctly.
- [ ] `/checkout` renders and accepts form input.
- [ ] `/obrigado` renders after a mock checkout.
- [ ] Header nav, footer, and banner (from `site_config.globals`) all display.

### Block renderer coverage (storefront)

Visit `/admin/block-preview/<type>` for each of the 21 block types. Verify each renders with the sample data. Types:
`hero, text, product-grid, category-grid, image-gallery, cta-banner, faq, contact-info, testimonials, newsletter, image-text-split, video-embed, divider, stats, shipping-strip, feature-list, product-gallery, product-info, product-long-description, product-related, catalog-grid-bound`.

### Block variants (spot-check)

- [ ] Hero — flip through `image-right`, `image-left`, `background-image` (with and without imageUrl — empty should fall back to centered), `centered`.
- [ ] CTA banner — with `bgColor=ink`, with `bgColor=rosa`, with `backgroundImage` set (verify overlay makes text readable), both `align=left` and `align=center`.
- [ ] Image + text split — all 4 layouts (image-left/right/top/bottom) × 3 `imageAspect` values = 12 combos worth a quick glance each.
- [ ] Product grid — `columns=2/3/4` × `layout=grid/carousel`. For carousel, check horizontal scroll + snap on desktop and mobile.
- [ ] Empty-state check: stats/shipping-strip/feature-list with `items=[]` should render NOTHING (no empty padded box).

### Admin editor flow

- [ ] Log in at `/admin/login`.
- [ ] Land on `/admin` dashboard — stats load, top-products table readable, daily chart visible.
- [ ] Navigate to `/admin/pages` — list shows home + other pages with draft badges where applicable.
- [ ] Open `/admin/pages/home`:
  - [ ] Editor form takes the wider column (left).
  - [ ] Side preview iframe on the right shows the page at desktop-viewport scale.
  - [ ] Click "Abrir pré-visualização" — button is disabled until the preview token loads, then opens a 1280×900 popup.
  - [ ] Edit the Hero title — within ~500ms the side preview AND popup both reload.
  - [ ] Expand a block card — side preview scrolls to that block and flashes a rosa outline.
  - [ ] Click "Guardar bloco" on a block — success indicator; reloading the page shows the edit persisted to draft.
  - [ ] Click "+ Adicionar bloco" — picker modal opens with all 21 types (13 in page context, 5 in product-detail template, 3 new ones).
  - [ ] Insert a block — appears in editor + side preview.
  - [ ] Hamburger menu on block card → "Guardar como bloco personalizado" → enter a name → preset saved. Re-open picker → "Meus blocos" tab shows it.
  - [ ] Insert the preset — new block with fresh id + the saved data.
  - [ ] Try to click Publicar while a block is dirty — button is disabled with tooltip "Guarda todos os blocos primeiro". Save the block, Publish enables.
  - [ ] Click Publicar — page reloads, draft badge is gone, storefront `/` reflects the live content.
  - [ ] Make a new edit, click Descartar rascunho — edits revert.
- [ ] `/admin/pages/new` — legacy `BlockEditor` still works for creation.
- [ ] `/admin/templates` and `/admin/templates/<id>` — catalog + product-detail templates load, picker filters blocks by context correctly.
- [ ] `/admin/slots` and editor — slot block list works with BlockForm UI.
- [ ] `/admin/theme` — color/font/logo editor with live preview iframe.
- [ ] `/admin/globals` — nav/footer/banner/identity tabs, all save.
- [ ] `/admin/media` — gallery list, upload works, delete placeholder works.
- [ ] `/admin/products` — bestseller badges are saturated pink + white (readable).
- [ ] `/admin/products/<slug>` — product form edit + save.
- [ ] `/admin/orders` — filter tabs work, tab active state saturated pink.
- [ ] `/admin/orders/<id>` — order detail + status change.
- [ ] `/admin/users` — admin role badge saturated.

### Dark mode coverage

- [ ] Toggle the sun/moon icon in admin header — admin flips to dark.
- [ ] Reload — dark mode persists (cookie).
- [ ] Repeat all admin navigation and verify text is readable everywhere (no invisible text, no white-on-white, no pink-on-pink).
- [ ] Open any preview iframe in `/admin/theme` — storefront is still light (merchant theme).
- [ ] Toggle back to light, reload — light persists.

### Mobile-specific

- [ ] `<1024px` viewport: admin page editor hides the side preview, editor fills the width. Popup button still works.
- [ ] All storefront pages mobile-responsive (hero stacks, product grid 2-col, etc.).

---

## Part B — Remaining hardening items (from code review)

Grouped by severity. Each entry: short title, file references, and the 1-line remediation.

### Important

1. **`POST /blocks` doesn't reject duplicate ids.**
   `src/pages/api/admin/pages/[slug]/blocks/index.ts`. Add `if (baseBlocks.some(b => b.id === parsed.data.block.id))` guard before `appendBlock`. Add a test case.
2. **`BlockPickerDialog` preset preview uses `?data=<big json>` → URL-length cliff.**
   `src/components/admin/BlockPickerDialog.tsx`. Switch to: POST a short-lived server token when a preset is selected, iframe to `/admin/block-preview/<type>?previewToken=<t>`. Mirrors the page-preview pattern.
3. **`BlockCard` overflow menu has no click-outside / Escape handler.**
   Add a one-off document-click listener that clears `menuOpen` when the click target is outside the menu. Add `onKeyDown={e => e.key === "Escape" && setMenuOpen(false)}` to the button.
4. **`BlockPickerDialog` modal has no focus trap / `role="dialog"` / `aria-modal` / Escape-to-close.**
   Add the attrs; on mount, focus the first tab; on Escape, call `onClose`. Focus-trap: listen for Tab/Shift+Tab and loop within dialog.
5. **`BaseLayout` `dangerouslySetInnerHTML` in the preview-theme-css branch is driven by postMessage payload.**
   `src/layouts/BaseLayout.astro`. After the new `ev.origin` guard we already have, this is safe — the origin check is the guard. Document the invariant with a comment: "Only same-origin senders can dispatch preview-theme-css."
6. **`PreviewShell.tsx` ref-callback fires `onIframeReady` too eagerly.**
   Change to `onLoad={(e) => onIframeReady?.(e.currentTarget.contentWindow)}` on the iframe element instead of the ref callback.
7. **Dirty tracking doesn't cover Title or page-meta edits.**
   `src/components/admin/PageEditor.tsx`. The `title` state can diverge from the server without ever being saved (there's no `/title` endpoint). Publish currently doesn't sync title either. Decide: either add a title save (PATCH), or extend `handlePublish` to also send title (but through the new `/publish` endpoint we promote the draft — title isn't in the draft). Simplest: add a `title` field to the page-preview token so edits reflect in preview, and require the admin to save via the existing PUT to persist title.
8. **`scroll-to-block` animation uses hardcoded `#ED7396`.**
   `src/layouts/BaseLayout.astro`. Read from the merchant theme's `--color-primary` instead, so a rebranded theme highlights with its own primary color.

### Minor / polish

9. **Icon path dictionary is duplicated** in `src/components/blocks/Icon.astro` and `src/components/admin/IconPreview.tsx`. Extract to `src/lib/icons.ts` exporting `ICON_PATHS: Record<IconName, string>` and import from both sides.
10. **`marked.parse` runs on every render** in `TextForm` (`BlockForm.tsx:116`) and `ImageTextSplitForm` (`BlockForm.tsx:553`). Wrap in `useMemo(() => marked.parse(data.markdown || "", { async: false }), [data.markdown])`.
11. **`BlockCard` header row is an unsemantic div with `onClick`** — not keyboard-operable. Make it a `<button>` or add `role="button" tabIndex={0}` + keydown handler.
12. **`instantiatePreset` typing uses `data: any`.** Tighten to `Omit<Block, "id">`.
13. **`window.prompt` for preset name** is a quick hack; later, replace with a small modal input for a cleaner UX.
14. **`BlockForm` sub-form prop types are all `{ data: any; onChange: (d: any) => void }`.** Not introduced by this work but worth tightening per-type over time.
15. **`product-grid.filter` is `z.string()` — accepts typos silently.** Tighten to `z.union([z.literal("bestsellers"), z.literal("all"), z.string().regex(/^category:/)])`.
16. **Empty `image-text-split` with `image-top` + `aspect-[3/4]`** visually dominates — consider capping to `max-h-96` when stacked vertically.
17. **`product-grid.layout === "carousel"` with <3 products** looks silly. Fall back to grid when count is low, or center the scroll container.
18. **`PagePreviewShell` + `PreviewShell` DELETE fetch on unmount has no `.catch`.** Add `.catch(() => {})` to silence unhandled-rejection warnings.
19. **Popup close-polling uses a 1-second interval.** Consider replacing with a `blur` / `focus` / `beforeunload` message on the popup side instead of polling.

### Test gaps to close (pick 2-3 worth writing)

20. **`handlePublish` + dirty blocks integration** — render PageEditor with a dirty BlockCard, click Publicar, assert the request DOES NOT fire and the button is disabled.
21. **`POST /blocks` duplicate-id rejection** — once #1 above is implemented.
22. **`/discard-draft` with unknown slug** returns 200 (silent no-op) — either fix to 404 or add a test documenting the behavior.
23. **`scroll-to-block` smoke** — use jsdom + postMessage to assert BaseLayout's listener scrolls and animates.

---

## Part C — Workflow suggestion for tomorrow

1. Start with Part A (manual UX battery). Log pass/fail per item. Expect ~20-30 min for desktop, ~20-30 min for mobile.
2. For each failure, create a TodoWrite task with the file reference.
3. Tackle Part B in this order: Important (1-8) first, then Minor (9-19), then tests (20-23).
4. Each Part-B item is a small, focused commit. Batch small ones if they touch the same file.
5. Final verification: full test run + typecheck + build + full manual smoke on the deployed build.

Estimated total: 4-6 hours to clear Important + a few Minors + the UX battery.

---

## Part D — Decisions already committed to (do not revisit)

- Client state IS the source of truth for block data DURING editing; per-block saves PATCH it to `draftBlocks`. Publish now exclusively promotes server-side `draftBlocks → blocks` — the client no longer sends `blocks` on publish. This is the correct semantics per the original spec.
- Dark mode is admin-only. Storefront always renders in the merchant theme.
- The new-page flow (`/admin/pages/new`) still uses the legacy `BlockEditor`. Unifying with `PageEditor` is scope-expansion, punted.
- "Custom blocks" means named presets. Defining new block TYPES with new fields is out of scope.
- Preview token storage is process-local in-memory with 10-min TTL. Fine for Railway single-worker; re-evaluate if we ever scale horizontally.
