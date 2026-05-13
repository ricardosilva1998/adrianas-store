# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Drisclub — a Portuguese e-commerce platform for handmade personalized products (tote bags, t-shirts, etc.) with an admin dashboard. Built with Astro SSR + React islands + PostgreSQL.

## Commands

```bash
npm run dev          # Start Astro dev server
npm run build        # Production build
npm run preview      # Preview production build
npm start            # Run production server (Node)

# Database (Drizzle ORM + PostgreSQL)
npm run db:generate  # Generate migrations from schema changes
npm run db:push      # Push schema directly to database
npm run db:migrate   # Run pending migrations
npm run db:seed      # Seed initial admin user
npm test             # Run Vitest suite once
npm run test:watch   # Vitest in watch mode
```

Tests: Vitest + React Testing Library. Unit tests live alongside their source (`src/lib/foo.ts` → `src/lib/foo.test.ts`; `src/components/admin/Foo.tsx` → `src/components/admin/Foo.test.tsx`). No database in tests — pure functions and component behaviour only.

## Architecture

**Astro SSR + React Islands**: Pages are Astro components with server-side rendering. Interactive UI (cart, checkout, personalization modal) uses React islands hydrated client-side via `client:load`/`client:only`. Non-interactive pages stay as Astro components.

**Routing**: File-based via Astro. API routes in `src/pages/api/`. Admin routes (`/admin/*`, `/api/admin/*`) are JWT-protected via Astro middleware (`src/middleware.ts`). Storefront CMS pages use a catch-all route `src/pages/[...slug].astro` that fetches pages from the database by slug (empty slug = "home"). Reserved routes (`catalogo`, `carrinho`, `checkout`, `obrigado`, `admin`, `api`) are excluded from the catch-all.

**Database**: PostgreSQL with Drizzle ORM. Schema defined in `src/db/schema.ts` (14 tables, 5 enums). Connection in `src/db/client.ts`. Order creation uses transactions. Migrations auto-run on container startup. Seed data (`npm run db:seed`) populates products, pages, admin user, `site_config`, slots, and media placeholders; idempotent — skips rows that already exist.

