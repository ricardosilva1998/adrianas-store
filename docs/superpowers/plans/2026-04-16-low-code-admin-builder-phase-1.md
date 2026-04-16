# Low-Code Admin Page Builder — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship admin-editable theme (colors, fonts, logo, radius) + globals (nav, footer, banner, identity, payments) with a shared live-preview shell, backed by a singleton `site_config` DB row.

**Architecture:** Layered models per spec — `site_config` table holds `theme` + `globals` JSONB. Storefront SSR reads it via a cached loader. Theme propagates via CSS custom properties injected in `<head>`. Admin editor uses a split-pane form + iframe preview; pending config is stored under a short-lived token so the iframe renders with unsaved changes.

**Tech Stack:** Astro 6 SSR + React 19 islands + PostgreSQL via Drizzle ORM + Tailwind CSS v4 (`@theme` vars) + Zod + `@dnd-kit` (new) + `nanoid` (existing).

**Spec:** `docs/superpowers/specs/2026-04-16-low-code-admin-builder-design.md`

**Testing note:** The project has no test framework (per `CLAUDE.md`). Each task ends with a manual verification step (browser check, curl, or `npm run check` for TypeScript). Keep all commits small so broken states are easy to isolate.

---

## File Structure

### Created
| Path | Responsibility |
|---|---|
| `src/lib/theme-colors.ts` | Derive 50→700 shade scale from a single hex. Pure functions, no deps. |
| `src/lib/fonts.ts` | Curated Google Fonts list + metadata (family, category, weights). |
| `src/lib/config.ts` | Types, Zod schemas, `getSiteConfig()`, cache, `renderThemeCSS()`, `renderGoogleFontsHref()`. |
| `src/lib/preview-store.ts` | In-memory map: `token → pendingConfig`, TTL 10 min. |
| `src/db/migrations/XXXX_add_site_config.sql` | Drizzle-generated migration. |
| `src/pages/api/admin/site-config.ts` | `GET` (current config) and `PUT` (Zod-validated replace). |
| `src/pages/api/admin/site-config/preview.ts` | `POST` (store pending → token), `DELETE` (clear token). |
| `src/components/admin/PreviewShell.tsx` | Shared split-pane layout: form slot + iframe, desktop/mobile toggle, save/reset toolbar. |
| `src/components/admin/DragList.tsx` | Generic `@dnd-kit`-powered sortable list (renders children, returns onReorder). |
| `src/components/admin/ColorPicker.tsx` | Hex input + native `<input type="color">` + derived scale preview chips. |
| `src/components/admin/FontPicker.tsx` | Dropdown with live preview of each font option. |
| `src/components/admin/ThemeEditor.tsx` | Form island bound to `theme` JSONB; uses `ColorPicker` + `FontPicker`. |
| `src/components/admin/GlobalsEditor.tsx` | Form island bound to `globals` JSONB; tabbed sections. |
| `src/pages/admin/theme.astro` | Admin route; mounts `ThemeEditor` inside `PreviewShell`. |
| `src/pages/admin/globals.astro` | Admin route; mounts `GlobalsEditor` inside `PreviewShell`. |

### Modified
| Path | Change |
|---|---|
| `src/db/schema.ts` | Add `siteConfig` table definition and `SiteConfigRow` type. |
| `src/env.d.ts` | Add `previewConfig?: SiteConfig` to `App.Locals`. |
| `src/middleware.ts` | Honour `?preview=<token>` on storefront routes: look up pending config for logged-in admins, attach to `Astro.locals.previewConfig`. |
| `src/layouts/BaseLayout.astro` | Dynamic Google Fonts `<link>`, `<style>` theme-CSS inject, meta from config, inline postMessage listener for live color/font updates when `?preview` is set. |
| `src/components/Header.astro` | Read nav + identity + banner from config. |
| `src/components/Footer.astro` | Read footer columns + identity + categories from config (categories stay local). |
| `src/layouts/AdminLayout.astro` | Add nav links to `/admin/theme` and `/admin/globals`. |
| `src/lib/site.ts` | Trim to `categories`, `categoryLabel`, `CategorySlug`, `formatEuro`. Delete `site`, `navLinks`, `footerLinks`, `paymentMethods`, `PaymentMethodId`. |
| `scripts/seed.ts` | Add `seedSiteConfig()` that writes the singleton from current hardcoded values. |
| `package.json` | Add `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`. |
| `CLAUDE.md` | Document `site_config` + editors. |

Any other file that `import`s from `src/lib/site.ts` must be updated when those exports move. Task 6 handles the sweep.

---

## Task 1 — Dependencies + foundational pure libraries

**Files:**
- Modify: `package.json`
- Create: `src/lib/theme-colors.ts`
- Create: `src/lib/fonts.ts`

- [ ] **Step 1: Install dnd-kit packages**

Run:
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Expected: `package.json` and `package-lock.json` updated.

- [ ] **Step 2: Create `src/lib/theme-colors.ts`**

```ts
// HSL-based shade derivation.
// Given a single base hex, produce a full 50→700 scale.
// The lightness/saturation curve is tuned so the default primary (#F691B4)
// yields shades close to the current rosa-* palette.

const SHADE_LIGHTNESS: Record<string, number> = {
  "50": 0.97,
  "100": 0.92,
  "200": 0.85,
  "300": 0.75,
  "400": 0.65,
  "500": 0.55,
  "600": 0.42,
  "700": 0.32,
};

const SHADE_SATURATION_SCALE: Record<string, number> = {
  "50": 0.85,
  "100": 0.9,
  "200": 0.95,
  "300": 1.0,
  "400": 1.0,
  "500": 1.0,
  "600": 0.95,
  "700": 0.9,
};

export const SHADE_KEYS = ["50", "100", "200", "300", "400", "500", "600", "700"] as const;
export type Shade = (typeof SHADE_KEYS)[number];

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: h * 360, s, l };
}

export function hslToHex(h: number, s: number, l: number): string {
  const hue = h / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const toRgb = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  const r = Math.round(toRgb(hue + 1 / 3) * 255);
  const g = Math.round(toRgb(hue) * 255);
  const b = Math.round(toRgb(hue - 1 / 3) * 255);
  return (
    "#" +
    [r, g, b]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
  );
}

export function deriveScale(baseHex: string): Record<Shade, string> {
  const { h, s } = hexToHsl(baseHex);
  const out = {} as Record<Shade, string>;
  for (const key of SHADE_KEYS) {
    const targetL = SHADE_LIGHTNESS[key];
    const targetS = Math.min(1, s * SHADE_SATURATION_SCALE[key]);
    out[key] = hslToHex(h, targetS, targetL);
  }
  return out;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
export function isValidHex(value: string): boolean {
  return HEX_RE.test(value);
}
```

- [ ] **Step 3: Create `src/lib/fonts.ts`**

```ts
export type FontFamily = {
  name: string;          // Google Fonts family name, exact
  fallback: string;      // CSS fallback stack suffix
  category: "sans" | "serif" | "display" | "handwriting";
  weights: number[];     // weights we request via the CSS2 link
};

export const FONT_FAMILIES: FontFamily[] = [
  { name: "Inter", fallback: "system-ui, sans-serif", category: "sans", weights: [400, 500, 600, 700] },
  { name: "Manrope", fallback: "system-ui, sans-serif", category: "sans", weights: [400, 500, 600, 700] },
  { name: "DM Sans", fallback: "system-ui, sans-serif", category: "sans", weights: [400, 500, 700] },
  { name: "Work Sans", fallback: "system-ui, sans-serif", category: "sans", weights: [400, 500, 600, 700] },
  { name: "Nunito", fallback: "system-ui, sans-serif", category: "sans", weights: [400, 600, 700] },
  { name: "Playfair Display", fallback: "Georgia, serif", category: "serif", weights: [400, 600, 700] },
  { name: "Cormorant Garamond", fallback: "Georgia, serif", category: "serif", weights: [400, 500, 700] },
  { name: "Lora", fallback: "Georgia, serif", category: "serif", weights: [400, 500, 700] },
  { name: "Fraunces", fallback: "Georgia, serif", category: "serif", weights: [400, 500, 700] },
  { name: "Space Grotesk", fallback: "system-ui, sans-serif", category: "display", weights: [400, 500, 700] },
  { name: "Archivo", fallback: "system-ui, sans-serif", category: "display", weights: [400, 500, 700] },
  { name: "Caveat", fallback: "cursive", category: "handwriting", weights: [400, 600, 700] },
];

export const FONT_NAMES: string[] = FONT_FAMILIES.map((f) => f.name);

export function getFont(name: string): FontFamily | undefined {
  return FONT_FAMILIES.find((f) => f.name === name);
}

export function isValidFontName(name: string): boolean {
  return FONT_NAMES.includes(name);
}
```

