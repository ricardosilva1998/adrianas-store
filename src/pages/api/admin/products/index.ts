import type { APIRoute } from "astro";
import { z } from "zod";
import { db, schema } from "../../../../db/client";

export const prerender = false;

const ProductSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  longDescription: z.string().default(""),
  priceCents: z.number().int().nonnegative(),
  category: z.enum([
    "tote-bags",
    "t-shirts",
    "necessaire",
    "frascos-vidro",
    "porta-chaves",
    "capas-telemovel",
    "garrafas",
    "porta-joias",
  ]),
  stock: z.number().int().nonnegative().default(0),
  unlimitedStock: z.boolean().default(false),
  bestseller: z.boolean().default(false),
  personalizable: z.boolean().default(true),
  showFromLabel: z.boolean().default(true),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  variantColorTitle: z.string().default("Cor do produto"),
  images: z
    .array(
      z.object({
        url: z.string(),
        alt: z.string().default(""),
        kind: z.enum(["image", "video"]).default("image"),
      }),
    )
    .default([]),
  colors: z
    .array(z.object({ name: z.string(), hex: z.string() }))
    .default([]),
  variantColors: z
    .array(z.object({ name: z.string(), hex: z.string() }))
    .default([]),
  shippingMethods: z
    .array(
      z.object({
        id: z.string().min(1).max(60),
        label: z.string().min(1).max(120),
        costCents: z.number().int().nonnegative(),
        description: z.string().max(2000).default(""),
      }),
    )
    .default([]),
});

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  const body = await request.json().catch(() => null);
  const parsed = ProductSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Dados inválidos", issues: parsed.error.format() }),
      { status: 400 },
    );
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [product] = await tx
        .insert(schema.products)
        .values({
          slug: parsed.data.slug,
          name: parsed.data.name,
          description: parsed.data.description,
          longDescription: parsed.data.longDescription,
          priceCents: parsed.data.priceCents,
          category: parsed.data.category,
          stock: parsed.data.stock,
          unlimitedStock: parsed.data.unlimitedStock,
          bestseller: parsed.data.bestseller,
          personalizable: parsed.data.personalizable,
          showFromLabel: parsed.data.showFromLabel,
          active: parsed.data.active,
          sortOrder: parsed.data.sortOrder,
          variantColorTitle: parsed.data.variantColorTitle,
          shippingMethods: parsed.data.shippingMethods,
        })
        .returning();

      if (parsed.data.images.length > 0) {
        await tx.insert(schema.productImages).values(
          parsed.data.images.map((img, i) => ({
            productId: product.id,
            url: img.url,
            alt: img.alt,
            position: i,
            kind: img.kind,
          })),
        );
      }

      if (parsed.data.colors.length > 0) {
        await tx.insert(schema.productColors).values(
          parsed.data.colors.map((c, i) => ({
            productId: product.id,
            name: c.name,
            hex: c.hex,
            position: i,
          })),
        );
      }

      if (parsed.data.variantColors.length > 0) {
        await tx.insert(schema.productVariantColors).values(
          parsed.data.variantColors.map((c, i) => ({
            productId: product.id,
            name: c.name,
            hex: c.hex,
            position: i,
          })),
        );
      }

      return product;
    });

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[products] Falha a criar produto:", err);
    return new Response(
      JSON.stringify({
        error:
          err instanceof Error && err.message.includes("unique")
            ? "Já existe um produto com este slug"
            : "Erro ao criar produto",
      }),
      { status: 500 },
    );
  }
};
