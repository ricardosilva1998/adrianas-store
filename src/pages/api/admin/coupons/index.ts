import type { APIRoute } from "astro";
import { z } from "zod";
import { db, schema } from "../../../../db/client";
import { desc, sql as drizzleSql } from "drizzle-orm";

export const prerender = false;

const CreateSchema = z.object({
  code: z.string().min(2).max(60).regex(/^[A-Za-z0-9-_]+$/, "Apenas letras, números, hífen e _"),
  description: z.string().max(200).default(""),
  percentOff: z.number().int().min(1).max(100).nullable().optional(),
  amountOffCents: z.number().int().min(1).nullable().optional(),
  minOrderCents: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
  validUntil: z.string().datetime().nullable().optional(),
  maxUses: z.number().int().min(1).nullable().optional(),
});

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401 });
  }
  const rows = await db
    .select()
    .from(schema.coupons)
    .orderBy(desc(schema.coupons.createdAt));
  return new Response(JSON.stringify({ coupons: rows }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Dados inválidos", issues: parsed.error.format() }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
  const d = parsed.data;
  if (d.percentOff == null && d.amountOffCents == null) {
    return new Response(
      JSON.stringify({ error: "Define uma percentagem OU um valor fixo de desconto." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
  if (d.percentOff != null && d.amountOffCents != null) {
    return new Response(
      JSON.stringify({ error: "Escolhe só percentagem OU valor fixo, não ambos." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const code = d.code.trim().toUpperCase();
  const existing = await db
    .select({ id: schema.coupons.id })
    .from(schema.coupons)
    .where(drizzleSql`upper(${schema.coupons.code}) = ${code}`)
    .limit(1);
  if (existing.length > 0) {
    return new Response(JSON.stringify({ error: "Já existe um cupão com esse código." }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    });
  }

  const [created] = await db
    .insert(schema.coupons)
    .values({
      code,
      description: d.description,
      percentOff: d.percentOff ?? null,
      amountOffCents: d.amountOffCents ?? null,
      minOrderCents: d.minOrderCents,
      active: d.active,
      validUntil: d.validUntil ? new Date(d.validUntil) : null,
      maxUses: d.maxUses ?? null,
    })
    .returning();

  return new Response(JSON.stringify({ coupon: created }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