- [ ] **Step 4: Typecheck**

Run:
```bash
npm run check
```

Expected: no new errors introduced (existing errors unrelated to these files are acceptable).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/theme-colors.ts src/lib/fonts.ts
git commit -m "feat: add theme-colors and fonts libraries, install dnd-kit"
```

---

## Task 2 — DB schema + migration for `site_config`

**Files:**
- Modify: `src/db/schema.ts`
- Create: `src/db/migrations/XXXX_add_site_config.sql` (generated)

- [ ] **Step 1: Add `siteConfig` table to `src/db/schema.ts`**

Append just before the `relations(...)` calls (around the existing `pages` table block):

```ts
export const siteConfig = pgTable(
  "site_config",
  {
    id: integer("id").primaryKey().default(1),
    theme: jsonb("theme").notNull(),
    globals: jsonb("globals").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Singleton: only id=1 is allowed.
    // Drizzle doesn't model CHECK constraints directly — we add it in the generated SQL.
  ],
);

export type SiteConfigRow = typeof siteConfig.$inferSelect;
```

Also update the trailing `export type` block so it exports `SiteConfigRow` alongside the other row types.

- [ ] **Step 2: Generate migration**

Run:
```bash
npm run db:generate
```

Expected: new file `src/db/migrations/XXXX_*.sql` appears with `CREATE TABLE site_config (...)`.

- [ ] **Step 3: Hand-edit the generated SQL to add the singleton CHECK**

Open the new migration file. After the `CREATE TABLE site_config` statement, add:

```sql
ALTER TABLE "site_config" ADD CONSTRAINT "site_config_singleton_ck" CHECK (id = 1);
```

(If Drizzle generated a line for the default value of `id`, leave it. The CHECK is the safety net.)

- [ ] **Step 4: Apply migration**

Run:
```bash
npm run db:push
```

Expected: migration applies cleanly; `\dt site_config` in psql shows the new table.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts src/db/migrations/
git commit -m "feat: add site_config singleton table"
```

---

## Task 3 — Config types, Zod schemas, loader, cache, renderers

**Files:**
- Create: `src/lib/config.ts`

- [ ] **Step 1: Create `src/lib/config.ts`**

```ts
import { z } from "zod";
import { db, schema } from "../db/client";
import { eq } from "drizzle-orm";
import { FONT_NAMES } from "./fonts";
import { deriveScale, isValidHex, SHADE_KEYS } from "./theme-colors";

// ---------- Zod schemas ----------

const hexSchema = z.string().refine(isValidHex, "Hex inválido (ex: #F691B4)");

export const themeSchema = z.object({
  colors: z.object({
    primary: hexSchema,
    neutral: hexSchema,
    accent: hexSchema.nullable(),
  }),
  fonts: z.object({
    body: z.string().refine((n) => FONT_NAMES.includes(n), "Fonte não suportada"),
    display: z.string().refine((n) => FONT_NAMES.includes(n), "Fonte não suportada"),
  }),
  logo: z.object({
    url: z.string().url().nullable(),
    alt: z.string().min(1).max(200),
  }),
  radius: z.enum(["none", "soft", "rounded", "pill"]),
});

const linkSchema = z.object({
  href: z.string().refine(
    (s) => s.startsWith("/") || s.startsWith("http://") || s.startsWith("https://") || s.startsWith("mailto:"),
    "URL deve começar por /, http(s):// ou mailto:",
  ),
  label: z.string().min(1).max(100),
});

export const globalsSchema = z.object({
  identity: z.object({
    name: z.string().min(1).max(100),
    tagline: z.string().min(1).max(200),
    description: z.string().min(1).max(500),
    email: z.string().email(),
    whatsapp: z.string().min(1).max(30),
    instagram: z.string().min(1).max(100),
    shippingProvider: z.string().min(1).max(50),
    preparationDays: z.string().min(1).max(50),
  }),
  nav: z.array(linkSchema).min(1).max(10),
  footer: z.object({
    columns: z.array(
      z.object({
        heading: z.string().min(1).max(50),
        links: z.array(linkSchema).min(1).max(10),
      }),
    ).max(5),
    bottomText: z.string().min(1).max(200),
  }),
  banner: z.object({
    enabled: z.boolean(),
    text: z.string().max(200),
    linkUrl: z.string().nullable(),
    bgColor: z.enum(["rosa", "ink"]),
    dismissible: z.boolean(),
  }),
  payments: z.array(
    z.object({
      id: z.enum(["mbway", "transferencia", "paypal"]),
      label: z.string().min(1).max(50),
      instructions: z.string().min(1).max(500),
    }),
  ).min(1).max(3),
});

export const siteConfigSchema = z.object({
  theme: themeSchema,
  globals: globalsSchema,
});

export type Theme = z.infer<typeof themeSchema>;
export type Globals = z.infer<typeof globalsSchema>;
export type SiteConfig = z.infer<typeof siteConfigSchema>;

// ---------- Default (used as fallback + seed source) ----------

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  theme: {
    colors: { primary: "#F691B4", neutral: "#111111", accent: null },
    fonts: { body: "Inter", display: "Inter" },
    logo: { url: null, alt: "Adriana's Store" },
    radius: "rounded",
  },
  globals: {
    identity: {
      name: "Adriana's Store",
      tagline: "Peças personalizadas com carinho",
      description:
        "Loja portuguesa de t-shirts, tote bags, bolsas necessaire e muito mais. Cada peça é personalizada à mão, com a tua frase ou ideia.",
      email: "ola@adrianastore.pt",
      whatsapp: "+351 912 345 678",
      instagram: "@adrianas.store",
      shippingProvider: "CTT",
      preparationDays: "3 a 5 dias úteis",
    },
    nav: [
      { href: "/", label: "Início" },
      { href: "/catalogo", label: "Catálogo" },
      { href: "/sobre-nos", label: "Sobre Nós" },
      { href: "/como-encomendar", label: "Como Encomendar" },
    ],
    footer: {
      columns: [
        {
          heading: "Navegação",
          links: [
            { href: "/catalogo", label: "Catálogo" },
            { href: "/sobre-nos", label: "Sobre Nós" },
            { href: "/como-encomendar", label: "Como Encomendar" },
            { href: "/termos-condicoes", label: "Termos & Condições" },
          ],
        },
      ],
      bottomText: "Todos os direitos reservados.",
    },
    banner: {
      enabled: false,
      text: "",
      linkUrl: null,
      bgColor: "rosa",
      dismissible: true,
    },
    payments: [
      {
        id: "mbway",
        label: "MB Way",
        instructions:
          "Envia o pagamento para o número 912 345 678 indicando o teu nome e número de encomenda.",
      },
      {
        id: "transferencia",
        label: "Transferência Bancária",
        instructions:
          "IBAN: PT50 0000 0000 0000 0000 0000 0\nTitular: Adriana's Store\nEnvia o comprovativo por email indicando o teu nome e número de encomenda.",
      },
      {
        id: "paypal",
        label: "PayPal",
        instructions:
          "Envia o pagamento para ola@adrianastore.pt (opção 'Family & Friends') indicando o teu nome e número de encomenda.",
      },
    ],
  },
};

// ---------- In-process cache ----------

type CacheEntry = { value: SiteConfig; at: number };
const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: CacheEntry | null = null;

export function invalidateSiteConfigCache(): void {
  cache = null;
}

async function readFromDb(): Promise<SiteConfig> {
  const rows = await db
    .select()
    .from(schema.siteConfig)
    .where(eq(schema.siteConfig.id, 1))
    .limit(1);

  if (rows.length === 0) {
    console.warn("[site-config] no row found, returning DEFAULT_SITE_CONFIG");
    return DEFAULT_SITE_CONFIG;
  }

  const parsed = siteConfigSchema.safeParse({
    theme: rows[0].theme,
    globals: rows[0].globals,
  });
  if (!parsed.success) {
    console.error("[site-config] DB row failed schema validation:", parsed.error);
    return DEFAULT_SITE_CONFIG;
  }
  return parsed.data;
}

/**
 * Loads the site config. If `previewConfig` is supplied (from middleware
 * when `?preview=<token>` is present + admin is authenticated), returns
 * the preview config directly and bypasses the cache.
 */
export async function getSiteConfig(previewConfig?: SiteConfig): Promise<SiteConfig> {
  if (previewConfig) return previewConfig;

  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) {
    return cache.value;
  }

  try {
    const value = await readFromDb();
    cache = { value, at: now };
    return value;
  } catch (err) {
    console.error("[site-config] DB read failed, falling back to default:", err);
    return DEFAULT_SITE_CONFIG;
  }
}

// ---------- CSS + fonts renderers ----------

/**
 * Generates a CSS string that overrides the Tailwind @theme variables
 * for rosa-* and ink-* shades based on the theme colors.
 * Also sets radius tokens.
 */
export function renderThemeCSS(theme: Theme): string {
  const rosa = deriveScale(theme.colors.primary);
  const neutral = deriveNeutralShades(theme.colors.neutral);
  const radiusValue = RADIUS_MAP[theme.radius];

  const lines: string[] = [":root {"];
  for (const k of SHADE_KEYS) {
    lines.push(`  --color-rosa-${k}: ${rosa[k]};`);
  }
  lines.push(`  --color-ink: ${neutral.base};`);
  lines.push(`  --color-ink-soft: ${neutral.soft};`);
  lines.push(`  --color-ink-muted: ${neutral.muted};`);
  lines.push(`  --color-ink-line: ${neutral.line};`);
  lines.push(`  --font-sans: "${theme.fonts.body}", ui-sans-serif, system-ui, sans-serif;`);
  lines.push(`  --font-display: "${theme.fonts.display}", ui-sans-serif, system-ui, sans-serif;`);
  lines.push(`  --radius-site: ${radiusValue};`);
  lines.push("}");
  return lines.join("\n");
}

const RADIUS_MAP = {
  none: "0px",
  soft: "6px",
  rounded: "16px",
  pill: "9999px",
} as const;

function deriveNeutralShades(baseHex: string): {
  base: string; soft: string; muted: string; line: string;
} {
  // For neutrals we keep hue/saturation but shift lightness away from the base.
  const scale = deriveScale(baseHex);
  return {
    base: baseHex,
    soft: scale["600"],
    muted: scale["400"],
    line: scale["100"],
  };
}

export function renderGoogleFontsHref(fonts: Theme["fonts"]): string {
  const needed = new Set([fonts.body, fonts.display]);
  const params: string[] = [];
  for (const name of needed) {
    const encoded = name.replace(/ /g, "+");
    // We request 400, 500, 600, 700 for every font; Google dedupes at delivery.
    params.push(`family=${encoded}:wght@400;500;600;700`);
  }
  return `https://fonts.googleapis.com/css2?${params.join("&")}&display=swap`;
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npm run check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/config.ts
git commit -m "feat: add site config loader, Zod schemas, theme CSS renderer"
```

---

## Task 4 — Seed script wiring

**Files:**
- Modify: `scripts/seed.ts`

- [ ] **Step 1: Add `seedSiteConfig()` to `scripts/seed.ts`**

Add these imports at top (adjacent to existing imports):

```ts
import { DEFAULT_SITE_CONFIG } from "../src/lib/config";
```

Add this function definition after `seedAdminUser()`:

```ts
const seedSiteConfig = async () => {
  console.log("⚙️  A semear site_config...");
  const existing = await db.select().from(schema.siteConfig).limit(1);
  if (existing.length > 0) {
    console.log("  · site_config já existe, skip");
    return;
  }
  await db.insert(schema.siteConfig).values({
    id: 1,
    theme: DEFAULT_SITE_CONFIG.theme,
    globals: DEFAULT_SITE_CONFIG.globals,
  });
  console.log("  ✔ site_config inicial escrito");
};
```

Modify the `main()` function to call it:

```ts
const main = async () => {
  try {
    await seedProducts();
    await seedPages();
    await seedAdminUser();
    await seedSiteConfig();
    console.log("✅ Seed concluído.");
  } finally {
    await client.end();
  }
};
```

- [ ] **Step 2: Run seed**

Run:
```bash
npm run db:seed
```

Expected: output includes `⚙️  A semear site_config...` followed by `✔ site_config inicial escrito` (or `já existe, skip` on reruns).

- [ ] **Step 3: Verify row in DB**

Run:
```bash
psql "$DATABASE_URL" -c "SELECT id, jsonb_pretty(theme)->0, jsonb_pretty(globals)->0, updated_at FROM site_config;"
```

Expected: one row with id=1 and non-null theme + globals.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed.ts
git commit -m "feat: seed initial site_config row from defaults"
```

