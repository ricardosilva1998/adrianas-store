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

### 2026-05-13 20:18 — team-deployment
**Task:** Deploy banner edge-to-edge change (remove mx-auto max-w-[843px] from Hero + IntroHero)
**Files:** src/components/blocks/HeroBlock.astro, src/components/islands/IntroHero.tsx
**Decisions:**
- Commit f6a2170 — "feat(hero): banner stretches edge-to-edge at 843/300 aspect ratio"
- Staged exactly the 2 in-scope files; payment.md left untracked as instructed
- Secrets scan clean; no .env or secret-pattern matches in staged diff
- Railway deployment 96811e4e-6110-4e6e-9b2d-773b7235cabc succeeded; service listening on port 3000; 60s log window clean (only expected migration NOTICEs)
**Open:** none

### 2026-05-13 21:08 — team-deployment
**Task:** Revert banner full-bleed + transparent fixed header (commits 7b22fa2 + 16f5c8e) via two new revert commits
**Files:** CLAUDE.md, src/components/Header.astro, src/components/blocks/HeroBlock.astro, src/components/islands/IntroHero.tsx, src/layouts/BaseLayout.astro, src/pages/[...slug].astro, src/pages/catalogo/index.astro, src/pages/catalogo/[slug].astro
**Decisions:**
- Reverted with `git revert --no-edit 16f5c8e 7b22fa2`; two new commits a09bfc4 + aa042ff — history intact, no reset or force-push used
- Banner is back to `max-w-[843px] mx-auto`; header back to `sticky bg-white/95 backdrop-blur`; `noHeaderOffset` prop and `heroFirst*` logic fully removed
- PageEditor auto-flush publish fix (d224cfd) was NOT reverted — still in place and confirmed in source
- Railway deployment 521555b2-b0b9-4354-8eab-5d194095e3a1 succeeded; 60s log window clean (only expected migration NOTICEs)
**Open:** none

### 2026-05-13 21:30 — team-deployment
**Task:** Deploy mandatory product personalization + customer file upload (PNG/JPG/PDF ≤ 15MB)
**Files:** src/lib/r2.ts, src/components/islands/stores/cart.ts, src/lib/orders.ts, src/db/schema.ts, src/pages/api/orders.ts, src/components/islands/PersonalizeModal.tsx, src/components/islands/ProductActions.tsx, src/components/islands/CartView.tsx, src/components/islands/CheckoutForm.tsx, src/pages/admin/orders/[id].astro, src/lib/email.ts, src/pages/api/personalization-upload.ts, src/components/islands/ProductActions.test.tsx
**Decisions:**
- Commit f35403a — "feat(personalization): personalização obrigatória + upload de imagem/PDF até 15MB"; pushed to origin/main @ f35403a (051401c..f35403a)
- payment.md left untracked as instructed; secrets scan clean; no .env or secret-pattern matches in staged diff
- No DB migration required — personalization JSONB column extended type-only (backwards compatible)
- Railway deployment c2b3d75f-62ed-487e-8cef-32b68f7c87c0 succeeded; service listening on port 3000; 60s log window clean (only expected migration NOTICEs — "already exists, skipping"); /api/personalization-upload is a new SSR route included in the deployed bundle
**Open:** none

### 2026-05-13 20:54 — team-deployment
**Task:** Deploy stronger customer-field validation in checkout + account profile (nome, telemóvel 9 dígitos PT, morada, código postal com verificação de existência via geoapi.pt)
**Files:** src/components/islands/AccountDashboard.tsx, src/components/islands/CheckoutForm.tsx, src/pages/api/account/update-profile.ts, src/pages/api/orders.ts, src/lib/customer-validation.ts, src/lib/customer-validation.test.ts, src/lib/postal-code.ts, src/lib/postal-code.test.ts, src/pages/api/validate-postal-code.ts
**Decisions:**
- Commit f510dbb — "feat(validation): validação reforçada de campos de cliente no checkout e perfil"; pushed to origin/main @ f510dbb (09561c2..f510dbb)
- payment.md left untracked as instructed; secrets scan clean on both file list and staged diff
- No DB migration required — pure logic change (new lib modules + API validation, no schema changes)
- Railway deployment e8a8185c-2167-456a-8d6c-29833b9584b6 succeeded; service listening on port 3000; 60s log window clean (only expected migration NOTICEs — "already exists, skipping"); /api/validate-postal-code is a new public SSR route included in the deployed bundle
**Open:** none

