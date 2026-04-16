# Admin Editor UX Improvements

Date: 2026-04-16

## Why

The block editor is the heart of the admin. Three rough edges make it painful day-to-day:

1. **No live preview.** Editing a block today is blind. You tweak a field, click "Guardar rascunho", open `?draft=1` in another tab, reload, repeat. That loop is the single biggest friction in the app.
2. **Save is all-or-nothing.** The PUT endpoint replaces the whole `blocks` array. There's no way to save changes to one block without pushing the entire page state. That discourages incremental editing and makes every save feel risky.
3. **"Add block" is a text list.** The admin has to remember what each of the 18 types looks like, and once a block is configured, there's no way to save and reuse it on another page.

Plus a separate small ask: the admin dashboard has no dark mode.

## Goals

- Show the live storefront preview of the page next to the editor, updating as the admin types.
- Let the admin save a single block without touching the rest of the page.
- In the block picker, show what each block will look like before adding it.
- Let the admin save any configured block as a named preset and insert it later.
- Add a dark-mode toggle to the admin dashboard.

## Non-goals

- No changes to the block storage model. Blocks stay as JSONB arrays on `pages` / `templates` / `slots`.
- **"Custom blocks" means named, reusable *presets* of the existing 18 block types.** Introducing new block *types* with new fields and renderers needs code, not admin UI — out of scope.
- **No storefront dark mode.** Storefront colors come from the merchant `site_config.theme` editor. Adding a site-wide dark mode would conflict with that. Dark mode is admin-only.
- Phase 1's live preview + per-block save lands on the **page editor** only. Templates and slots keep today's flow — they can adopt the same pattern in a follow-up once Phase 1 settles.
- No multi-user edit merging. This is a one-admin shop; last-write-wins within a session is fine.

## Overall approach

Three phases, each independently valuable and shippable as its own PR. The work in Phase 1 (preview-token plumbing for pages) is reused by Phase 2's block-picker preview.

---

## Phase 1 — Live preview + per-block save (page editor)

### UX

`/admin/pages/[slug]` switches from a single-column editor to a split-pane shell (same pattern as `/admin/theme`):

- **Left sidebar (420px):** page meta (title, published) + collapsible block cards stacked vertically. Each card shows its form, a **per-block "Guardar" button**, and a subtle "Guardado" indicator after a successful save.
- **Right pane:** iframe showing `/<slug>?preview=<token>` with the live draft applied.
- **Top bar:** device switcher (desktop / mobile), "Publicar" button (promotes draftBlocks → blocks), "Descartar rascunho" button.
- **Block-focus sync:** opening a block card posts `{ kind: "scroll-to-block", id }` to the iframe; the iframe scrolls to `data-block-id={id}` and flashes a 2px rosa outline for 400ms so the admin's eye lands on it.

Edits in a block form debounce 300ms, then push the updated `{ title, blocks }` payload to the preview token. The iframe reloads in-place (`postMessage` → `location.reload()` inside the iframe). A fancier "patch in place without reload" can come later — reloads are correct and fast enough for a 300ms debounce.

### Data flow

The existing `preview-store.ts` keeps only site-config tokens. We add a sibling store for page previews.

- New function `putPagePreview({ slug, title, blocks }): string` and `getPagePreview(token)` in `preview-store.ts`. Same 10-min TTL, same process-local Map.
- Middleware (`src/middleware.ts`) extends: when a storefront route sees `?preview=<token>` AND `locals.user`, it tries `getPreview` (site config) first, then `getPagePreview` (pages). Sets `locals.pagePreview = { title, blocks }` when found.
- `src/pages/[...slug].astro` reads `locals.pagePreview` with this precedence: `pagePreview.blocks ?? page.draftBlocks ?? page.blocks`, same for title. The draft banner becomes "A mostrar pré-visualização ao vivo" when `pagePreview` is set.

### API

New endpoints under `/api/admin/pages/[slug]/`:

