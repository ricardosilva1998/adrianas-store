# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Adriana's Store — a Portuguese e-commerce platform for handmade personalized products (tote bags, t-shirts, etc.) with an admin dashboard. Built with Astro SSR + React islands + PostgreSQL.

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
```

No test framework is configured.

## Architecture

**Astro SSR + React Islands**: Pages are Astro components with server-side rendering. Interactive UI (cart, checkout, personalization modal) uses React islands hydrated client-side via `client:load`/`client:only`. Non-interactive pages stay as Astro components.

**Routing**: File-based via Astro. API routes in `src/pages/api/`. Admin routes (`/admin/*`, `/api/admin/*`) are JWT-protected via Astro middleware (`src/middleware.ts`). Storefront CMS pages use a catch-all route `src/pages/[...slug].astro` that fetches pages from the database by slug (empty slug = "home"). Reserved routes (`catalogo`, `carrinho`, `checkout`, `obrigado`, `admin`, `api`) are excluded from the catch-all.

**Database**: PostgreSQL with Drizzle ORM. Schema defined in `src/db/schema.ts` (8 tables, 4 enums). Connection in `src/db/client.ts`. Order creation uses transactions. Migrations auto-run on container startup.

**Block-based CMS**: All pages (homepage, institutional, custom) use a block editor. Blocks are stored as a JSONB array on the `pages` table. 8 block types: hero, text, product-grid, category-grid, image-gallery, cta-banner, faq, contact-info. Block type definitions, Zod schemas, and factories in `src/lib/blocks.ts`. Admin block editor in `src/components/admin/BlockEditor.tsx`. Storefront block renderers in `src/components/blocks/`.

**Templates system**: Reusable block layouts for the catalog page and product-detail pages. Templates are stored in the `templates` table (kind: `catalog` | `product-detail`, blocks JSONB, active flag). Admin UI at `/admin/templates` (list) and `/admin/templates/[id]` (editor via `TemplateEditor.tsx`). When an active template exists for a route, `catalogo/index.astro` and `catalogo/[slug].astro` render via `BlockRenderer` with the appropriate context (`{ products, activeCategory }` or `{ product, relatedProducts }`); otherwise the hardcoded fallback layout is used. 5 data-binding block types (`product-gallery`, `product-info`, `product-long-description`, `product-related`, `catalog-grid-bound`) are only available in templates via `blocksAllowedIn(context)` in `src/lib/blocks.ts`.

**Site config (theme + globals)**: A singleton row in the `site_config` table stores the live `theme` (colors, fonts, logo, radius) and `globals` (nav, footer, banner, identity, payments). Storefront SSR reads it via `getSiteConfig()` in `src/lib/config.ts` (5-min in-process cache, invalidated on save). Tailwind v4's `@theme` CSS variables are overridden at runtime by a `<style>` block injected in `BaseLayout.astro`. Admin editors at `/admin/theme` and `/admin/globals` use a shared `PreviewShell` with an iframe + preview token (`?preview=<token>`) honoured by the middleware for logged-in admins. Phase 1 roadmap in `docs/superpowers/specs/2026-04-16-low-code-admin-builder-design.md`.

**Named slots**: `src/pages/carrinho.astro`, `src/pages/checkout.astro`, and `src/pages/obrigado.astro` embed `<Slot name="..." />` components that render blocks from the `slots` table. Admin fills each slot at `/admin/slots` with content blocks (no data-binding blocks — cart/checkout/thank-you have no product context). Five named slots are seeded on startup.

**Media library**: `media_library` table plus `/admin/media` gallery where admins paste image URLs, upload to R2, and copy URLs for use in blocks/products. 15 Lorem Picsum placeholder URLs are seeded on first run (`isPlaceholder=true`) so the site has visual content out of the gate. Admin can delete placeholders when replacing with real photos.

**Auth**: JWT tokens in HTTP-only cookies (7-day TTL), bcrypt password hashing. Two roles: `admin` (full access) and `editor` (limited). Public routes: `/admin/login` and `/api/admin/login`.

**Client state**: Nanostores with persistent localStorage (`adriana-cart` key) for the shopping cart. No server-side cache layer.

**External services**:
- Cloudflare R2 for product image storage (`src/lib/r2.ts`)
- Resend for transactional emails (`src/lib/email.ts`)
- Railway.app for hosting + PostgreSQL

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

## Conventions

- **Language**: UI text and content are in Portuguese (pt-PT)
- **Styling**: Tailwind CSS with custom `rosa` (pink) and `ink` (dark) color palettes. Utility classes: `.btn-primary`, `.btn-secondary`, `.card`, `.field-label`, `.field-input`, `.pill`
- **Validation**: Zod schemas on API endpoints (orders, products, checkout, page blocks)
- **Order flow**: `new → paid → preparing → shipped → delivered` (or `cancelled`). All transitions logged in `order_events` audit trail
- **Products**: Support optional personalization (phrase + color choices), stored as JSONB in order items
- **Site identity / theme**: edited in-admin via `/admin/theme` and `/admin/globals`. Do NOT add hardcoded nav/footer/identity strings — they belong in `site_config.globals`. `src/lib/site.ts` keeps only the category enum and `formatEuro`.
- **Node version**: >= 22.12.0
