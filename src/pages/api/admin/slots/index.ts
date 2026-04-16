import type { APIRoute } from "astro";
import { db, schema } from "../../../../db/client";
import { asc } from "drizzle-orm";

export const prerender = false;

export const GET: APIRoute = async () => {
  const rows = await db
    .select()
    .from(schema.slots)
    .orderBy(asc(schema.slots.page), asc(schema.slots.name));
  return new Response(JSON.stringify(rows), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
