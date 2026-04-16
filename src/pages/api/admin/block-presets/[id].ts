import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { db, schema } from "../../../../db/client";

export const prerender = false;

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!locals.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return new Response(JSON.stringify({ error: "Id invalido" }), { status: 400 });
  }
  await db.delete(schema.blockPresets).where(eq(schema.blockPresets.id, id));
  return new Response(JSON.stringify({ success: true }), { status: 200 });
};