**Customer accounts**: Separate from admin `users`. `customers` table holds shopper accounts (email unique, name, password_hash, phone, address, postal_code, city, nif). Auth lives in `src/lib/customer-auth.ts` with cookie `__cust_session` (distinct from admin's `__adm_session`) and `kind: "customer"` JWT discriminator to prevent token confusion. Middleware populates `Astro.locals.customer` on every non-admin request. Pages: `/conta` (shows `<AccountForm>` for guests; `<AccountDashboard>` with profile editor + order history for logged-in customers). Order history is matched by `customer_email` (no FK) so orders made before account creation surface automatically once the email matches. APIs: `POST /api/account/{register,login,logout}`, `PATCH /api/account/update-profile`. Header shows a user-icon link to `/conta`, replaced with the customer's initial when logged in. Checkout pre-fills name/email/phone/address from the profile when authenticated. Guest checkout still works.

**Coupons**: `coupons` table holds reusable discount codes (`code` unique, `percentOff` XOR `amountOffCents`, `minOrderCents`, `active`, `validUntil`, `maxUses`, `usedCount`). Logic lives in `src/lib/coupons.ts` (`validateCoupon`, `findCouponByCode`, `incrementCouponUsage`). Admin CRUD at `/admin/coupons`. Public `POST /api/coupons/validate` lets the checkout preview the discount; `createOrder` re-validates server-side, persists `couponCode`/`discountCents` on the order, and increments `usedCount` in the same transaction. Codes are case-insensitive (compared via `upper()`), stored uppercase. The `coupon-popup` block renders a client-side modal that shows after a configurable delay and persists dismissal in `localStorage` (`drisclub-popup-dismissed-{code}`) for `dismissDays`.

**Block-based CMS**: All pages (homepage, institutional, custom) use a block editor. Blocks are stored as a JSONB array on the `pages` table. 21 block types grouped in three tiers:
- **Static content** (usable anywhere — pages, templates, slots): `hero`, `text`, `product-grid`, `category-grid`, `image-gallery`, `image-carousel`, `intro-hero`, `coupon-popup`, `cta-banner`, `faq`, `contact-info`, `testimonials`, `newsletter`, `image-text-split`, `video-embed`, `divider`, `stats`, `shipping-strip`, `feature-list`, `social-links`
- **Data-binding** (templates only; require bound context): `product-gallery`, `product-info`, `product-long-description`, `product-related`, `catalog-grid-bound`

Block type definitions, Zod schemas, factories, and the `blocksAllowedIn(context)` helper live in `src/lib/blocks.ts`. Admin page editor is `src/components/admin/BlockEditor.tsx`; template and slot editors (`TemplateEditor.tsx`, `SlotEditor.tsx`) reuse the block picker but keep simpler per-block forms. Storefront renderers are Astro components in `src/components/blocks/`, dispatched by `BlockRenderer.astro` which accepts an optional `context: { product, relatedProducts, products, activeCategory }` for data-binding blocks.

**Drafts + publish**: `pages.draftBlocks` (nullable jsonb) holds pending edits. Admin "Guardar rascunho" writes there; "Publicar" promotes draftBlocks → blocks and clears draftBlocks. A yellow "Rascunho" badge on `/admin/pages` flags pages with pending drafts. Admins preview unpublished content at `/<slug>?draft=1` (middleware loads the admin session for storefront GETs with `?draft=1` or `?preview=<token>`).

**Templates system**: Reusable block layouts for the catalog page and product-detail pages. Templates are stored in the `templates` table (kind: `catalog` | `product-detail`, blocks JSONB, active flag). Admin UI at `/admin/templates` (list) and `/admin/templates/[id]` (editor via `TemplateEditor.tsx`). When an active template exists for a route, `catalogo/index.astro` and `catalogo/[slug].astro` render via `BlockRenderer` with the appropriate context (`{ products, activeCategory }` or `{ product, relatedProducts }`); otherwise the hardcoded fallback layout is used. 5 data-binding block types (`product-gallery`, `product-info`, `product-long-description`, `product-related`, `catalog-grid-bound`) are only available in templates via `blocksAllowedIn(context)` in `src/lib/blocks.ts`.

**Site config (theme + globals)**: A singleton row in the `site_config` table stores the live `theme` (colors, fonts, logo, radius) and `globals` (nav, footer, banner, identity, payments). Storefront SSR reads it via `getSiteConfig()` in `src/lib/config.ts` (5-min in-process cache, invalidated on save). Tailwind v4's `@theme` CSS variables are overridden at runtime by a `<style>` block injected in `BaseLayout.astro`. Admin editors at `/admin/theme` and `/admin/globals` use a shared `PreviewShell` with an iframe + preview token (`?preview=<token>`) honoured by the middleware for logged-in admins. Phase 1 roadmap in `docs/superpowers/specs/2026-04-16-low-code-admin-builder-design.md`.

**Named slots**: `src/pages/carrinho.astro`, `src/pages/checkout.astro`, and `src/pages/obrigado.astro` embed `<Slot name="..." />` components that render blocks from the `slots` table. Admin fills each slot at `/admin/slots` with content blocks (no data-binding blocks — cart/checkout/thank-you have no product context). Five named slots are seeded on startup.

**Media library**: `media_library` table plus `/admin/media` gallery where admins paste image URLs, upload to R2, and copy URLs for use in blocks/products. 15 Lorem Picsum placeholder URLs are seeded on first run (`isPlaceholder=true`) so the site has visual content out of the gate. Admin can delete placeholders when replacing with real photos. The reusable `ImagePicker` component (`src/components/admin/ImagePicker.tsx`) is embedded in every block form that has an image field (Hero, ImageGallery, ImageTextSplit, ThemeEditor logo) — it opens a modal over `/api/admin/media` to pick from the gallery, accepts raw URLs, and can trigger an R2 upload that registers the result in the library.

**Auth**: JWT tokens in HTTP-only cookies (7-day TTL), bcrypt password hashing. Two roles: `admin` (full access) and `editor` (limited). Public routes: `/admin/login` and `/api/admin/login`.

**Client state**: Nanostores with persistent localStorage (`adriana-cart` key) for the shopping cart. No server-side cache layer.

**External services**:
- Cloudflare R2 for product image storage (`src/lib/r2.ts`)
- Resend for transactional emails (`src/lib/email.ts`). Verified sender domain on Resend is `drisclub.com` — `EMAIL_FROM` must use that domain (e.g. `Drisclub <noreply@drisclub.com>`); any other domain causes Resend to reject the send, and the failure is swallowed by the `try/catch` in `sendOrderEmail` so checkout still succeeds while no email goes out. Required env vars: `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_NOTIFY_EMAIL`.
- Railway.app for hosting + PostgreSQL. Env-var changes require a redeploy to take effect.

## Key Directories

- `src/components/islands/` — React islands (Cart, Checkout, PersonalizeModal)
- `src/components/admin/` — Admin dashboard React components (BlockEditor, ProductForm, ThemeEditor, GlobalsEditor, PreviewShell, DragList, ColorPicker, FontPicker, etc.)
- `src/components/blocks/` — Storefront block renderer Astro components (HeroBlock, TextBlock, etc.)
- `src/lib/config.ts` — site config types, Zod schemas, defaults, theme CSS renderer (pure; safe for client islands)
- `src/lib/config-server.ts` — `getSiteConfig()` + in-process cache (DB-touching; server-only)
- `src/lib/theme-colors.ts` — hex → 50/.../700 shade derivation
- `src/lib/fonts.ts` — curated Google Fonts list
- `src/lib/preview-store.ts` — in-memory preview token map
- `src/lib/` — Business logic: auth, queries, orders, email, R2 uploads, block types
- `src/db/` — Drizzle schema, client, migrations
- `docs/superpowers/specs/` — design specs (phase roadmap, data models)
- `docs/superpowers/plans/` — implementation plans (task-by-task breakdowns)

## Conventions

- **Language**: UI text and content are in Portuguese (pt-PT)
- **Styling**: Tailwind CSS with custom `rosa` (pink) and `ink` (dark) color palettes. Utility classes: `.btn-primary`, `.btn-secondary`, `.card`, `.field-label`, `.field-input`, `.pill`
- **Validation**: Zod schemas on API endpoints (orders, products, checkout, page blocks)
- **Order flow**: `new → paid → preparing → shipped → delivered` (or `cancelled`). All transitions logged in `order_events` audit trail
- **Products**: Support optional personalization (phrase + color choices), stored as JSONB in order items
- **Site identity / theme**: edited in-admin via `/admin/theme` and `/admin/globals`. Do NOT add hardcoded nav/footer/identity strings — they belong in `site_config.globals`. `src/lib/site.ts` keeps only the category enum and `formatEuro`.
- **No HTML in admin inputs**: the user is non-technical. Block form fields must never accept raw HTML. When a rendered element needs styled variants (e.g., an accent color within a heading), add a second field to the block schema rather than letting the admin type `<span class="…">`. Hero does this with `title` + `titleAccent`.
- **Image fields use `ImagePicker`**: any block or editor form that stores an image URL uses `src/components/admin/ImagePicker.tsx`, never a bare text input. That gives admins gallery picker + upload + URL paste in one control.
- **Node version**: >= 22.12.0


## Team Activity Log

This section is the shared coordination surface for the dev team (team-leader + frontend-dev + backend-dev + team-security + team-qa + team-ux + team-deployment). Every team member reads the last few entries before working and appends one entry after.

Format per entry:

```
### YYYY-MM-DD HH:MM — <role>
**Task:** <one line>
**Files:** <comma-separated paths or "none">
**Decisions:** <2-4 bullets the next teammate needs to know>
**Open:** <followups, or "none">
```

(No entries yet — the next `/dev-team` round will append here.)

### 2026-05-13 21:08 — team-deployment
**Task:** Revert banner full-bleed + transparent fixed header (commits 7b22fa2 + 16f5c8e) via two new revert commits
**Files:** CLAUDE.md, src/components/Header.astro, src/components/blocks/HeroBlock.astro, src/components/islands/IntroHero.tsx, src/layouts/BaseLayout.astro, src/pages/[...slug].astro, src/pages/catalogo/index.astro, src/pages/catalogo/[slug].astro
**Decisions:**
- Reverted with `git revert --no-edit 16f5c8e 7b22fa2`; two new commits a09bfc4 + aa042ff — history intact, no reset or force-push used
- Banner is back to `max-w-[843px] mx-auto`; header back to `sticky bg-white/95 backdrop-blur`; `noHeaderOffset` prop and `heroFirst*` logic fully removed
- PageEditor auto-flush publish fix (d224cfd) was NOT reverted — still in place and confirmed in source
- Railway deployment 521555b2-b0b9-4354-8eab-5d194095e3a1 succeeded; 60s log window clean (only expected migration NOTICEs)
**Open:** none
