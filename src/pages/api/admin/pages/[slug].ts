import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../../../../db/client";
import { blocksArraySchema } from "../../../../lib/blocks";

export const prerender = false;

const UpdateSchema = z.object({
  title: z.string().min(1).max(200),
  blocks: blocksArraySchema,
  published: z.boolean(),
  saveAsDraft: z.boolean().optional().default(false),
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
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Dados invalidos", issues: parsed.error.format() }),
      { status: 400 },
    );
  }

  try {
    const updates: Record<string, unknown> = {
      title: parsed.data.title,
      published: parsed.data.published,
      updatedAt: new Date(),
    };

    if (parsed.data.saveAsDraft) {
      // Save as draft: write blocks into draft_blocks, leave live blocks unchanged
      updates.draftBlocks = parsed.data.blocks;
    } else {
      // Publish: write blocks into live column, clear any pending draft
      updates.blocks = parsed.data.blocks;
      updates.draftBlocks = null;
    }

    await db
      .update(schema.pages)
      .set(updates)
      .where(eq(schema.pages.slug, slug));

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error("[pages] Falha a atualizar:", err);
    return new Response(JSON.stringify({ error: "Erro ao guardar" }), { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const slug = params.slug;
  if (!slug) {
    return new Response(JSON.stringify({ error: "Slug em falta" }), { status: 400 });
  }

  if (slug === "home") {
    return new Response(JSON.stringify({ error: "Nao podes apagar a homepage" }), { status: 400 });
  }

  try {
    await db.delete(schema.pages).where(eq(schema.pages.slug, slug));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error("[pages] Falha a apagar:", err);
    return new Response(JSON.stringify({ error: "Erro ao apagar" }), { status: 500 });
  }
};
