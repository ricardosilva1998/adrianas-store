import type { APIRoute } from "astro";
import { desc, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../../../../db/client";
import { BLOCK_TYPES, blocksAllowedIn, blockSchema } from "../../../../lib/blocks";

export const prerender = false;

const CreateSchema = z.object({
  name: z.string().min(1).max(80),
  type: z.string(),
  data: z.record(z.string(), z.unknown()),
});

export const GET: APIRoute = async ({ url, locals }) => {
  if (!locals.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const ctx = url.searchParams.get("context") as "page" | "template-catalog" | "template-product-detail" | null;

  let rows;
  if (ctx) {
    const allowed = blocksAllowedIn(ctx).map((bt) => bt.type);
    rows = await db
      .select()
      .from(schema.blockPresets)
      .where(inArray(schema.blockPresets.type, allowed))
      .orderBy(desc(schema.blockPresets.createdAt));
  } else {
    rows = await db.select().from(schema.blockPresets).orderBy(desc(schema.blockPresets.createdAt));
  }

  return new Response(JSON.stringify(rows), { status: 200, headers: { "Content-Type": "application/json" } });
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return new Response(JSON.stringify({ error: "Dados invalidos" }), { status: 400 });

  if (!BLOCK_TYPES.some((bt) => bt.type === parsed.data.type)) {
    return new Response(JSON.stringify({ error: "Tipo de bloco desconhecido" }), { status: 400 });
  }

  const check = blockSchema.safeParse({ id: "preset", type: parsed.data.type, data: parsed.data.data });
  if (!check.success) {
    return new Response(JSON.stringify({ error: "Dados invalidos para este tipo" }), { status: 400 });
  }

  const [row] = await db
    .insert(schema.blockPresets)
    .values({
      name: parsed.data.name,
      type: parsed.data.type,
      data: parsed.data.data,
      createdByUserId: locals.user.id,
    })
    .returning();

  return new Response(JSON.stringify(row), { status: 201, headers: { "Content-Type": "application/json" } });
};
