import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
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
});

export const PUT: APIRoute = async ({ request, params, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return new Response(JSON.stringify({ error: "ID inválido" }), { status: 400 });
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
    await db.transaction(async (tx) => {
      await tx
        .update(schema.products)
        .set({
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
          updatedAt: new Date(),
        })
        .where(eq(schema.products.id, id));

      await tx
        .delete(schema.productImages)
        .where(eq(schema.productImages.productId, id));
      if (parsed.data.images.length > 0) {
        await tx.insert(schema.productImages).values(
          parsed.data.images.map((img, i) => ({
            productId: id,
            url: img.url,
            alt: img.alt,
            position: i,
            kind: img.kind,
          })),
        );
      }

      await tx
        .delete(schema.productColors)
        .where(eq(schema.productColors.productId, id));
      if (parsed.data.colors.length > 0) {
        await tx.insert(schema.productColors).values(
          parsed.data.colors.map((c, i) => ({
            productId: id,
            name: c.name,
            hex: c.hex,
            position: i,
          })),
        );
      }

      await tx
        .delete(schema.productVariantColors)
        .where(eq(schema.productVariantColors.productId, id));
      if (parsed.data.variantColors.length > 0) {
        await tx.insert(schema.productVariantColors).values(
          parsed.data.variantColors.map((c, i) => ({
            productId: id,
            name: c.name,
            hex: c.hex,
            position: i,
          })),
        );
      }
    });

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error("[products] Falha a atualizar:", err);
    return new Response(
      JSON.stringify({ error: "Erro ao atualizar produto" }),
      { status: 500 },
    );
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return new Response(JSON.stringify({ error: "ID inválido" }), { status: 400 });
  }

  try {
    await db.delete(schema.products).where(eq(schema.products.id, id));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error("[products] Falha a apagar:", err);
    return new Response(
      JSON.stringify({ error: "Erro ao apagar produto" }),
      { status: 500 },
    );
  }
};
