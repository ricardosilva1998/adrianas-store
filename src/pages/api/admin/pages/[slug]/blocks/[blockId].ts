import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../../../../../../db/client";
import type { Block } from "../../../../../../lib/blocks";
import { blocksArraySchema } from "../../../../../../lib/blocks";
import { replaceBlockData, removeBlockById } from "../../../../../../lib/page-blocks";

export const prerender = false;

async function loadEditableBlocks(slug: string): Promise<Block[] | null> {
  const [row] = await db.select().from(schema.pages).where(eq(schema.pages.slug, slug)).limit(1);
  if (!row) return null;
  const raw = (row.draftBlocks ?? row.blocks) as unknown;
  const parsed = blocksArraySchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}

async function writeDraft(slug: string, blocks: Block[]) {
  await db
    .update(schema.pages)
    .set({ draftBlocks: blocks, updatedAt: new Date() })
    .where(eq(schema.pages.slug, slug));
}

const PatchSchema = z.object({ data: z.record(z.string(), z.unknown()) });

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  if (!locals.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const { slug, blockId } = params;
  if (!slug || !blockId) return new Response(JSON.stringify({ error: "Parâmetros em falta" }), { status: 400 });

  const body = await request.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return new Response(JSON.stringify({ error: "Dados invalidos" }), { status: 400 });

  const blocks = await loadEditableBlocks(slug);
  if (blocks === null) return new Response(JSON.stringify({ error: "Pagina nao encontrada" }), { status: 404 });

  const out = replaceBlockData(blocks, blockId, parsed.data.data);
  if (!out.ok) return new Response(JSON.stringify({ error: "Bloco invalido ou inexistente" }), { status: 404 });

  await writeDraft(slug, out.blocks);
  return new Response(JSON.stringify({ success: true }), { status: 200 });
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!locals.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const { slug, blockId } = params;
  if (!slug || !blockId) return new Response(JSON.stringify({ error: "Parâmetros em falta" }), { status: 400 });

  const blocks = await loadEditableBlocks(slug);
  if (blocks === null) return new Response(JSON.stringify({ error: "Pagina nao encontrada" }), { status: 404 });

  const out = removeBlockById(blocks, blockId);
  if (!out.ok) return new Response(JSON.stringify({ error: "Bloco inexistente" }), { status: 404 });

  await writeDraft(slug, out.blocks);
  return new Response(JSON.stringify({ success: true }), { status: 200 });
};