| Method | Path | Body | Purpose |
| --- | --- | --- | --- |
| `POST` | `/preview` | `{ title, blocks }` | Create preview token. Returns `{ token }`. |
| `PUT` | `/preview?token=…` | `{ title, blocks }` | Update preview token payload (debounced from editor). |
| `DELETE` | `/preview?token=…` | — | Clear preview token (on editor unmount). |
| `PATCH` | `/blocks/[blockId]` | `{ data }` | Load `draftBlocks ?? blocks`, find matching id, replace its `data`, write back to `draftBlocks`. 404 if id missing. |
| `POST` | `/blocks` | `{ block }` | Append a new block to `draftBlocks` (initializes draftBlocks from `blocks` if null). |
| `DELETE` | `/blocks/[blockId]` | — | Remove the block id from `draftBlocks`. |
| `PUT` | `/blocks/order` | `{ ids: string[] }` | Reorder `draftBlocks` to match given id sequence. 400 if ids don't match. |

Existing `PUT /api/admin/pages/[slug]` is unchanged — it's what "Publicar" calls with `saveAsDraft: false` to promote draft to live. "Descartar rascunho" POSTs to a new `/api/admin/pages/[slug]/discard-draft` that nulls `draftBlocks`.

All mutating endpoints write to `draftBlocks` only — nothing here auto-publishes.

### Dirty state

Each block card tracks client-side `dirty`:

- Editing any field in the form → `dirty = true`, per-block "Guardar" button enabled.
- Successful PATCH → `dirty = false`, button shows "Guardado" for 2s then greys out.
- Leaving the editor with any dirty block triggers a `beforeunload` warning.

"Publicar" submits the whole current client block array via the existing PUT (not per-block), because the client holds the authoritative state — this avoids publishing stale server state when some blocks haven't been individually saved yet.

### Edge cases

- **New page creation (`mode: "create"`):** preview token + per-block endpoints aren't available until the page exists. Creation still uses the old full-submit flow; live preview kicks in after the first save, when we have a slug.
- **Structural changes (add, remove, reorder):** these fire the structural endpoints immediately, not on per-block save. This keeps block IDs consistent between client and server so per-block saves can target them.
- **Block id collisions:** `nanoid(10)` gives ~1e18 combinations; no collision handling needed at this scale.

### Files touched / created

- `src/lib/preview-store.ts` — add `putPagePreview`, `upsertPagePreview`, `getPagePreview`, `clearPagePreview`.
- `src/middleware.ts` — extend preview-token branch to also try page previews.
- `src/pages/[...slug].astro` — read `locals.pagePreview`.
- `src/pages/api/admin/pages/[slug]/preview.ts` — new (POST/PUT/DELETE).
- `src/pages/api/admin/pages/[slug]/blocks/[blockId].ts` — new (PATCH/DELETE).
- `src/pages/api/admin/pages/[slug]/blocks/index.ts` — new (POST).
- `src/pages/api/admin/pages/[slug]/blocks/order.ts` — new (PUT).
- `src/pages/api/admin/pages/[slug]/discard-draft.ts` — new.
- `src/components/admin/BlockEditor.tsx` — refactor into a `PagePreviewShell` wrapper + block list component. Per-block "Guardar" button added to each card. Preview iframe + token lifecycle mirrors `PreviewShell.tsx`.
- `src/components/blocks/BlockRenderer.astro` — wrap output in `<div data-block-id={block.id}>`.
- `src/layouts/BaseLayout.astro` — extend the existing `isPreview` script block to also handle `{ kind: "scroll-to-block", id }` postMessage: scroll the target `[data-block-id]` into view and flash a 2px rosa outline for 400ms.

---

## Phase 2 — Visual block picker + user presets

### UX

Replace the inline 4-column text grid with a modal `BlockPickerDialog.tsx`:

- **Tabs:** "Blocos" · "Meus blocos".
- **"Blocos" tab:** grid of cards for each block type available in the current context. Every card shows:
  - A hand-authored SVG **illustration** of the block's layout (wireframe style — e.g., Hero = big rectangle + two lines of title placeholder + a button pill).
  - Label and description.
