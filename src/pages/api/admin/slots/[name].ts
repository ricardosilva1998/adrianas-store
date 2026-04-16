import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../../../../db/client";
import { blocksArraySchema } from "../../../../lib/blocks";

export const prerender = false;

const UpdateSchema = z.object({
  blocks: blocksArraySchema,
});

export const GET: APIRoute = async ({ params }) => {
  const name = params.name;
  if (!name) return new Response(JSON.stringify({ error: "name em falta" }), { status: 400 });
  const [slot] = await db
    .select()
    .from(schema.slots)
    .where(eq(schema.slots.name, name))
    .limit(1);
  if (!slot) return new Response(JSON.stringify({ error: "Não encontrado" }), { status: 404 });
  return new Response(JSON.stringify(slot), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const PUT: APIRoute = async ({ params, request }) => {
  const name = params.name;
  if (!name) return new Response(JSON.stringify({ error: "name em falta" }), { status: 400 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
  }
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Validação falhou", issues: parsed.error.issues }),
      { status: 400 },
    );
  }

  await db
    .update(schema.slots)
    .set({ blocks: parsed.data.blocks, updatedAt: new Date() })
    .where(eq(schema.slots.name, name));

  const [slot] = await db
    .select()
    .from(schema.slots)
    .where(eq(schema.slots.name, name))
    .limit(1);
  return new Response(JSON.stringify(slot), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
