# Low-Code Admin Page Builder — Design Spec

Turn Adriana's Store into a fully admin-customizable storefront. The admin can rebrand the site, edit every page, and rearrange layout without touching code. Delivered in four phases; this spec covers **Phase 1** in full detail and roadmaps Phases 2–4.

## Summary

Single-tenant system (one store, one admin). Editor pattern is **form + live preview** (split pane, desktop/mobile toggle). Architecture uses **layered models**: CMS pages (exist), templates, theme, globals — each matched to its purpose, all sharing one Block renderer and one preview shell.

## Goals

- Non-technical admin can change colors, fonts, logo, nav, footer, banners, site copy without code or a redeploy.
- All existing storefront pages keep working — no rebuild of cart/checkout.
- Phase 1 ships a reusable preview shell that Phases 2–4 plug into.

## Non-goals

- Multi-tenancy or white-label for multiple stores.
- Full visual drag-and-drop canvas (Wix-style).
- Rewriting cart/checkout forms as blocks.
- No test framework exists in this repo; acceptance is manual via `npm run dev`.

## Phasing Roadmap

| Phase | Delivers | Dependencies |
|---|---|---|
| **1 (this spec)** | Theme editor, Globals editor, Preview shell, `site_config` table | None — foundation |
| 2 | 4–6 new block types, drafts, scheduled publishing, block-level style variants | Phase 1 preview shell |
| 3 | `templates` table, catalog template, product-detail template, data-binding blocks | Phase 1 + 2 block library |
| 4 | Named slots in cart / checkout / thank-you | Phase 3 block library |

Each phase is its own brainstorm → spec → plan cycle. This spec locks Phase 1; Phases 2–4 descriptions are directional, not binding.

---

## Phase 1 — Detailed Design

### Architectural decisions

1. **Approach 2, Layered models.** `pages` (exists), `templates` (Phase 3), `theme` + `globals` (Phase 1, combined into one `site_config` table). Clear separation of concerns.
2. **CSS custom properties** for theme propagation. Tailwind v4 already uses `@theme` variables (see `src/styles/global.css`). Runtime overrides are a `<style>` block injected into `<head>` — no rebuild, no hot reload complexity.
3. **Save-is-publish** in Phase 1. Drafts and versioning are Phase 2 — adding them now would block shipping theme/globals.
4. **Single-row singleton table** for config. One row, enforced with a CHECK constraint. Simpler than a key-value table and matches how it's used (always read together).

### Data model

One new table:

```sql
create table site_config (
  id            integer primary key default 1 check (id = 1),
  theme         jsonb not null,
  globals       jsonb not null,
  updated_at    timestamptz not null default now()
);
```

Drizzle definition added to `src/db/schema.ts`. Migration auto-runs on container startup (existing pattern).

**Theme JSONB shape** (Zod-validated on write):

```ts
{
  colors: {
    primary: string;      // hex, drives --color-rosa-* scale
    neutral: string;      // hex, drives --color-ink (and soft/muted/line shades)
    accent: string | null;
  };
  fonts: {
    body: string;         // Google Fonts family name, from curated list
    display: string;      // Google Fonts family name, from curated list
  };
  logo: {
    url: string | null;   // R2 URL; null = use identity.name as text logo
    alt: string;
  };
  radius: "none" | "soft" | "rounded" | "pill";  // single scalar
}
```

Color-shade derivation (50/100/200/300/400/500/600/700) is computed at render time from the base hex via an HSL-lightness mapping. The mapping is tuned once to reproduce the current `rosa` palette from `#F691B4` (so existing pages look identical after the migration), then applied uniformly to any base hex the admin picks. Deterministic — no stored shade values.

**Globals JSONB shape**:

```ts
{
  identity: {
    name: string;
    tagline: string;
    description: string;
    email: string;
    whatsapp: string;
    instagram: string;
    shippingProvider: string;
    preparationDays: string;
  };
  nav: Array<{ href: string; label: string }>;
  footer: {
    columns: Array<{
      heading: string;
      links: Array<{ href: string; label: string }>;
    }>;
    bottomText: string;      // e.g., copyright line
  };
  banner: {
    enabled: boolean;
    text: string;
    linkUrl: string | null;
    bgColor: "rosa" | "ink";
    dismissible: boolean;
  };
  payments: Array<{
    id: "mbway" | "transferencia" | "paypal";
    label: string;
    instructions: string;
  }>;
}
```

### Initial seed

A seed script (`src/db/seed-site-config.ts`, run on container startup if `site_config` is empty) writes a row 1 whose values mirror the current hardcoded state:

- Theme colors from `@theme` in `src/styles/global.css` (`#F691B4` primary, `#111111` neutral, no accent)
- Fonts: `Inter / Inter` (current)
- Logo: `null` (text)
- Radius: `"rounded"`
- Globals sourced from `src/lib/site.ts` (`site`, `navLinks`, `footerLinks`, `paymentMethods`)

