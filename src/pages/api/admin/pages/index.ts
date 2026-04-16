import type { APIRoute } from "astro";
import { z } from "zod";
import { db, schema } from "../../../../db/client";
import { blocksArraySchema } from "../../../../lib/blocks";

export const prerender = false;

const CreateSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug invalido"),
  blocks: blocksArraySchema,
  published: z.boolean(),
});

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Dados invalidos", issues: parsed.error.format() }),
      { status: 400 },
    );
  }

  try {
    await db.insert(schema.pages).values({
      slug: parsed.data.slug,
      title: parsed.data.title,
      body: "",
      blocks: parsed.data.blocks,
      published: parsed.data.published,
      draftBlocks: null,
    });

    return new Response(JSON.stringify({ success: true, slug: parsed.data.slug }), { status: 201 });
  } catch (err: any) {
    if (err?.code === "23505") {
      return new Response(JSON.stringify({ error: "Ja existe uma pagina com este slug" }), { status: 409 });
    }
    console.error("[pages] Falha a criar:", err);
    return new Response(JSON.stringify({ error: "Erro ao criar" }), { status: 500 });
  }
};
