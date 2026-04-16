import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../../../../../../db/client";
import { blocksArraySchema, type Block } from "../../../../../../lib/blocks";
import { reorderBlocks } from "../../../../../../lib/page-blocks";

export const prerender = false;

const BodySchema = z.object({ ids: z.array(z.string()).min(1) });

export const PUT: APIRoute = async ({ params, request, locals }) => {
  if (!locals.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const slug = params.slug;
  if (!slug) return new Response(JSON.stringify({ error: "Slug em falta" }), { status: 400 });
  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return new Response(JSON.stringify({ error: "Dados invalidos" }), { status: 400 });

  const [row] = await db.select().from(schema.pages).where(eq(schema.pages.slug, slug)).limit(1);
  if (!row) return new Response(JSON.stringify({ error: "Pagina nao encontrada" }), { status: 404 });

  const current = (row.draftBlocks ?? row.blocks) as unknown;
  const asArr = blocksArraySchema.safeParse(current);
  const baseBlocks: Block[] = asArr.success ? asArr.data : [];

  const out = reorderBlocks(baseBlocks, parsed.data.ids);
  if (!out.ok) return new Response(JSON.stringify({ error: "Sequência de ids invalida" }), { status: 400 });

  await db
    .update(schema.pages)
    .set({ draftBlocks: out.blocks, updatedAt: new Date() })
    .where(eq(schema.pages.slug, slug));

  return new Response(JSON.stringify({ success: true }), { status: 200 });
};