### 2026-05-13 21:45 — team-deployment
**Task:** Deploy per-product shipping methods, mandatory checkout selector, free shipping ≥€20, payment procedures in confirmation email (migration 0015)
**Files:** src/components/admin/ProductForm.tsx, src/components/islands/CheckoutForm.tsx, src/db/migrations/0015_shipping_methods.sql, src/db/migrations/meta/_journal.json, src/db/schema.ts, src/lib/email.ts, src/lib/orders.ts, src/lib/queries.ts, src/lib/shipping.ts, src/lib/shipping.test.ts, src/pages/admin/orders/[id].astro, src/pages/admin/products/[id].astro, src/pages/api/admin/products/[id].ts, src/pages/api/admin/products/index.ts, src/pages/api/orders.ts, src/pages/api/products/[slug]/shipping.ts
**Decisions:**
- Commit c8c7c43 — "feat(shipping): métodos de envio por produto + envio grátis ≥20€ + pagamento no e-mail"; pushed to origin/main @ c8c7c43 (08dc84a..c8c7c43)
- payment.md left untracked as instructed; secrets scan clean on both file list and staged diff content
- Migration 0015 confirmed applied: logs show `[migrate] A correr migrations...` then `[migrate] ✔ Migrations concluídas.` — all ADD COLUMN IF NOT EXISTS columns are live
- Railway deployment 2e19b0c2-6b3f-4f03-8b23-1c3a98196ac3 succeeded; service listening on port 3000; 60s log window clean (only expected migration NOTICEs — "already exists, skipping")
**Open:** Existing products will have shipping_methods = '[]' — checkout will block purchase until admin configures at least one shipping method per product via /admin/products/[id]. Admin must action this before storefront purchases can complete.

### 2026-05-13 22:05 — team-deployment
**Task:** Deploy focal-point drag (A), "Redes sociais" label (B), editable admin alert emails (C) + migration 0016
**Files:** src/components/ProductCard.astro, src/components/admin/BlockForm.tsx, src/components/admin/FocalPointEditor.tsx, src/components/admin/GlobalsEditor.tsx, src/components/admin/ProductForm.tsx, src/components/blocks/CatalogGridBoundBlock.astro, src/components/blocks/HeroBlock.astro, src/components/blocks/ImageCarouselBlock.astro, src/components/blocks/ImageGalleryBlock.astro, src/components/blocks/ImageTextSplitBlock.astro, src/components/blocks/ProductGalleryBlock.astro, src/components/blocks/ProductGridBlock.astro, src/components/blocks/ProductRelatedBlock.astro, src/components/islands/HeroCarousel.tsx, src/components/islands/ProductGallery.tsx, src/db/migrations/0016_product_image_focal.sql, src/db/migrations/meta/_journal.json, src/db/schema.ts, src/lib/blocks.ts, src/lib/config.ts, src/lib/email.ts, src/lib/focal-point.test.ts, src/lib/focal-point.ts, src/lib/queries.ts, src/pages/admin/index.astro, src/pages/admin/products/[id].astro, src/pages/api/admin/products/[id].ts, src/pages/api/admin/products/index.ts, src/pages/catalogo/[slug].astro, src/pages/catalogo/index.astro
**Decisions:**
- Commit b891e91 — "feat: focal-point drag, 'Redes sociais' label, editable admin alerts"; pushed to origin/main @ b891e91
- payment.md left untracked as instructed; secrets scan clean (no API_KEY/SECRET/TOKEN/PASSWORD patterns in staged diff)
- Migration 0016 confirmed applied: logs show `[migrate] ✔ Migrations concluídas.` — focalX/focalY (INT DEFAULT 50) on product_images are live
- Railway deployment c6eb438f-db74-4d02-9ddb-015e362ee66a succeeded; service listening on port 3000; 60s log window clean (only expected migration NOTICEs)
**Open:** Existing product images will have focalX=50/focalY=50 (centre) by default — no action needed unless admin wants to re-frame specific images. notifyEmails defaults to [] so ADMIN_NOTIFY_EMAIL env fallback remains active until admin populates the list in /admin/globals "Alertas admin" tab.