---

## Task 5 — Preview store + middleware wiring

**Files:**
- Create: `src/lib/preview-store.ts`
- Modify: `src/env.d.ts`
- Modify: `src/middleware.ts`

- [ ] **Step 1: Create `src/lib/preview-store.ts`**

```ts
// Process-local map of preview tokens → pending SiteConfig.
// TTL: 10 minutes. On Railway (single Node worker per service), this works fine.
// Multi-worker deploys would need Redis or sticky sessions — re-evaluate then.

import { nanoid } from "nanoid";
import type { SiteConfig } from "./config";

type Entry = { value: SiteConfig; expiresAt: number };
const TTL_MS = 10 * 60 * 1000;
const store = new Map<string, Entry>();

function gc() {
  const now = Date.now();
  for (const [token, entry] of store) {
    if (entry.expiresAt <= now) store.delete(token);
  }
}

export function putPreview(value: SiteConfig): string {
  gc();
  const token = nanoid(16);
  store.set(token, { value, expiresAt: Date.now() + TTL_MS });
  return token;
}

export function upsertPreview(token: string, value: SiteConfig): void {
  gc();
  store.set(token, { value, expiresAt: Date.now() + TTL_MS });
}

export function getPreview(token: string): SiteConfig | null {
  gc();
  return store.get(token)?.value ?? null;
}

export function clearPreview(token: string): void {
  store.delete(token);
}
```

- [ ] **Step 2: Extend `App.Locals` in `src/env.d.ts`**

Replace the file contents with:

```ts
/// <reference path="../.astro/types.d.ts" />

import type { SessionUser } from "./lib/auth";
import type { SiteConfig } from "./lib/config";

declare global {
  namespace App {
    interface Locals {
      user?: SessionUser;
      previewConfig?: SiteConfig;
    }
  }
}

export {};
```

- [ ] **Step 3: Update `src/middleware.ts`**

Replace the file contents with:

```ts
import { defineMiddleware } from "astro:middleware";
import { getSessionUser } from "./lib/auth";
import { getPreview } from "./lib/preview-store";

const PUBLIC_ADMIN_ROUTES = new Set(["/admin/login", "/api/admin/login"]);

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;

  // Admin auth gate (unchanged).
  if (path.startsWith("/admin") || path.startsWith("/api/admin")) {
    if (PUBLIC_ADMIN_ROUTES.has(path)) {
      return next();
    }
    const user = await getSessionUser(context.cookies);
    if (!user) {
      if (path.startsWith("/api/")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      return context.redirect("/admin/login");
    }
    context.locals.user = user;
    return next();
  }

  // Storefront preview: only effective for authenticated admins.
  const previewToken = context.url.searchParams.get("preview");
  if (previewToken) {
    const user = await getSessionUser(context.cookies);
    if (user) {
      const pending = getPreview(previewToken);
      if (pending) {
        context.locals.previewConfig = pending;
      }
    }
  }

  return next();
});
```

- [ ] **Step 4: Typecheck**

Run:
```bash
npm run check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/preview-store.ts src/env.d.ts src/middleware.ts
git commit -m "feat: add preview store and wire preview token into middleware"
```

---

## Task 6 — Switch storefront layout + Header + Footer to read from config; trim site.ts

**Files:**
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/components/Header.astro`
- Modify: `src/components/Footer.astro`
- Modify: `src/lib/site.ts`

- [ ] **Step 1: Update `src/layouts/BaseLayout.astro`**

Replace file contents with:

```astro
---
import "../styles/global.css";
import Header from "../components/Header.astro";
import Footer from "../components/Footer.astro";
import { getSiteConfig, renderThemeCSS, renderGoogleFontsHref } from "../lib/config";

interface Props {
  title?: string;
  description?: string;
}

const config = await getSiteConfig(Astro.locals.previewConfig);
const { identity } = config.globals;

const { title, description = identity.description } = Astro.props;
const pageTitle = title ? `${title} — ${identity.name}` : `${identity.name} — ${identity.tagline}`;

const themeCSS = renderThemeCSS(config.theme);
const fontsHref = renderGoogleFontsHref(config.theme.fonts);
const isPreview = Astro.url.searchParams.has("preview");
---

