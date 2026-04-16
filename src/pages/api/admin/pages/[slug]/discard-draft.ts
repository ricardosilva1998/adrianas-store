import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { db, schema } from "../../../../../db/client";

export const prerender = false;

export const POST: APIRoute = async ({ params, locals }) => {
  if (!locals.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const slug = params.slug;
  if (!slug) return new Response(JSON.stringify({ error: "Slug em falta" }), { status: 400 });

  await db
    .update(schema.pages)
    .set({ draftBlocks: null, updatedAt: new Date() })
    .where(eq(schema.pages.slug, slug));

  return new Response(JSON.stringify({ success: true }), { status: 200 });
};