Post-seed, `src/lib/site.ts` keeps only `categories`, `categoryLabel`, the `CategorySlug` type, and `formatEuro` (all tied to the `product_category` DB enum). Everything else becomes runtime config.

### Runtime propagation

`src/lib/config.ts` (new) exports:

```ts
export async function getSiteConfig(ctx?: PreviewContext): Promise<SiteConfig>;
export function renderThemeCSS(theme: SiteConfig["theme"]): string;
export function renderGoogleFontsHref(fonts: SiteConfig["fonts"]): string;
```

- `getSiteConfig()` reads the singleton row, cached in-process (5 min TTL, invalidated on save).
- `renderThemeCSS(theme)` returns a CSS string: `--color-rosa-50: ...; --color-rosa-100: ...; …` overriding the `@theme` defaults. Also writes `--radius-*` tokens.
- `renderGoogleFontsHref(fonts)` builds the CSS2 URL for the chosen font families.

`BaseLayout.astro` gets three changes:
1. Replaces hardcoded Google Fonts `<link>` with the dynamic one.
2. Adds `<style set:html={renderThemeCSS(config.theme)} />` in `<head>`.
3. Reads `<title>`, `<meta>`, favicon from `config.globals.identity`.

`Header.astro` and `Footer.astro` read from `config.globals` (nav, footer, banner).

**Font curation.** We don't accept any Google Font — admin picks from a curated list (~12 good pairings defined in `src/lib/fonts.ts`). This avoids loading heavy foreign scripts and keeps the UI predictable.

### Preview mechanism

In-memory preview map on the server (10-minute TTL):

```ts
Map<token: string, pendingConfig: SiteConfig>
```

Flow:
1. Admin edits form → debounced POST to `/api/admin/site-config/preview` with pending config → returns a token.
2. Iframe URL is `/?preview=<token>` (or any storefront route).
3. `src/middleware.ts` intercepts `?preview=<token>`: validates admin session, looks up pending config, attaches it to `Astro.locals.previewConfig`.
4. `getSiteConfig()` prefers `Astro.locals.previewConfig` when present.

For instant feedback without iframe reloads, the form ALSO sends pending config via `postMessage` directly to the iframe. The iframe listens and applies CSS var overrides client-side for color/font/radius changes. Structural changes (nav, footer) still require iframe reload on debounced write.

### Admin editor UX

Two new admin pages share the preview shell:

- `/admin/theme` — Theme Editor
- `/admin/globals` — Globals Editor

Each is an Astro page that mounts a React island (`ThemeEditor`, `GlobalsEditor`) inside a shared `<PreviewShell>` component.

**`PreviewShell` layout** (React island, `client:only`):

```
┌─────────────────────────────────────────────────────────┐
│ Desktop | Mobile            Reset   Saved 2m ago   Save │
├───────────────────────┬─────────────────────────────────┤
│                       │                                 │
│   Form pane           │   Iframe (/?preview=<token>)    │
│   (child component)   │                                 │
│                       │                                 │
│                       │                                 │
└───────────────────────┴─────────────────────────────────┘
```

- Left pane: form (children prop) — 40% width, sticky on scroll.
- Right pane: iframe — 60% width; mobile toggle narrows to 390px centered.
- Save/Reset in the toolbar. "Dirty" state disables "Save" when no changes.
- Banner on save failure (validation error or network).

**Theme Editor form sections:**

1. **Brand color** — color picker + hex input. Shows the auto-derived 50-700 scale as chips.
2. **Neutral color** — same UX, rarer to change.
3. **Accent color** — optional; toggle to enable.
4. **Typography** — two dropdowns (body / display) from the curated list with live font preview.
5. **Logo** — existing R2 upload widget (reuse from ProductForm), plus "use text instead" option.
6. **Roundness** — 4-way toggle (none / soft / rounded / pill) with small icon preview.

**Globals Editor form sections:**

1. **Identity** — labeled inputs for each field.
2. **Navigation** — drag-to-reorder list of `{href, label}` items. Add / remove.
3. **Footer** — drag-reorder columns, each with heading + link list. Bottom text field.
4. **Announcement banner** — toggle, text, link, bg color, dismissible.
5. **Payments** — existing three methods, each with editable label + instructions textarea. Drag to reorder.

Drag-reorder uses `@dnd-kit` (already dep-free; add to package.json).

### API surface