### 2026-05-13 22:50 — team-deployment
**Task:** UX tweaks — footer "Redes sociais" label + mobile horizontal scroll for category blocks (CategoryPills + CategoryGridBlock)
**Files:** src/components/Footer.astro, src/components/CategoryPills.astro, src/components/blocks/CategoryGridBlock.astro
**Decisions:**
- Commit b5d3e55 — "ux: footer 'Redes sociais' + mobile horizontal scroll for category blocks"; pushed to origin/main @ b5d3e55
- payment.md left untracked as instructed; secrets scan clean
- QA sign-off overridden by explicit user authorization (build passed, 131/131 tests passing per user's pre-deploy notes)
- Railway deployment e2a785a3-dad3-4ef7-af8e-c500f06838b1 succeeded; server listening on port 3000; 60s log window clean (only expected migration NOTICEs — "already exists, skipping", no new migrations this round)
**Open:** none

### 2026-05-14 00:01 — team-deployment
**Task:** Deploy hero mobile image variant (4:5, per-slide) + personalization modal auto-add to cart with red-border validation
**Files:** src/lib/blocks.ts, src/components/admin/BlockForm.tsx, src/styles/global.css, src/components/blocks/HeroBlock.astro, src/components/islands/HeroCarousel.tsx, src/components/islands/PersonalizeModal.tsx, src/components/islands/ProductActions.tsx
**Decisions:**
- Commit dc8a40e — "feat(hero+personalization): imagem mobile no hero (4:5) + modal auto-adiciona ao carrinho"; pushed to origin/main @ dc8a40e (b5d3e55..dc8a40e)
- payment.md left untracked as instructed; secrets scan clean (no API_KEY/SECRET/TOKEN/PASSWORD patterns in staged diff)
- QA sign-off overridden by explicit user authorization (npm test -- --run 131 passed / 1 pre-existing skipped; npm run build success — per user pre-deploy notes)
- No DB migration, no env-var changes required; Railway deployment b5a0751c-9ba1-4ea6-8ff1-ee1c3cbba722 succeeded; service listening on port 3000; 60s log window clean (only expected migration NOTICEs — "already exists, skipping")
**Open:** none

### 2026-05-14 00:20 — team-deployment
**Task:** Deploy SEO fixes — canonical/sitemap host fix (localhost:3000 → drisclub.com), Organization alternateName, Product brand JSON-LD, catalog meta description
**Files:** astro.config.mjs, src/layouts/BaseLayout.astro, src/pages/sitemap.xml.ts, src/pages/robots.txt.ts, src/pages/[...slug].astro, src/pages/catalogo/index.astro, src/pages/catalogo/[slug].astro
**Decisions:**
- Commit a5a9c44 — "fix(seo): canonical/sitemap host fix + Drisclub JSON-LD brand signals + catalog meta"; pushed to origin/main @ a5a9c44 (e2023f9..a5a9c44)
- payment.md left untracked as instructed; secrets scan clean (both pre-stage diff scan and post-stage staged-diff scan)
- QA sign-off overridden by explicit user authorization (npm test -- --run: 131 passed / 1 pre-existing skipped; npm run build: success — per user pre-deploy notes)
- Railway deployment 27e64063-c817-48fc-aab6-8231b47886aa succeeded; service listening on port 3000; 60s log window clean (only expected migration NOTICEs — "already exists, skipping"); no new migration
- Sitemap verified live: curl https://drisclub.com/sitemap.xml returns https://drisclub.com/... URLs (CRITICAL fix confirmed)
- Homepage canonical confirmed: <link rel="canonical" href="https://drisclub.com/"> and Organization JSON-LD includes alternateName:["Drisclub","Dris Club"] and url:"https://drisclub.com/"
- robots.txt still returned localhost:3000 for Sitemap line even with Cache-Control:no-cache header — this is a Railway edge/proxy cache serving the old response (robots.txt has max-age=3600); code is correct and identical pattern to sitemap.xml.ts; will self-resolve within 1 hour as cache expires
**Open:** robots.txt Sitemap line cache will clear within ~1 hour; no code change needed. No DB migration, no env-var changes required.

### 2026-05-14 00:41 — team-deployment
**Task:** Deploy fix: hero carousel switches to 4:5 mobile ratio when ANY slide has a mobile variant (was: ALL)
**Files:** src/components/blocks/HeroBlock.astro, CLAUDE.md
**Decisions:**
- Commit a9e1902 — "fix(hero): carrossel troca para 4:5 em mobile quando algum slide tem versão mobile"; pushed to origin/main @ a9e1902 (a5a9c44..a9e1902)
- payment.md left untracked as instructed; secrets scan clean (both working-tree and staged-diff scans)
- QA sign-off overridden by explicit user authorization (npm test -- --run: 131 passed / 1 pre-existing skipped; npm run build: success — per user pre-deploy notes)
- Railway deployment 40068b45-0c00-477b-a163-85d6dc313ca0 succeeded; service listening on port 3000 at 23:41:01; 60s log window clean (only expected migration NOTICEs — "already exists, skipping"); no new migration; no env-var changes
**Open:** none

### 2026-05-14 23:44 — team-deployment
**Task:** Deploy one-line email copy change — alternative contact in transactional email footer
**Files:** src/lib/email.ts
**Decisions:**
- Commit 8b63d5e — "feat(email): contacto alternativo drisclub.shop@gmail.com no rodapé dos e-mails"; pushed to origin/main @ 8b63d5e (8079d39..8b63d5e)
- payment.md left untracked as instructed; secrets scan clean (no API_KEY/SECRET/TOKEN/PASSWORD patterns in staged diff)
- Change is in baseLayout — propagates to all transactional emails: new/paid/preparing/shipped/delivered/cancelled status emails and [ADMIN] notification
- QA sign-off overridden by explicit user authorization ("deploy" reply; npm test -- --run: 131 passed / 1 pre-existing skipped; npm run build: success — per user pre-deploy notes)
- Railway deployment 73b15a01-64eb-4e97-a62a-b83ea9bd47a6 succeeded; service listening on port 3000 at 23:43:49; 60s log window clean (only expected migration NOTICEs — "already exists, skipping"); no new migration; no env-var changes
**Open:** none

### 2026-05-14 18:36 — team-deployment
**Task:** Deploy password show/hide toggle on customer AccountForm + commit product-colour data-fix scripts + push pre-existing spec commit
**Files:** src/components/admin/PasswordInput.tsx, src/components/admin/PasswordInput.test.tsx, src/components/islands/AccountForm.tsx, src/components/islands/AccountForm.test.tsx, scripts/inspect-variant-colors.ts, scripts/copy-estampa-colors.ts, scripts/swap-capa-colors.ts
**Decisions:**
- Commit 1f83265 — "docs(spec): design — esconder hero na versão mobile" (pre-existing local commit, now pushed)
- Commit 600f41d — "feat(conta): toggle mostrar/esconder palavra-passe no formulário de conta"; PasswordInput gains optional `minLength` prop; AccountForm swaps bare <input type="password"> for <PasswordInput>; 7 new tests (4 + 3)
- Commit 435164d — "chore(scripts): scripts de cores de produto (inspeção, cópia, troca)"; one-off DB tooling for read-only audit + data fixes already applied to production; committed for documentation per scripts/migrate-*.ts precedent
- Pushed origin/main @ 435164d (a133e49..435164d); payment.md left untracked; secrets scan clean on all staged diffs
- QA sign-off overridden by explicit user authorization (npm test -- --run: 138 passed / 1 skipped; npm run build: success)
- Railway deployment b1410f37-595d-4f2b-9a8b-14d3d80b5683 succeeded; service listening on port 3000; 60s log window clean (only expected migration NOTICEs — "already exists, skipping"); no new migration; no env-var changes
**Open:** none
