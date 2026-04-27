import type { APIRoute } from "astro";
import { z } from "zod";
import { db, schema } from "../../../../db/client";
import { eq } from "drizzle-orm";

export const prerender = false;

const UpdateSchema = z.object({
  description: z.string().max(200).optional(),
  percentOff: z.number().int().min(1).max(100).nullable().optional(),
  amountOffCents: z.number().int().min(1).nullable().optional(),
  minOrderCents: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
  validUntil: z.string().datetime().nullable().optional(),
  maxUses: z.number().int().min(1).nullable().optional(),
});

const parseId = (raw: string | undefined): number | null => {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401 });
  }
  const id = parseId(params.id);
  if (id == null) {
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
      JSON.stringify({ error: "Dados inválidos", issues: parsed.error.format() }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
  const d = parsed.data;
  if (d.percentOff != null && d.amountOffCents != null) {
    return new Response(
      JSON.stringify({ error: "Escolhe só percentagem OU valor fixo, não ambos." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (d.description !== undefined) updates.description = d.description;
  if (d.percentOff !== undefined) updates.percentOff = d.percentOff;
  if (d.amountOffCents !== undefined) updates.amountOffCents = d.amountOffCents;
  if (d.minOrderCents !== undefined) updates.minOrderCents = d.minOrderCents;
  if (d.active !== undefined) updates.active = d.active;
  if (d.validUntil !== undefined) {
    updates.validUntil = d.validUntil ? new Date(d.validUntil) : null;
  }
  if (d.maxUses !== undefined) updates.maxUses = d.maxUses;

  const [updated] = await db
    .update(schema.coupons)
    .set(updates)
    .where(eq(schema.coupons.id, id))
    .returning();

  if (!updated) {
    return new Response(JSON.stringify({ error: "Cupão não encontrado" }), { status: 404 });
  }
  return new Response(JSON.stringify({ coupon: updated }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401 });
  }
  const id = parseId(params.id);
  if (id == null) {
    return new Response(JSON.stringify({ error: "ID inválido" }), { status: 400 });
  }
  await db.delete(schema.coupons).where(eq(schema.coupons.id, id));
  return new Response(null, { status: 204 });
};