All admin-only, JWT-gated via existing middleware.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/site-config` | Returns current config row |
| PUT | `/api/admin/site-config` | Replaces config (Zod-validated); invalidates cache |
| POST | `/api/admin/site-config/preview` | Stores pending config under token; returns `{ token }` |
| DELETE | `/api/admin/site-config/preview/:token` | Cleans up token (called on editor unmount) |

Preview tokens auto-expire after 10 minutes.

### File changes

**New files:**

- `src/lib/config.ts` — types, Zod schemas, `getSiteConfig()`, CSS/fonts renderers, in-memory cache
- `src/lib/fonts.ts` — curated Google Font list
- `src/lib/theme-colors.ts` — HSL-based shade derivation
- `src/lib/preview-store.ts` — in-memory token → config map with TTL
- `src/pages/admin/theme.astro`
- `src/pages/admin/globals.astro`
- `src/components/admin/PreviewShell.tsx` — shared split-pane + iframe
- `src/components/admin/ThemeEditor.tsx`
- `src/components/admin/GlobalsEditor.tsx`
- `src/components/admin/ColorPicker.tsx`
- `src/components/admin/FontPicker.tsx`
- `src/components/admin/DragList.tsx` — generic drag-reorder wrapper for the globals sections
- `src/pages/api/admin/site-config.ts` — GET/PUT
- `src/pages/api/admin/site-config/preview.ts` — POST/DELETE with token
- `src/db/seed-site-config.ts`
- `drizzle/NNNN_add_site_config.sql` — migration

**Modified files:**

- `src/db/schema.ts` — add `siteConfig` table + type export
- `src/layouts/BaseLayout.astro` — dynamic fonts link, theme CSS inject, identity-driven meta
- `src/components/Header.astro` — read nav + identity from config; render banner if enabled
- `src/components/Footer.astro` — read footer + identity from config
- `src/middleware.ts` — preview-token handling, attach `previewConfig` to `Astro.locals`
- `src/lib/site.ts` — keep only `categories`, `categoryLabel`, `formatEuro`; delete the rest (now in DB)
- `src/env.d.ts` (if present) — `Astro.locals.previewConfig?: SiteConfig`
- `CLAUDE.md` — document `site_config`, admin theme/globals editors, Phase 2-4 roadmap
- `package.json` — add `@dnd-kit/core`, `@dnd-kit/sortable`

**Deletions:**
- Hardcoded `navLinks`, `footerLinks`, `site`, `paymentMethods` exports in `src/lib/site.ts` (moved to config).

### Validation & safety

- Zod schema guards every PUT — hex color format, Google Fonts list membership, URL shape for nav/footer hrefs (`/` or `https://`), payment method id enum, non-empty identity fields.
- DB CHECK constraint keeps `site_config` as a singleton.
- Seed is idempotent; re-running is a no-op if row exists.
- If `getSiteConfig()` fails (DB down at startup), we fall back to a frozen default config (bundled as a constant) so the storefront never hard-fails. Warning logged.
- Preview store is process-local (in-memory Map). Railway deploys this as a single Node process per service — fine. If the deploy topology ever moves to multi-worker, token lookups across workers will miss; mitigation at that point is a Redis-backed store or sticky sessions. Note this in a code comment on `preview-store.ts`.

### Manual acceptance checklist

1. Open `/admin/theme`, change primary color → iframe updates within ~300ms (postMessage path).
2. Save → open incognito on `/`; colors match.
3. Change body font → iframe updates on reload; public site reflects after save.
4. Upload logo → header shows new logo site-wide.
5. Open `/admin/globals`, reorder nav items → header reflects on save.
6. Add a footer column with 3 links → footer updates.
7. Enable banner with link → banner appears at top of every storefront page.
8. Edit payment instructions → checkout shows updated text.
9. Enter invalid hex → Save disabled, inline error.
10. Close editor without saving → public site unchanged.
11. Open two admin sessions, save in one → other session's "Save" disables (stale) and shows refresh prompt (nice-to-have; can defer).

---

## Phase 2–4 Roadmap (directional)

**Phase 2 — More blocks, drafts, scheduled publishing**
- 4–6 new block types (testimonials, pricing table, newsletter opt-in, image+text split, video embed, divider)
- Per-block style variants (keyed off theme tokens — "filled" / "outlined" / "subtle")
- `pages` gains a `draft_blocks` JSONB column and `scheduled_publish_at` timestamptz
- Admin sees "Draft / Published" state; can preview drafts via same preview token mechanism

**Phase 3 — Templates**
- New `templates` table: `{ id, kind: "catalog" | "product-detail", blocks: jsonb, active: bool }`
- Data-binding blocks: `product-info`, `product-gallery`, `product-personalizer`, `product-related`, `catalog-filters`, `catalog-grid`
- Catalog and product-detail routes switch to rendering the active template with bound data

**Phase 4 — Checkout slots**
- `src/pages/carrinho`, `/checkout`, `/obrigado` gain named `<Slot name="…" />` components
- Admin screen `/admin/slots` lists all slots; each can accept a small whitelisted block set (no data-binding, no payment-altering content)

---

## Open design questions (not blocking Phase 1)

- **Drafts model** — two columns on same row (`draft_blocks`, `published_blocks`) or a history table? Recommend columns for speed, history for audit.
- **Theme presets** — allow admin to save and switch between named themes? Defer unless requested.
- **Export / import** — JSON dump of theme + globals for reuse? Easy to add later.
