import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { db, schema } from "../../../../../db/client";

export const prerender = false;

export const POST: APIRoute = async ({ params, locals }) => {
  if (!locals.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const slug = params.slug;
  if (!slug) return new Response(JSON.stringify({ error: "Slug em falta" }), { status: 400 });

  const [row] = await db.select().from(schema.pages).where(eq(schema.pages.slug, slug)).limit(1);
  if (!row) return new Response(JSON.stringify({ error: "Pagina nao encontrada" }), { status: 404 });

  // If there's no draft, publishing is a no-op (page is already live).
  if (row.draftBlocks === null) {
    return new Response(JSON.stringify({ success: true, noop: true }), { status: 200 });
  }

  await db
    .update(schema.pages)
    .set({ blocks: row.draftBlocks, draftBlocks: null, updatedAt: new Date() })
    .where(eq(schema.pages.slug, slug));

  return new Response(JSON.stringify({ success: true }), { status: 200 });
};
