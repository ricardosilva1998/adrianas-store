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

**Routing**: File-based via Astro. Pages live in `src/pages/`, API routes in `src/pages/api/`. Admin routes (`/admin/*`, `/api/admin/*`) are JWT-protected via Astro middleware (`src/middleware.ts`).

**Database**: PostgreSQL with Drizzle ORM. Schema defined in `src/db/schema.ts` (8 tables, 4 enums). Connection in `src/db/client.ts`. Order creation uses transactions. Migrations auto-run on container startup.

**Auth**: JWT tokens in HTTP-only cookies (7-day TTL), bcrypt password hashing. Two roles: `admin` (full access) and `editor` (limited). Public routes: `/admin/login` and `/api/admin/login`.

**Client state**: Nanostores with persistent localStorage (`adriana-cart` key) for the shopping cart. No server-side cache layer.

**External services**:
- Cloudflare R2 for product image storage (`src/lib/r2.ts`)
- Resend for transactional emails (`src/lib/email.ts`)
- Railway.app for hosting + PostgreSQL

## Key Directories

- `src/components/islands/` — React islands (Cart, Checkout, PersonalizeModal)
- `src/components/admin/` — Admin dashboard React components
- `src/lib/` — Business logic: auth, queries, orders, email, R2 uploads, site config
- `src/db/` — Drizzle schema, client, migrations

## Conventions

- **Language**: UI text and content are in Portuguese (pt-PT)
- **Styling**: Tailwind CSS with custom `rosa` (pink) and `ink` (dark) color palettes. Utility classes: `.btn-primary`, `.btn-secondary`, `.card`, `.field-label`, `.field-input`, `.pill`
- **Validation**: Zod schemas on API endpoints (orders, products, checkout)
- **Order flow**: `new → paid → preparing → shipped → delivered` (or `cancelled`). All transitions logged in `order_events` audit trail
- **Products**: Support optional personalization (phrase + color choices), stored as JSONB in order items
- **Node version**: >= 22.12.0
