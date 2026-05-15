import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { db, schema } from "../../../db/client";
import { siteConfigSchema } from "../../../lib/config";
import { getSiteConfig, invalidateSiteConfigCache } from "../../../lib/config-server";
import { hashContentSync } from "../../../lib/legacy-banner";

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

  // Defensively recompute contentVersion server-side. The admin client
  // hashes async on every onChange, but the server is the source of truth —
  // never trust client-supplied hashes for storage keys.
  parsed.data.globals.banner.contentVersion = hashContentSync(
    parsed.data.globals.banner.contentHtml,
  );

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