- Clicking a card selects it. A **right-side pane** renders a live preview of that block type via iframe pointing to `/admin/block-preview/[type]` with canned sample data. "Inserir" confirms the add and closes the modal.
- **"Meus blocos" tab:** grid of saved presets (admin's own + anything any admin saved — the store is one shared workspace). Each preset card shows:
  - The same type-based SVG illustration, with the preset's name overlaid.
  - A type pill (e.g., "Hero", "FAQ").
- Clicking a preset selects it and shows a live preview (iframe with the preset's stored `data`). "Inserir" adds a deep copy to the page with a fresh `id`.
- **Empty state on "Meus blocos":** short explainer telling the admin they can save any configured block as a preset from the block card's menu (→ Phase 2 adds the menu item).

From the block editor, each block card gets a new overflow menu ("⋯") next to the move/delete buttons. Menu items:
- **Guardar como bloco personalizado…** → prompts for a name, POSTs `{ name, type, data }` to the presets API, toast on success.

### Data model

New table `block_presets`:

```
id             serial PK
name           text NOT NULL
type           text NOT NULL               -- one of the 18 BlockType literals
data           jsonb NOT NULL              -- just the block's `data` payload
created_by     integer REFERENCES users(id) ON DELETE SET NULL
created_at     timestamptz NOT NULL DEFAULT now()
```

Index: `create index block_presets_type_idx on block_presets(type);`

No migration to seed.

### API

All under `/api/admin/block-presets`, middleware-protected:

| Method | Path | Query / Body | Purpose |
| --- | --- | --- | --- |
| `GET` | `/` | `?context=page` (or `template-catalog` / `template-product-detail`) | List presets whose `type` is allowed in that context (reuses `blocksAllowedIn`). |
| `POST` | `/` | `{ name, type, data }` | Validate `data` against the matching block Zod schema. Return 201 + row. |
| `DELETE` | `/[id]` | — | Delete a preset. |

### Block preview route

New admin route: `/admin/block-preview/[type]`.

- Middleware-protected (admin-only).
- Query params:
  - `data` (URL-encoded JSON) — use this as the block's `data`. Validated against the block's schema; invalid → fall back to sample.
  - If no `data`, use `SAMPLE_BLOCK_DATA[type]` from a new `src/lib/block-samples.ts` fixture module (canned sensible-looking data for every block type).
  - `context=product-detail|catalog|page` — for data-binding blocks, which sample product / product list to pass to `BlockRenderer`. `src/lib/block-samples.ts` exports sample product + product array.
- Wraps `BlockRenderer` in a slim layout: reuses the merchant theme CSS but skips Header/Footer. New `src/layouts/BareLayout.astro` (theme CSS + storefront preview script, no header/footer).

### No N-iframes

The picker grid renders **18 SVG illustrations**, not 18 iframes. Only the selected card's right-pane preview is an iframe. This keeps the modal fast and cheap.

SVG illustrations live in `src/components/admin/block-illustrations/`, one TSX file per type exporting a component that returns an inline `<svg>`. Styles use admin CSS vars so they track dark mode in Phase 3.

### Files touched / created

- `src/db/schema.ts` — add `blockPresets` table + type export. Generate migration.
- `src/lib/block-samples.ts` — new.
- `src/components/admin/BlockPickerDialog.tsx` — new.
- `src/components/admin/block-illustrations/*.tsx` — 18 new files.
- `src/components/admin/BlockEditor.tsx` — replace inline picker usage with dialog; add overflow menu with "save as preset".
- `src/components/admin/TemplateEditor.tsx` and `SlotEditor.tsx` — same replacement for consistency. The dialog takes `context` prop so it filters by `blocksAllowedIn`.
- `src/pages/admin/block-preview/[type].astro` — new.
- `src/layouts/BareLayout.astro` — new (theme CSS, no header/footer).
- `src/pages/api/admin/block-presets/index.ts` — new (GET, POST).
- `src/pages/api/admin/block-presets/[id].ts` — new (DELETE).

---

## Phase 3 — Admin dark mode

### Scope

Admin only. The storefront (including preview iframes) always renders with the merchant theme.

### Implementation

**Tokenize the admin surface colors.** Today `AdminLayout`, cards, block editor, etc. use literal `bg-white`, `bg-rosa-50/30`, `border-ink-line`. The `ink-*` tokens are already CSS variables (Tailwind v4 `@theme`), so overriding them in `html.dark` swaps them globally. `bg-white` is the exception — it's a literal. We introduce two new tokens:

```css
@theme {
  --color-surface: #ffffff;
  --color-surface-muted: #faf7f8;   /* replaces bg-rosa-50/30 on admin body */
}

html.dark {
  --color-ink: #f4f4f5;
  --color-ink-soft: #c4c4c7;
  --color-ink-muted: #8a8a94;
  --color-ink-line: #2b2b31;
  --color-surface: #1c1c22;
  --color-surface-muted: #16161a;
}
html.dark body { background: var(--color-surface-muted); }
html.dark { background: var(--color-surface-muted); }
```

Rosa palette stays the same — brand color works on both backgrounds.

**Admin-component sweep:** replace `bg-white` with `bg-surface` and `bg-rosa-50/30` (admin body) with `bg-surface-muted` **only in the admin tree** (`src/layouts/AdminLayout.astro`, `src/components/admin/**`). Storefront components are untouched.

**Toggle + persistence:**

- Icon button in `AdminLayout.astro` header (sun/moon), next to "Ver site".
- On click: writes `adriana-admin-theme` to both `localStorage` and a cookie with `Max-Age=31536000; Path=/; SameSite=Lax`.
- `AdminLayout.astro` reads the cookie server-side; if present, sets `class="dark"` on `<html>` during SSR.
- If no cookie, an inline `<script is:inline>` in `<head>` reads `localStorage` then `prefers-color-scheme` and adds `.dark` before first paint to avoid flash.

**Storefront preview iframes stay light.** The storefront SSR never reads the admin cookie. The admin cookie has no effect on `/`, `/catalogo`, etc. No opt-out needed.

### Files touched / created

- `src/styles/global.css` — new tokens + dark override block.
- `src/layouts/AdminLayout.astro` — cookie read, `.dark` class, no-flash script, toggle button.
- `src/components/admin/ThemeToggle.tsx` — new, small React island.
- Admin component sweep: `BlockEditor.tsx`, `PreviewShell.tsx`, `ProductForm.tsx`, `GlobalsEditor.tsx`, `ThemeEditor.tsx`, `MediaGallery.tsx`, `ImagePicker.tsx`, etc. — replace `bg-white` with `bg-surface`.

---

## Rollout

Each phase is one PR on top of `main`:

1. **Phase 1 PR** — preview-store additions, new API endpoints, refactored page editor with live preview + per-block save. No schema change.
2. **Phase 2 PR** — `block_presets` migration, presets API, new picker dialog with illustrations, block-preview route, save-as-preset menu action.
3. **Phase 3 PR** — CSS tokens, admin sweep, toggle, cookie plumbing.

All three phases are independent and can ship in any order. Recommended sequence is 1 → 2 → 3, because Phase 1 delivers the biggest daily-workflow win and Phase 2's picker benefits from the "live preview" mental model the admin has just internalized.

## Testing (manual)

No test framework configured. Each phase ships with a manual checklist run in `npm run dev`.

**Phase 1**
- Type in Hero title; iframe updates within ~500ms.
- Edit two blocks, save only the first → reload the editor → first block persisted to draft, second block's changes lost (expected).
- Add a block via `POST /blocks`; appears in preview.
- Reorder two blocks; order persists after reload.
- "Publicar" clears `draftBlocks` and makes the change visible on the public URL (no `?preview`).
- Closing the tab with a dirty block triggers the browser "leave?" prompt.

**Phase 2**
- Picker lists all 18 block types with SVG illustrations.
- Selecting each type shows a working preview on the right, with sample data filling text fields.
- Template-only types (product-gallery etc.) are absent from the page editor picker but present in the product-detail template picker.
- Save a hero as a preset → appears in "Meus blocos" → inserting it produces a block with a fresh id but identical data.
- Delete a preset → gone from the list.

**Phase 3**
- Fresh admin login on a `prefers-color-scheme: dark` OS lands in dark mode — no white flash.
- Toggling to light persists across reload and logout/login (cookie).
- Every admin screen readable in both modes (block editor, theme editor, product form, media gallery).
- Navigating from `/admin/theme` to `/` in a new tab: storefront is light regardless of admin mode.
- The PreviewShell iframe inside `/admin/theme` always shows the storefront in its merchant theme, not the admin dark theme.

## Decisions I committed to (no follow-up questions needed)

- **"Custom blocks" = named presets** of existing block types. New block *types* are code.
- **Per-block save writes to `draftBlocks`**, never `blocks`. Publishing is always explicit.
- **Dark mode is admin-only.** Storefront keeps the merchant theme.
- **Phase 1 is pages-only.** Templates and slots get the same treatment later if it proves out.
- **Preset visibility is global** (not per-user). One-admin shop; no sharing/permissions problem to solve.
- **Preview state is process-local in-memory** with 10-min TTL, same as site-config previews. Railway single-worker deploy makes this fine; a second worker would need shared storage (re-evaluate then).
