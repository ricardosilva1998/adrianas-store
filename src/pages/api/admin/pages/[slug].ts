import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../../../../db/client";

export const prerender = false;

const Schema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(50000),
});

export const PUT: APIRoute = async ({ params, request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const slug = params.slug;
  if (!slug) {
    return new Response(JSON.stringify({ error: "Slug em falta" }), { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Dados inválidos", issues: parsed.error.format() }),
      { status: 400 },
    );
  }

  try {
    await db
      .update(schema.pages)
      .set({
        title: parsed.data.title,
        body: parsed.data.body,
        updatedAt: new Date(),
      })
      .where(eq(schema.pages.slug, slug));

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error("[pages] Falha a atualizar:", err);
    return new Response(JSON.stringify({ error: "Erro ao guardar" }), {
      status: 500,
    });
  }
};
