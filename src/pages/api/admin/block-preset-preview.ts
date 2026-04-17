import type { APIRoute } from "astro";
import { z } from "zod";
import { BLOCK_TYPES, blockSchema } from "../../../lib/blocks";
import { putBlockPreview } from "../../../lib/preview-store";

export const prerender = false;

const BodySchema = z.object({
  type: z.string(),
  data: z.record(z.string(), z.unknown()),
});

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return new Response(JSON.stringify({ error: "Dados invalidos" }), { status: 400 });

  if (!BLOCK_TYPES.some((bt) => bt.type === parsed.data.type)) {
    return new Response(JSON.stringify({ error: "Tipo de bloco desconhecido" }), { status: 400 });
  }

  const check = blockSchema.safeParse({ id: "preview", type: parsed.data.type, data: parsed.data.data });
  if (!check.success) {
    return new Response(JSON.stringify({ error: "Dados invalidos para este tipo" }), { status: 400 });
  }

  const token = putBlockPreview({ type: parsed.data.type, data: parsed.data.data });
  return new Response(JSON.stringify({ token }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
