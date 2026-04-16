import type { APIRoute } from "astro";
import { eq, and, ne } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../../../../db/client";
import { blocksArraySchema } from "../../../../lib/blocks";

export const prerender = false;

const UpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  blocks: blocksArraySchema.optional(),
  active: z.boolean().optional(),
});

export const GET: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return new Response(JSON.stringify({ error: "ID inválido" }), { status: 400 });
  }

  const [row] = await db
    .select()
    .from(schema.templates)
    .where(eq(schema.templates.id, id))
    .limit(1);

  if (!row) {
    return new Response(JSON.stringify({ error: "Não encontrado" }), { status: 404 });
  }

  return new Response(JSON.stringify(row), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const PUT: APIRoute = async ({ params, request }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return new Response(JSON.stringify({ error: "ID inválido" }), { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
  }

  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Validação falhou", issues: parsed.error.issues }),
      { status: 400 },
    );
  }

  // If activating, ensure no other template of the same kind is active.
  if (parsed.data.active === true) {
    const [self] = await db
      .select({ kind: schema.templates.kind })
      .from(schema.templates)
      .where(eq(schema.templates.id, id))
      .limit(1);
    if (!self) {
      return new Response(JSON.stringify({ error: "Não encontrado" }), { status: 404 });
    }
    await db
      .update(schema.templates)
      .set({ active: false, updatedAt: new Date() })
      .where(and(eq(schema.templates.kind, self.kind), ne(schema.templates.id, id)));
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.blocks !== undefined) updates.blocks = parsed.data.blocks;
  if (parsed.data.active !== undefined) updates.active = parsed.data.active;

  await db
    .update(schema.templates)
    .set(updates)
    .where(eq(schema.templates.id, id));

  const [row] = await db
    .select()
    .from(schema.templates)
    .where(eq(schema.templates.id, id))
    .limit(1);

  return new Response(JSON.stringify(row), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const DELETE: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return new Response(JSON.stringify({ error: "ID inválido" }), { status: 400 });
  }

  await db.delete(schema.templates).where(eq(schema.templates.id, id));
  return new Response(null, { status: 204 });
};
