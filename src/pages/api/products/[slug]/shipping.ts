import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { db, schema } from "../../../../db/client";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const slug = params.slug;
  if (!slug) {
    return new Response(JSON.stringify({ error: "Slug em falta" }), { status: 400 });
  }
  const [row] = await db
    .select({ shippingMethods: schema.products.shippingMethods, active: schema.products.active })
    .from(schema.products)
    .where(eq(schema.products.slug, slug))
    .limit(1);
  if (!row || !row.active) {
    return new Response(JSON.stringify({ error: "Produto não encontrado" }), { status: 404 });
  }
  const methods = Array.isArray(row.shippingMethods) ? row.shippingMethods : [];
  return new Response(JSON.stringify({ slug, methods }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
