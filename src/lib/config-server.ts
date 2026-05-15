// Server-only helpers for site_config. Imports the DB driver, so this
// module must NEVER be imported from React islands or other client code.
// Browser-safe pieces (types, schemas, defaults, CSS renderers) live in
// `./config.ts`.

import { eq } from "drizzle-orm";
import { db, schema } from "../db/client";
import {
  DEFAULT_SITE_CONFIG,
  siteConfigSchema,
  type SiteConfig,
} from "./config";
import { legacyBannerMigration } from "./legacy-banner";

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

  // Server-side legacy migration: jsonb `globals.banner` may still hold the
  // pre-2026-05 shape ({ text, linkUrl, bgColor, ... }). Convert in-memory
  // before schema validation. Kept here (not as a Zod preprocess) so that
  // `config.ts` stays free of `node:crypto` and ships clean to client bundles.
  const rawGlobals = rows[0].globals as Record<string, unknown> | null;
  const globals = rawGlobals
    ? { ...rawGlobals, banner: legacyBannerMigration(rawGlobals.banner) }
    : rawGlobals;

  const parsed = siteConfigSchema.safeParse({
    theme: rows[0].theme,
    globals,
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
