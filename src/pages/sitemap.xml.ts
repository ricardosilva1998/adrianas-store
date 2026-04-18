import type { APIRoute } from "astro";
import { db, schema } from "../db/client";
import { eq, asc } from "drizzle-orm";

export const prerender = false;

type SitemapEntry = {
  loc: string;
  lastmod?: string;
  changefreq?: "daily" | "weekly" | "monthly";
  priority?: string;
};

const escapeXml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const toIsoDate = (d: Date | string | null | undefined): string | undefined => {
  if (!d) return undefined;
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
};

export const GET: APIRoute = async ({ url }) => {
  const origin = url.origin;

  const entries: SitemapEntry[] = [];

  entries.push({ loc: `${origin}/`, changefreq: "weekly", priority: "1.0" });
  entries.push({ loc: `${origin}/catalogo`, changefreq: "weekly", priority: "0.9" });

  const [publishedPages, activeProducts] = await Promise.all([
    db
      .select({
        slug: schema.pages.slug,
        updatedAt: schema.pages.updatedAt,
      })
      .from(schema.pages)
      .where(eq(schema.pages.published, true))
      .orderBy(asc(schema.pages.slug)),
    db
      .select({
        slug: schema.products.slug,
        updatedAt: schema.products.updatedAt,
      })
      .from(schema.products)
      .where(eq(schema.products.active, true))
      .orderBy(asc(schema.products.slug)),
  ]);

  for (const page of publishedPages) {
    if (page.slug === "home") continue;
    entries.push({
      loc: `${origin}/${page.slug}`,
      lastmod: toIsoDate(page.updatedAt),
      changefreq: "monthly",
      priority: "0.7",
    });
  }

  for (const product of activeProducts) {
    entries.push({
      loc: `${origin}/catalogo/${product.slug}`,
      lastmod: toIsoDate(product.updatedAt),
      changefreq: "weekly",
      priority: "0.8",
    });
  }

  const urls = entries
    .map((e) => {
      const parts = [`    <loc>${escapeXml(e.loc)}</loc>`];
      if (e.lastmod) parts.push(`    <lastmod>${e.lastmod}</lastmod>`);
      if (e.changefreq) parts.push(`    <changefreq>${e.changefreq}</changefreq>`);
      if (e.priority) parts.push(`    <priority>${e.priority}</priority>`);
      return `  <url>\n${parts.join("\n")}\n  </url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=900",
    },
  });
};
