import type { APIRoute } from "astro";
import { z } from "zod";
import { blocksArraySchema } from "../../../../../lib/blocks";
import {
  putPagePreview,
  upsertPagePreview,
  clearPagePreview,
} from "../../../../../lib/preview-store";

export const prerender = false;

const BodySchema = z.object({
  title: z.string().min(1).max(200),
  blocks: blocksArraySchema,
});

export const POST: APIRoute = async ({ params, request, locals }) => {
  if (!locals.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const slug = params.slug;
  if (!slug) return new Response(JSON.stringify({ error: "Slug em falta" }), { status: 400 });
  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return new Response(JSON.stringify({ error: "Dados invalidos" }), { status: 400 });
  const token = putPagePreview({ slug, title: parsed.data.title, blocks: parsed.data.blocks });
  return new Response(JSON.stringify({ token }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};

export const PUT: APIRoute = async ({ url, params, request, locals }) => {
  if (!locals.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const slug = params.slug;
  const token = url.searchParams.get("token");
  if (!slug || !token) return new Response(JSON.stringify({ error: "Parâmetros em falta" }), { status: 400 });
  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return new Response(JSON.stringify({ error: "Dados invalidos" }), { status: 400 });
  upsertPagePreview(token, { slug, title: parsed.data.title, blocks: parsed.data.blocks });
  return new Response(JSON.stringify({ success: true }), { status: 200 });
};

export const DELETE: APIRoute = async ({ url, locals }) => {
  if (!locals.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const token = url.searchParams.get("token");
  if (token) clearPagePreview(token);
  return new Response(null, { status: 204 });
};