<!doctype html>
<html lang="pt-PT">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="generator" content={Astro.generator} />
    <meta name="description" content={description} />
    <meta name="theme-color" content={config.theme.colors.primary} />
    <meta property="og:title" content={pageTitle} />
    <meta property="og:description" content={description} />
    <meta property="og:type" content="website" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href={fontsHref} rel="stylesheet" />
    <style set:html={themeCSS}></style>
    <title>{pageTitle}</title>
  </head>
  <body class="flex min-h-dvh flex-col bg-white text-ink antialiased">
    <Header config={config} />
    <main class="flex-1">
      <slot />
    </main>
    <Footer config={config} />

    {isPreview && (
      <script is:inline>
        // Live preview listener: parent admin editor can postMessage CSS/font
        // updates so color changes feel instant without iframe reload.
        window.addEventListener("message", (ev) => {
          if (!ev.data || ev.data.kind !== "preview-theme-css") return;
          const style = document.getElementById("preview-theme-css") ||
            (() => {
              const s = document.createElement("style");
              s.id = "preview-theme-css";
              document.head.appendChild(s);
              return s;
            })();
          style.textContent = ev.data.css;

          if (ev.data.fontsHref) {
            const link = document.getElementById("preview-fonts-link");
            if (link) {
              link.setAttribute("href", ev.data.fontsHref);
            } else {
              const l = document.createElement("link");
              l.id = "preview-fonts-link";
              l.rel = "stylesheet";
              l.href = ev.data.fontsHref;
              document.head.appendChild(l);
            }
          }
        });
      </script>
    )}
  </body>
</html>
```

- [ ] **Step 2: Update `src/components/Header.astro`**

Replace file contents with:

```astro
---
import CartIcon from "./islands/CartIcon.tsx";
import type { SiteConfig } from "../lib/config";

interface Props {
  config: SiteConfig;
}

const { config } = Astro.props;
const { identity, nav, banner } = config.globals;
const { logo } = config.theme;

const currentPath = Astro.url.pathname;
const isActive = (href: string) =>
  href === "/" ? currentPath === "/" : currentPath.startsWith(href);

const bannerBg = banner.bgColor === "rosa" ? "bg-rosa-400 text-white" : "bg-ink text-white";
---

{banner.enabled && banner.text && (
  <div class={`${bannerBg} text-center text-xs font-medium px-4 py-2`}>
    {banner.linkUrl ? (
      <a href={banner.linkUrl} class="underline underline-offset-2">{banner.text}</a>
    ) : (
      <span>{banner.text}</span>
    )}
  </div>
)}

