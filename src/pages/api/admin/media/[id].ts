import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { db, schema } from "../../../../db/client";

export const prerender = false;

export const DELETE: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return new Response(JSON.stringify({ error: "ID inválido" }), { status: 400 });
  }
  await db.delete(schema.mediaLibrary).where(eq(schema.mediaLibrary.id, id));
  return new Response(null, { status: 204 });
};
