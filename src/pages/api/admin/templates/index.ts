import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../../../../db/client";
import { blocksArraySchema } from "../../../../lib/blocks";

export const prerender = false;

const CreateSchema = z.object({
  kind: z.enum(["catalog", "product-detail"]),
  name: z.string().min(1).max(100),
  blocks: blocksArraySchema.default([]),
});

export const GET: APIRoute = async ({ url }) => {
  const kind = url.searchParams.get("kind");
  if (kind && kind !== "catalog" && kind !== "product-detail") {
    return new Response(JSON.stringify({ error: "kind inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rows = kind
    ? await db
        .select()
        .from(schema.templates)
        .where(eq(schema.templates.kind, kind as "catalog" | "product-detail"))
    : await db.select().from(schema.templates);

  return new Response(JSON.stringify(rows), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Validação falhou", issues: parsed.error.issues }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const [row] = await db
    .insert(schema.templates)
    .values({
      kind: parsed.data.kind,
      name: parsed.data.name,
      blocks: parsed.data.blocks,
      active: false,
    })
    .returning();

  return new Response(JSON.stringify(row), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