<header class="sticky top-0 z-40 border-b border-ink-line bg-white/95 backdrop-blur">
  <div class="section flex h-20 items-center justify-between gap-6">
    <a href="/" class="flex items-center gap-3" aria-label={identity.name}>
      {logo.url ? (
        <img src={logo.url} alt={logo.alt} class="h-10 w-auto" />
      ) : (
        <span class="text-xl font-semibold tracking-tight text-ink">{identity.name}</span>
      )}
    </a>

    <nav class="hidden items-center gap-1 md:flex" aria-label="Navegação principal">
      {nav.map((link) => (
        <a
          href={link.href}
          class={`rounded-full px-4 py-2 text-sm font-medium transition ${
            isActive(link.href)
              ? "bg-rosa-50 text-rosa-500"
              : "text-ink hover:bg-rosa-50 hover:text-rosa-500"
          }`}
        >
          {link.label}
        </a>
      ))}
    </nav>

    <div class="flex items-center gap-3">
      <a
        href="/catalogo"
        class="hidden text-sm font-medium text-ink-soft transition hover:text-rosa-500 md:inline-flex"
      >
        Encomendar
      </a>
      <CartIcon client:load />
    </div>
  </div>

  <div class="md:hidden">
    <nav class="section flex items-center gap-1 overflow-x-auto pb-3 pt-1" aria-label="Navegação mobile">
      {nav.map((link) => (
        <a
          href={link.href}
          class={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
            isActive(link.href)
              ? "bg-rosa-50 text-rosa-500"
              : "text-ink-soft hover:bg-rosa-50 hover:text-rosa-500"
          }`}
        >
          {link.label}
        </a>
      ))}
    </nav>
  </div>
</header>
```

- [ ] **Step 3: Update `src/components/Footer.astro`**

Replace file contents with:

```astro
---
import { categories } from "../lib/site";
import type { SiteConfig } from "../lib/config";

interface Props {
  config: SiteConfig;
}

const { config } = Astro.props;
const { identity, footer } = config.globals;
const { logo } = config.theme;

const year = new Date().getFullYear();
---

<footer class="border-t border-ink-line bg-white">
  <div class="section py-14">
    <div class="grid gap-10 md:grid-cols-4">
      <div class="md:col-span-1">
        <a href="/" class="inline-flex items-center">
          {logo.url ? (
            <img src={logo.url} alt={logo.alt} class="h-12 w-auto" />
          ) : (
            <span class="text-lg font-semibold tracking-tight text-ink">{identity.name}</span>
          )}
        </a>
        <p class="mt-4 max-w-xs text-sm leading-relaxed text-ink-soft">
          {identity.description}
        </p>
      </div>

      {footer.columns.map((col) => (
        <div>
          <h3 class="text-xs font-semibold uppercase tracking-wide text-ink">{col.heading}</h3>
          <ul class="mt-4 space-y-2 text-sm text-ink-soft">
            {col.links.map((link) => (
              <li>
                <a href={link.href} class="transition hover:text-rosa-500">{link.label}</a>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div>
        <h3 class="text-xs font-semibold uppercase tracking-wide text-ink">Categorias</h3>
        <ul class="mt-4 space-y-2 text-sm text-ink-soft">
          {categories.slice(0, 6).map((c) => (
            <li>
              <a href={`/catalogo?categoria=${c.slug}`} class="transition hover:text-rosa-500">
                {c.label}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 class="text-xs font-semibold uppercase tracking-wide text-ink">Contacto</h3>
        <ul class="mt-4 space-y-2 text-sm text-ink-soft">
          <li>
            <a href={`mailto:${identity.email}`} class="transition hover:text-rosa-500">
              {identity.email}
            </a>
          </li>
          <li>{identity.whatsapp}</li>
          <li>Instagram: {identity.instagram}</li>
          <li>Envios via {identity.shippingProvider}</li>
        </ul>
      </div>
    </div>

    <div class="mt-12 flex flex-col items-center justify-between gap-3 border-t border-ink-line pt-6 text-xs text-ink-muted md:flex-row">
      <p>© {year} {identity.name}. {footer.bottomText}</p>
      <p>Feito com <span class="text-rosa-500">♥</span> em Portugal</p>
    </div>
  </div>
</footer>
```

- [ ] **Step 4: Trim `src/lib/site.ts`**

Replace file contents with:

```ts
export const categories = [
  { slug: "tote-bags", label: "Tote Bags" },
  { slug: "t-shirts", label: "T-Shirts" },
  { slug: "necessaire", label: "Bolsas Necessaire" },
  { slug: "frascos-vidro", label: "Frascos de Vidro" },
  { slug: "porta-chaves", label: "Porta-Chaves" },
  { slug: "capas-telemovel", label: "Capas de Telemóvel" },
  { slug: "garrafas", label: "Garrafas de Água" },
  { slug: "porta-joias", label: "Porta-Joias" },
] as const;

export type CategorySlug = (typeof categories)[number]["slug"];

export const categoryLabel = (slug: CategorySlug): string =>
  categories.find((c) => c.slug === slug)?.label ?? slug;

export const formatEuro = (value: number): string =>
  new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(value);
```

- [ ] **Step 5: Fix all broken imports from `src/lib/site.ts`**

Run:
```bash
npm run check
```

Read the errors. Any file that imported `site`, `navLinks`, `footerLinks`, `paymentMethods`, or `PaymentMethodId` from `src/lib/site.ts` must be updated:

- Storefront components/pages that used `site.*` fields: read via `const config = await getSiteConfig(Astro.locals.previewConfig)` then `config.globals.identity.<field>`.
- Files that used `paymentMethods` or `PaymentMethodId`: replace with an import of `config.globals.payments` from the same loader. If the file is a server-only file (API, query helper), call `getSiteConfig()` inside.
- If `src/lib/queries.ts` uses `formatEuro` it's still exported; no change.
- Admin screens that referenced `paymentMethods`: update imports as above.

Repeat `npm run check` after each fix until clean.

- [ ] **Step 6: Smoke test storefront**

Run:
```bash
npm run dev
```

Open `http://localhost:4321/` in a browser. Verify:
- Homepage renders (colors match the current palette — primary #F691B4).
- Header logo fallback shows "Adriana's Store" text if `/logo.svg` isn't present; logo image if it is.
- Nav links work.
- Footer renders with one column + Categorias + Contacto.
- `/catalogo`, `/sobre-nos`, `/como-encomendar` all load.

View-source on the page: confirm `<style>` block contains `--color-rosa-400: #F691B4;` and the Google Fonts link references `Inter`.

- [ ] **Step 7: Commit**

```bash
git add src/layouts/BaseLayout.astro src/components/Header.astro src/components/Footer.astro src/lib/site.ts
# add any other files modified in step 5
git commit -m "feat: storefront reads identity/theme from site_config"
```

---

## Task 7 — Site-config API: GET + PUT

**Files:**
- Create: `src/pages/api/admin/site-config.ts`

- [ ] **Step 1: Create `src/pages/api/admin/site-config.ts`**

```ts
import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { db, schema } from "../../../db/client";
import {
  getSiteConfig,
  invalidateSiteConfigCache,
  siteConfigSchema,
} from "../../../lib/config";

export const GET: APIRoute = async () => {
  const config = await getSiteConfig();
  return new Response(JSON.stringify(config), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const PUT: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = siteConfigSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Validação falhou", issues: parsed.error.issues }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  await db
    .update(schema.siteConfig)
    .set({
      theme: parsed.data.theme,
      globals: parsed.data.globals,
      updatedAt: new Date(),
    })
    .where(eq(schema.siteConfig.id, 1));

  invalidateSiteConfigCache();

  return new Response(JSON.stringify(parsed.data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
```

- [ ] **Step 2: Exercise endpoints with curl**

With dev server running, authenticated as admin (cookie set after logging in at `/admin/login`):

```bash
curl -s -b "adriana_session=<PASTE_COOKIE>" http://localhost:4321/api/admin/site-config | jq .theme.colors
```

Expected: `{ "primary": "#F691B4", "neutral": "#111111", "accent": null }`.

```bash
curl -s -b "adriana_session=<PASTE_COOKIE>" \
  -X PUT \
  -H "Content-Type: application/json" \
  -d '{"theme":{"colors":{"primary":"ZZZ","neutral":"#111111","accent":null},"fonts":{"body":"Inter","display":"Inter"},"logo":{"url":null,"alt":"x"},"radius":"rounded"},"globals":{}}' \
  http://localhost:4321/api/admin/site-config
```

Expected: 400 with `issues` array mentioning hex validation.

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/admin/site-config.ts
git commit -m "feat: GET/PUT /api/admin/site-config with Zod validation"
```

---

## Task 8 — Preview API: POST + DELETE + PUT (upsert)

**Files:**
- Create: `src/pages/api/admin/site-config/preview.ts`

- [ ] **Step 1: Create `src/pages/api/admin/site-config/preview.ts`**

```ts
import type { APIRoute } from "astro";
import { siteConfigSchema } from "../../../../lib/config";
import { clearPreview, putPreview, upsertPreview } from "../../../../lib/preview-store";

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = siteConfigSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Validação falhou", issues: parsed.error.issues }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const token = putPreview(parsed.data);
  return new Response(JSON.stringify({ token }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

// PUT with ?token=... refreshes the same token with new config (used for
// every form edit so we don't churn through tokens).
export const PUT: APIRoute = async ({ request, url }) => {
  const token = url.searchParams.get("token");
  if (!token) {
    return new Response(JSON.stringify({ error: "token em falta" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = siteConfigSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Validação falhou", issues: parsed.error.issues }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  upsertPreview(token, parsed.data);
  return new Response(JSON.stringify({ token }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const DELETE: APIRoute = async ({ url }) => {
  const token = url.searchParams.get("token");
  if (token) clearPreview(token);
  return new Response(null, { status: 204 });
};
```

- [ ] **Step 2: Smoke test**

```bash
curl -s -b "adriana_session=<COOKIE>" -X POST \
  -H "Content-Type: application/json" \
  -d @- http://localhost:4321/api/admin/site-config/preview <<'JSON'
{"theme":{"colors":{"primary":"#22c55e","neutral":"#111111","accent":null},"fonts":{"body":"Inter","display":"Inter"},"logo":{"url":null,"alt":"Test"},"radius":"rounded"},"globals":{"identity":{"name":"Test","tagline":"t","description":"d","email":"a@b.c","whatsapp":"+351","instagram":"@x","shippingProvider":"CTT","preparationDays":"3"},"nav":[{"href":"/","label":"Home"}],"footer":{"columns":[{"heading":"H","links":[{"href":"/","label":"L"}]}],"bottomText":"©"},"banner":{"enabled":false,"text":"","linkUrl":null,"bgColor":"rosa","dismissible":true},"payments":[{"id":"mbway","label":"MBWay","instructions":"x"}]}}
JSON
```

Expected: `{"token":"<nanoid>"}`. Then open `http://localhost:4321/?preview=<token>` in the SAME browser where you're logged in as admin. The primary color should shift to green.

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/admin/site-config/preview.ts
git commit -m "feat: preview token endpoints (POST/PUT/DELETE) for site_config"
```

---

## Task 9 — Shared admin UI atoms: PreviewShell, DragList, ColorPicker, FontPicker

**Files:**
- Create: `src/components/admin/PreviewShell.tsx`
- Create: `src/components/admin/DragList.tsx`
- Create: `src/components/admin/ColorPicker.tsx`
- Create: `src/components/admin/FontPicker.tsx`

- [ ] **Step 1: Create `src/components/admin/PreviewShell.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import type { SiteConfig } from "../../lib/config";

interface Props {
  initialConfig: SiteConfig;
  currentConfig: SiteConfig;
  isDirty: boolean;
  previewPath: string;            // e.g. "/"
  onSave: () => Promise<void>;
  onReset: () => void;
  children: React.ReactNode;      // the form
  // Optional: called with the iframe window after mount, used for postMessage.
  onIframeReady?: (win: Window) => void;
}

type Device = "desktop" | "mobile";

export default function PreviewShell({
  initialConfig,
  currentConfig,
  isDirty,
  previewPath,
  onSave,
  onReset,
  children,
  onIframeReady,
}: Props) {
  void initialConfig;
  const [device, setDevice] = useState<Device>("desktop");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const debounceRef = useRef<number | null>(null);

  // Create a preview token on mount; refresh it on every config change (debounced).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/admin/site-config/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentConfig),
      });
      if (!res.ok) return;
      const data = await res.json() as { token: string };
      if (!cancelled) setToken(data.token);
    })();
    return () => {
      cancelled = true;
      if (token) {
        fetch(`/api/admin/site-config/preview?token=${token}`, { method: "DELETE" });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced PUT on every config change.
  useEffect(() => {
    if (!token) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      fetch(`/api/admin/site-config/preview?token=${token}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentConfig),
      });
    }, 300);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [currentConfig, token]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await onSave();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erro ao gravar");
    } finally {
      setSaving(false);
    }
  };

  const iframeSrc = token ? `${previewPath}?preview=${token}` : previewPath;

  return (
    <div className="flex h-[calc(100vh-80px)] flex-col">
      <div className="flex items-center justify-between border-b border-ink-line bg-white px-6 py-3">
        <div className="flex gap-1 rounded-full border border-ink-line p-1">
          <button
            type="button"
            onClick={() => setDevice("desktop")}
            className={`px-3 py-1 text-xs font-medium rounded-full ${device === "desktop" ? "bg-ink text-white" : "text-ink-soft"}`}
          >
            Desktop
          </button>
          <button
            type="button"
            onClick={() => setDevice("mobile")}
            className={`px-3 py-1 text-xs font-medium rounded-full ${device === "mobile" ? "bg-ink text-white" : "text-ink-soft"}`}
          >
            Mobile
          </button>
        </div>

        <div className="flex items-center gap-3">
          {saveError && <span className="text-xs text-red-600">{saveError}</span>}
          <button
            type="button"
            onClick={onReset}
            disabled={!isDirty || saving}
            className="rounded-full border border-ink-line px-4 py-2 text-sm font-medium text-ink-soft disabled:opacity-40"
          >
            Reverter
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="rounded-full bg-rosa-400 px-5 py-2 text-sm font-medium text-white hover:bg-rosa-500 disabled:opacity-40"
          >
            {saving ? "A gravar…" : "Gravar"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-[420px] shrink-0 overflow-y-auto border-r border-ink-line bg-white p-6">
          {children}
        </aside>
        <div className="flex-1 overflow-hidden bg-ink-line/40 p-4">
          <div
            className="mx-auto h-full overflow-hidden rounded-2xl border border-ink-line bg-white shadow-sm"
            style={{ maxWidth: device === "mobile" ? 390 : "100%" }}
          >
            <iframe
              ref={(el) => {
                iframeRef.current = el;
                if (el && onIframeReady && el.contentWindow) {
                  onIframeReady(el.contentWindow);
                }
              }}
              src={iframeSrc}
              className="h-full w-full"
              title="Preview"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/admin/DragList.tsx`**

```tsx
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";

interface DragListProps<T> {
  items: T[];
  getId: (item: T, index: number) => string;
  onReorder: (next: T[]) => void;
  renderItem: (item: T, index: number, dragHandle: ReactNode) => ReactNode;
}

export default function DragList<T>({ items, getId, onReorder, renderItem }: DragListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = items.map((item, i) => getId(item, i));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = ids.indexOf(String(active.id));
    const newIdx = ids.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    onReorder(arrayMove(items, oldIdx, newIdx));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {items.map((item, i) => (
            <SortableRow key={ids[i]} id={ids[i]}>
              {(handle) => renderItem(item, i, handle)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, children }: { id: string; children: (handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const handle = (
    <button
      type="button"
      aria-label="Arrastar para reordenar"
      className="flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded text-ink-muted hover:bg-rosa-50 hover:text-rosa-500"
      {...attributes}
      {...listeners}
    >
      ⠿
    </button>
  );
  return (
    <div ref={setNodeRef} style={style}>
      {children(handle)}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/admin/ColorPicker.tsx`**

```tsx
import { deriveScale, isValidHex, SHADE_KEYS } from "../../lib/theme-colors";

interface Props {
  label: string;
  value: string;
  onChange: (next: string) => void;
  showScale?: boolean;
}

export default function ColorPicker({ label, value, onChange, showScale = true }: Props) {
  const valid = isValidHex(value);
  const scale = valid ? deriveScale(value) : null;

  return (
    <div>
      <label className="field-label">{label}</label>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="color"
          value={valid ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded border border-ink-line"
          aria-label={`${label} — color picker`}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          className="field-input flex-1 uppercase"
          placeholder="#F691B4"
        />
      </div>
      {!valid && <p className="mt-1 text-xs text-red-600">Hex inválido</p>}
      {showScale && scale && (
        <div className="mt-2 flex gap-1">
          {SHADE_KEYS.map((k) => (
            <div
              key={k}
              className="h-6 flex-1 rounded"
              style={{ backgroundColor: scale[k] }}
              title={`${k}: ${scale[k]}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create `src/components/admin/FontPicker.tsx`**

```tsx
import { FONT_FAMILIES } from "../../lib/fonts";

interface Props {
  label: string;
  value: string;
  onChange: (next: string) => void;
}

export default function FontPicker({ label, value, onChange }: Props) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field-input mt-1"
      >
        {FONT_FAMILIES.map((f) => (
          <option key={f.name} value={f.name}>
            {f.name} — {f.category}
          </option>
        ))}
      </select>
      <p className="mt-2 text-sm" style={{ fontFamily: `"${value}", ${getFallback(value)}` }}>
        A rápida raposa castanha salta sobre o cão preguiçoso — 1234567890
      </p>
    </div>
  );
}

function getFallback(name: string): string {
  return FONT_FAMILIES.find((f) => f.name === name)?.fallback ?? "system-ui, sans-serif";
}
```

- [ ] **Step 5: Typecheck**

Run:
```bash
npm run check
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/PreviewShell.tsx src/components/admin/DragList.tsx src/components/admin/ColorPicker.tsx src/components/admin/FontPicker.tsx
git commit -m "feat: admin editor atoms (PreviewShell, DragList, ColorPicker, FontPicker)"
```

---

## Task 10 — ThemeEditor + `/admin/theme` route

**Files:**
- Create: `src/components/admin/ThemeEditor.tsx`
- Create: `src/pages/admin/theme.astro`

- [ ] **Step 1: Create `src/components/admin/ThemeEditor.tsx`**

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import type { SiteConfig, Theme } from "../../lib/config";
import { renderGoogleFontsHref, renderThemeCSS } from "../../lib/config";
import ColorPicker from "./ColorPicker";
import FontPicker from "./FontPicker";
import PreviewShell from "./PreviewShell";

interface Props {
  initialConfig: SiteConfig;
}

const RADIUS_LABELS: Array<{ value: Theme["radius"]; label: string }> = [
  { value: "none", label: "Nenhum" },
  { value: "soft", label: "Suave" },
  { value: "rounded", label: "Arredondado" },
  { value: "pill", label: "Pill" },
];

export default function ThemeEditor({ initialConfig }: Props) {
  const [config, setConfig] = useState<SiteConfig>(initialConfig);
  const [accentOn, setAccentOn] = useState<boolean>(initialConfig.theme.colors.accent !== null);
  const iframeWinRef = useRef<Window | null>(null);

  const isDirty = useMemo(
    () => JSON.stringify(config) !== JSON.stringify(initialConfig),
    [config, initialConfig],
  );

  const setTheme = (patch: Partial<Theme>) =>
    setConfig((c) => ({ ...c, theme: { ...c.theme, ...patch } }));

  // Live-push CSS + fonts to iframe via postMessage.
  useEffect(() => {
    const win = iframeWinRef.current;
    if (!win) return;
    try {
      win.postMessage(
        {
          kind: "preview-theme-css",
          css: renderThemeCSS(config.theme),
          fontsHref: renderGoogleFontsHref(config.theme.fonts),
        },
        "*",
      );
    } catch { /* iframe may not be ready */ }
  }, [config.theme]);

  const handleSave = async () => {
    const res = await fetch("/api/admin/site-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error ?? `HTTP ${res.status}`);
    }
    // Treat save as successful — reload to pick up server-side config.
    window.location.reload();
  };

  return (
    <PreviewShell
      initialConfig={initialConfig}
      currentConfig={config}
      isDirty={isDirty}
      previewPath="/"
      onSave={handleSave}
      onReset={() => { setConfig(initialConfig); setAccentOn(initialConfig.theme.colors.accent !== null); }}
      onIframeReady={(win) => { iframeWinRef.current = win; }}
    >
      <div className="space-y-6">
        <section>
          <h2 className="text-sm font-semibold text-ink">Cores</h2>
          <div className="mt-3 space-y-4">
            <ColorPicker
              label="Cor principal"
              value={config.theme.colors.primary}
              onChange={(primary) => setTheme({ colors: { ...config.theme.colors, primary } })}
            />
            <ColorPicker
              label="Cor neutra (texto)"
              value={config.theme.colors.neutral}
              onChange={(neutral) => setTheme({ colors: { ...config.theme.colors, neutral } })}
            />
            <div>
              <label className="flex items-center gap-2 text-sm text-ink-soft">
                <input
                  type="checkbox"
                  checked={accentOn}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setAccentOn(on);
                    setTheme({
                      colors: {
                        ...config.theme.colors,
                        accent: on ? (config.theme.colors.accent ?? "#22c55e") : null,
                      },
                    });
                  }}
                />
                Usar cor de acento
              </label>
              {accentOn && config.theme.colors.accent !== null && (
                <div className="mt-2">
                  <ColorPicker
                    label="Cor de acento"
                    value={config.theme.colors.accent}
                    onChange={(accent) => setTheme({ colors: { ...config.theme.colors, accent } })}
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-ink">Tipografia</h2>
          <div className="mt-3 space-y-4">
            <FontPicker
              label="Corpo"
              value={config.theme.fonts.body}
              onChange={(body) => setTheme({ fonts: { ...config.theme.fonts, body } })}
            />
            <FontPicker
              label="Títulos"
              value={config.theme.fonts.display}
              onChange={(display) => setTheme({ fonts: { ...config.theme.fonts, display } })}
            />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-ink">Logótipo</h2>
          <div className="mt-3 space-y-3">
            <label className="field-label">URL do logótipo (deixa vazio para usar texto)</label>
            <input
              type="text"
              value={config.theme.logo.url ?? ""}
              onChange={(e) =>
                setTheme({ logo: { ...config.theme.logo, url: e.target.value || null } })
              }
              className="field-input"
              placeholder="https://…/logo.svg"
            />
            <label className="field-label">Texto alternativo</label>
            <input
              type="text"
              value={config.theme.logo.alt}
              onChange={(e) => setTheme({ logo: { ...config.theme.logo, alt: e.target.value } })}
              className="field-input"
            />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-ink">Arredondamento</h2>
          <div className="mt-3 flex gap-2">
            {RADIUS_LABELS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setTheme({ radius: r.value })}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium ${
                  config.theme.radius === r.value
                    ? "border-rosa-400 bg-rosa-50 text-rosa-600"
                    : "border-ink-line text-ink-soft hover:border-rosa-300"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </section>
      </div>
    </PreviewShell>
  );
}
```

- [ ] **Step 2: Create `src/pages/admin/theme.astro`**

```astro
---
import AdminLayout from "../../layouts/AdminLayout.astro";
import ThemeEditor from "../../components/admin/ThemeEditor.tsx";
import { getSiteConfig } from "../../lib/config";

const user = Astro.locals.user;
if (!user) return Astro.redirect("/admin/login");

const config = await getSiteConfig();
---

<AdminLayout title="Tema" user={user} hideLayoutPadding>
  <ThemeEditor client:only="react" initialConfig={config} />
</AdminLayout>
```

- [ ] **Step 3: Support `hideLayoutPadding` prop in `AdminLayout.astro`**

Open `src/layouts/AdminLayout.astro`. Locate the `<Props>` interface and main content wrapper. Add a prop:

```ts
interface Props {
  title: string;
  user: { /* existing fields */ };
  hideLayoutPadding?: boolean;
}
```

Then in the template, where the content container currently renders with padding, branch on `hideLayoutPadding`:

```astro
{hideLayoutPadding
  ? <slot />
  : <main class="...existing classes..."><slot /></main>
}
```

(Read the existing file; match its exact wrapper structure. If the main wrapper has multiple layers, only drop the inner padding/max-width; keep the header/sidebar intact.)

- [ ] **Step 4: Smoke test**

Restart `npm run dev`. Log in as admin, navigate to `/admin/theme`.

Expected:
- Full-viewport editor layout: form on left, iframe preview on right.
- Change the primary color via the color picker. Iframe updates within ~300ms: header button states, hover colors, focus ring shift.
- Scale chips update live.
- Click "Gravar". Page reloads; public `/` (no preview) now has the new color.
- Click "Reverter" after unsaved change: form resets.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/ThemeEditor.tsx src/pages/admin/theme.astro src/layouts/AdminLayout.astro
git commit -m "feat: theme editor with live preview at /admin/theme"
```

---

## Task 11 — GlobalsEditor + `/admin/globals` route

**Files:**
- Create: `src/components/admin/GlobalsEditor.tsx`
- Create: `src/pages/admin/globals.astro`

- [ ] **Step 1: Create `src/components/admin/GlobalsEditor.tsx`**

```tsx
import { useMemo, useState } from "react";
import type { Globals, SiteConfig } from "../../lib/config";
import DragList from "./DragList";
import PreviewShell from "./PreviewShell";

interface Props {
  initialConfig: SiteConfig;
}

type Tab = "identity" | "nav" | "footer" | "banner" | "payments";
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "identity", label: "Identidade" },
  { id: "nav", label: "Navegação" },
  { id: "footer", label: "Footer" },
  { id: "banner", label: "Banner" },
  { id: "payments", label: "Pagamentos" },
];

export default function GlobalsEditor({ initialConfig }: Props) {
  const [config, setConfig] = useState<SiteConfig>(initialConfig);
  const [tab, setTab] = useState<Tab>("identity");

  const isDirty = useMemo(
    () => JSON.stringify(config) !== JSON.stringify(initialConfig),
    [config, initialConfig],
  );

  const setGlobals = (patch: Partial<Globals>) =>
    setConfig((c) => ({ ...c, globals: { ...c.globals, ...patch } }));

  const handleSave = async () => {
    const res = await fetch("/api/admin/site-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error ?? `HTTP ${res.status}`);
    }
    window.location.reload();
  };

  return (
    <PreviewShell
      initialConfig={initialConfig}
      currentConfig={config}
      isDirty={isDirty}
      previewPath="/"
      onSave={handleSave}
      onReset={() => setConfig(initialConfig)}
    >
      <div className="flex flex-wrap gap-1 border-b border-ink-line pb-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              tab === t.id ? "bg-ink text-white" : "text-ink-soft hover:bg-rosa-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-4">
        {tab === "identity" && <IdentityForm config={config} setGlobals={setGlobals} />}
        {tab === "nav" && <NavForm config={config} setGlobals={setGlobals} />}
        {tab === "footer" && <FooterForm config={config} setGlobals={setGlobals} />}
        {tab === "banner" && <BannerForm config={config} setGlobals={setGlobals} />}
        {tab === "payments" && <PaymentsForm config={config} setGlobals={setGlobals} />}
      </div>
    </PreviewShell>
  );
}

interface FormProps {
  config: SiteConfig;
  setGlobals: (patch: Partial<Globals>) => void;
}

function IdentityForm({ config, setGlobals }: FormProps) {
  const { identity } = config.globals;
  const patch = (p: Partial<Globals["identity"]>) => setGlobals({ identity: { ...identity, ...p } });
  return (
    <div className="space-y-3">
      <Field label="Nome da loja" value={identity.name} onChange={(name) => patch({ name })} />
      <Field label="Tagline" value={identity.tagline} onChange={(tagline) => patch({ tagline })} />
      <Textarea label="Descrição" value={identity.description} onChange={(description) => patch({ description })} />
      <Field label="Email" value={identity.email} onChange={(email) => patch({ email })} />
      <Field label="WhatsApp" value={identity.whatsapp} onChange={(whatsapp) => patch({ whatsapp })} />
      <Field label="Instagram" value={identity.instagram} onChange={(instagram) => patch({ instagram })} />
      <Field label="Transportadora" value={identity.shippingProvider} onChange={(shippingProvider) => patch({ shippingProvider })} />
      <Field label="Dias de preparação" value={identity.preparationDays} onChange={(preparationDays) => patch({ preparationDays })} />
    </div>
  );
}

function NavForm({ config, setGlobals }: FormProps) {
  const { nav } = config.globals;
  const update = (i: number, patch: Partial<Globals["nav"][number]>) =>
    setGlobals({ nav: nav.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) });
  const remove = (i: number) => setGlobals({ nav: nav.filter((_, idx) => idx !== i) });
  const add = () => setGlobals({ nav: [...nav, { href: "/", label: "Novo" }] });

  return (
    <div>
      <DragList
        items={nav}
        getId={(_, i) => `nav-${i}`}
        onReorder={(next) => setGlobals({ nav: next })}
        renderItem={(link, i, handle) => (
          <div className="flex items-center gap-2 rounded-lg border border-ink-line bg-white p-2">
            {handle}
            <input
              value={link.label}
              onChange={(e) => update(i, { label: e.target.value })}
              className="field-input flex-1"
              placeholder="Rótulo"
            />
            <input
              value={link.href}
              onChange={(e) => update(i, { href: e.target.value })}
              className="field-input flex-1"
              placeholder="/caminho"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-xs text-red-500 hover:underline"
            >
              Remover
            </button>
          </div>
        )}
      />
      <button
        type="button"
        onClick={add}
        className="mt-3 w-full rounded-lg border border-dashed border-ink-line py-2 text-xs font-medium text-ink-soft hover:border-rosa-300 hover:text-rosa-500"
      >
        + Adicionar item
      </button>
    </div>
  );
}

function FooterForm({ config, setGlobals }: FormProps) {
  const { footer } = config.globals;
  const setCol = (ci: number, patch: Partial<Globals["footer"]["columns"][number]>) =>
    setGlobals({
      footer: {
        ...footer,
        columns: footer.columns.map((c, i) => (i === ci ? { ...c, ...patch } : c)),
      },
    });
  const addCol = () =>
    setGlobals({
      footer: { ...footer, columns: [...footer.columns, { heading: "Nova coluna", links: [{ href: "/", label: "Link" }] }] },
    });
  const removeCol = (ci: number) =>
    setGlobals({ footer: { ...footer, columns: footer.columns.filter((_, i) => i !== ci) } });

  return (
    <div className="space-y-4">
      <DragList
        items={footer.columns}
        getId={(_, i) => `col-${i}`}
        onReorder={(next) => setGlobals({ footer: { ...footer, columns: next } })}
        renderItem={(col, ci, handle) => (
          <div className="rounded-lg border border-ink-line bg-white p-3">
            <div className="flex items-center gap-2">
              {handle}
              <input
                value={col.heading}
                onChange={(e) => setCol(ci, { heading: e.target.value })}
                className="field-input flex-1"
                placeholder="Título da coluna"
              />
              <button type="button" onClick={() => removeCol(ci)} className="text-xs text-red-500 hover:underline">
                Remover
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {col.links.map((l, li) => (
                <div key={li} className="flex gap-2">
                  <input
                    value={l.label}
                    onChange={(e) =>
                      setCol(ci, {
                        links: col.links.map((x, i) => (i === li ? { ...x, label: e.target.value } : x)),
                      })
                    }
                    className="field-input flex-1"
                    placeholder="Rótulo"
                  />
                  <input
                    value={l.href}
                    onChange={(e) =>
                      setCol(ci, {
                        links: col.links.map((x, i) => (i === li ? { ...x, href: e.target.value } : x)),
                      })
                    }
                    className="field-input flex-1"
                    placeholder="/caminho"
                  />
                  <button
                    type="button"
                    onClick={() => setCol(ci, { links: col.links.filter((_, i) => i !== li) })}
                    className="text-xs text-red-500 hover:underline"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setCol(ci, { links: [...col.links, { href: "/", label: "Novo" }] })}
                className="text-xs text-ink-soft hover:text-rosa-500"
              >
                + link
              </button>
            </div>
          </div>
        )}
      />
      <button
        type="button"
        onClick={addCol}
        className="w-full rounded-lg border border-dashed border-ink-line py-2 text-xs font-medium text-ink-soft hover:border-rosa-300 hover:text-rosa-500"
      >
        + Adicionar coluna
      </button>
      <Field
        label="Texto inferior"
        value={footer.bottomText}
        onChange={(bottomText) => setGlobals({ footer: { ...footer, bottomText } })}
      />
    </div>
  );
}

function BannerForm({ config, setGlobals }: FormProps) {
  const { banner } = config.globals;
  const patch = (p: Partial<Globals["banner"]>) => setGlobals({ banner: { ...banner, ...p } });
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input type="checkbox" checked={banner.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
        Mostrar banner
      </label>
      <Field label="Texto" value={banner.text} onChange={(text) => patch({ text })} />
      <Field label="Link (opcional)" value={banner.linkUrl ?? ""} onChange={(v) => patch({ linkUrl: v || null })} />
      <div>
        <label className="field-label">Cor de fundo</label>
        <div className="mt-1 flex gap-2">
          {(["rosa", "ink"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => patch({ bgColor: c })}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs ${
                banner.bgColor === c ? "border-rosa-400 bg-rosa-50" : "border-ink-line"
              }`}
            >
              {c === "rosa" ? "Rosa" : "Escuro"}
            </button>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input type="checkbox" checked={banner.dismissible} onChange={(e) => patch({ dismissible: e.target.checked })} />
        Permitir fechar
      </label>
    </div>
  );
}

function PaymentsForm({ config, setGlobals }: FormProps) {
  const { payments } = config.globals;
  const update = (i: number, patch: Partial<Globals["payments"][number]>) =>
    setGlobals({ payments: payments.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) });
  return (
    <DragList
      items={payments}
      getId={(p) => `pay-${p.id}`}
      onReorder={(next) => setGlobals({ payments: next })}
      renderItem={(p, i, handle) => (
        <div className="space-y-2 rounded-lg border border-ink-line bg-white p-3">
          <div className="flex items-center gap-2">
            {handle}
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{p.id}</span>
            <input
              value={p.label}
              onChange={(e) => update(i, { label: e.target.value })}
              className="field-input flex-1"
              placeholder="Rótulo"
            />
          </div>
          <Textarea
            label="Instruções"
            value={p.instructions}
            onChange={(instructions) => update(i, { instructions })}
          />
        </div>
      )}
    />
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field-input mt-1"
      />
    </div>
  );
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="field-input mt-1 resize-y"
      />
    </div>
  );
}
```

- [ ] **Step 2: Create `src/pages/admin/globals.astro`**

```astro
---
import AdminLayout from "../../layouts/AdminLayout.astro";
import GlobalsEditor from "../../components/admin/GlobalsEditor.tsx";
import { getSiteConfig } from "../../lib/config";

const user = Astro.locals.user;
if (!user) return Astro.redirect("/admin/login");

const config = await getSiteConfig();
---

<AdminLayout title="Globais" user={user} hideLayoutPadding>
  <GlobalsEditor client:only="react" initialConfig={config} />
</AdminLayout>
```

- [ ] **Step 3: Smoke test**

Navigate to `/admin/globals`.

Expected:
- 5 tabs visible.
- Identity tab: edit name → iframe reloads on debounce → header/footer update.
- Navigation tab: drag-reorder works; add/remove items; preview reflects after save + reload.
- Footer tab: add column with links; preview updates.
- Banner tab: enable + set text → banner appears at top of storefront on next iframe reload.
- Payments tab: edit MBWay instructions; no visible preview effect until visit checkout (OK — out of scope for this task).
- Click "Gravar" → page reloads, public `/` reflects changes.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/GlobalsEditor.tsx src/pages/admin/globals.astro
git commit -m "feat: globals editor at /admin/globals"
```

---

## Task 12 — Admin navigation links

**Files:**
- Modify: `src/layouts/AdminLayout.astro`

- [ ] **Step 1: Find the nav link list in `AdminLayout.astro`**

Open the file and locate the admin sidebar/nav. It already contains links to Products, Orders, Pages, Users.

- [ ] **Step 2: Add two more links**

Insert (preserving the file's exact markup pattern) two new entries after the existing links (position — right before Users, grouped with content):

```astro
<a
  href="/admin/theme"
  class={navLinkClass("/admin/theme")}
>
  <span>Tema</span>
</a>
<a
  href="/admin/globals"
  class={navLinkClass("/admin/globals")}
>
  <span>Globais</span>
</a>
```

(Match the real class helper / structure used by the existing links in the file. If the file uses raw `class="..."` attributes, copy-paste the current pattern and swap the href/label.)

- [ ] **Step 3: Smoke test**

`npm run dev`, log in, open `/admin`. Confirm "Tema" and "Globais" appear in the sidebar. Click each — routes work, editors load.

- [ ] **Step 4: Commit**

```bash
git add src/layouts/AdminLayout.astro
git commit -m "feat: link theme and globals editors from admin sidebar"
```

---

## Task 13 — Documentation update

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the Architecture section in `CLAUDE.md`**

Find the existing "Block-based CMS" paragraph. Right after it, add:

```markdown
**Site config (theme + globals)**: A singleton row in `site_config` table stores the live `theme` (colors, fonts, logo, radius) and `globals` (nav, footer, banner, identity, payments). Storefront SSR reads it via `getSiteConfig()` in `src/lib/config.ts` (5-min in-process cache, invalidated on save). Tailwind v4's `@theme` CSS variables are overridden at runtime by a `<style>` block injected in `BaseLayout.astro`. Admin editors at `/admin/theme` and `/admin/globals` use a shared `PreviewShell` with an iframe + preview token (`?preview=<token>`) honoured by the middleware for logged-in admins.
```

Under "Key Directories", add:

```markdown
- `src/lib/config.ts` — site config types, Zod schemas, loader, renderers
- `src/lib/theme-colors.ts` — hex → 50/100/.../700 shade derivation
- `src/lib/fonts.ts` — curated Google Fonts list
- `src/lib/preview-store.ts` — in-memory preview token map
```

Under "Conventions", adjust:

```markdown
- **Site identity / theme**: edited in-admin via `/admin/theme` and `/admin/globals`. Do NOT add hardcoded nav/footer/identity strings — they belong in `site_config.globals`. `src/lib/site.ts` keeps only the category enum and `formatEuro`.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document site_config + theme/globals editors"
```

---

## Task 14 — Full acceptance run

**Files:** none (verification only)

- [ ] **Step 1: Restart dev server fresh**

```bash
npm run dev
```

- [ ] **Step 2: Walk through the spec's acceptance checklist**

Open two browser windows: one logged in as admin, one in incognito.

1. `/admin/theme` → change primary color to `#22c55e`. Iframe updates within 300ms (postMessage path). ✅
2. Click "Gravar". Public `/` (incognito) reloads and shows green. ✅
3. `/admin/theme` → change body font to `Playfair Display`. After save, incognito shows the new font. ✅
4. `/admin/theme` → set logo URL to a real asset (or leave empty to see text fallback). Save → header updates on all pages. ✅
5. `/admin/globals` → Navegação tab → drag-reorder items, rename one. Save → incognito reflects on reload. ✅
6. `/admin/globals` → Footer tab → add a column with 3 links. Save → incognito footer updates. ✅
7. `/admin/globals` → Banner tab → enable, set text "Envio grátis esta semana", link `/catalogo`. Save → incognito banner appears at top. ✅
8. `/admin/globals` → Pagamentos tab → edit MBWay instructions. Save → go to checkout, select MBWay → instructions match. ✅
9. `/admin/theme` → set primary color to `#zzzzz` (invalid). Save button is disabled; inline "Hex inválido" shown. ✅
10. `/admin/globals` → change name. Close tab without saving. Incognito unchanged. ✅
11. Two admin tabs open → save in tab 1 → tab 2 still shows its stale state (known limitation, acceptable; no tab-2-refresh prompt in Phase 1). ✅

- [ ] **Step 3: Verify typecheck**

```bash
npm run check
```

Expected: clean.

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: production build succeeds.

- [ ] **Step 5: Final commit (if any drift)**

If any of the acceptance steps surfaced a bug, fix it in the relevant file and commit. Otherwise no-op.

- [ ] **Step 6: Push**

```bash
git push origin main
```

---

## Self-review notes

- **Spec coverage:** Theme (colors/fonts/logo/radius) ✅, Globals (nav/footer/banner/identity/payments) ✅, Preview shell ✅, CSS var propagation ✅, seed ✅, API ✅, admin routes ✅, admin nav ✅, docs ✅, acceptance checklist ✅.
- **No placeholders:** All code blocks contain real, runnable code. File paths are exact. `AdminLayout.astro` edit (Task 12) is description-only because the file wasn't read — that's acknowledged explicitly with "match the real class helper".
- **Type consistency:** `SiteConfig`, `Theme`, `Globals` are defined once (config.ts) and used uniformly. `renderThemeCSS`/`renderGoogleFontsHref` signatures match the callsites in BaseLayout. Preview API token contract (`{ token }`) is consistent across POST/PUT.
- **Drafts/versioning deliberately absent** — that's Phase 2 per spec.
