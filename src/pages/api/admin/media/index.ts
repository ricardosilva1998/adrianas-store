import type { APIRoute } from "astro";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../../../../db/client";

export const prerender = false;

const CreateSchema = z.object({
  url: z.string().url("URL inválido"),
  alt: z.string().max(200).optional().default(""),
  tags: z.string().max(200).optional().default(""),
});

export const GET: APIRoute = async () => {
  const rows = await db
    .select()
    .from(schema.mediaLibrary)
    .orderBy(desc(schema.mediaLibrary.createdAt));
  return new Response(JSON.stringify(rows), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
  }
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Validação falhou", issues: parsed.error.issues }),
      { status: 400 },
    );
  }

  const [row] = await db
    .insert(schema.mediaLibrary)
    .values({
      url: parsed.data.url,
      alt: parsed.data.alt,
      tags: parsed.data.tags,
      isPlaceholder: false,
    })
    .returning();

  return new Response(JSON.stringify(row), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
