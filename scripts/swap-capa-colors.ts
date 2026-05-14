// scripts/swap-capa-colors.ts
//
// One-off data fix for ONE product — Capa de Telemóvel (capa-telemovel-drisclub).
// SWAPS its two colour lists:
//   "Cor do produto" (product_variant_colors)  <->  "Cor da estampa" (product_colors)
// Each colour keeps its exact name + hex; only which section it lives in changes.
// No other product is touched.
//
// Colours are read LIVE from the DB at run time — never hard-coded.
//
// Dry-run (default — prints before→after for both lists, writes nothing):
//   railway run npx tsx scripts/swap-capa-colors.ts
// Apply (delete + reinsert both lists for Capa, one transaction):
//   railway run npx tsx scripts/swap-capa-colors.ts --apply

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { asc, eq } from "drizzle-orm";
import * as schema from "../src/db/schema";

// Run locally via `railway run`: prefer the public proxy URL — DATABASE_URL
// points at Railway's internal host, only reachable inside Railway.
const url = process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não configurado");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");
const PRODUCT_SLUG = "capa-telemovel-drisclub";

const client = postgres(url, { max: 1, prepare: false });
const db = drizzle(client, { schema });

type Colour = { name: string; hex: string };

/** Variant colours = product_variant_colors; estampa colours = product_colors. */
async function readColours(
  productId: number,
  table: "variant" | "estampa",
): Promise<Colour[]> {
  const t =
    table === "variant" ? schema.productVariantColors : schema.productColors;
  const rows = await db
    .select()
    .from(t)
    .where(eq(t.productId, productId))
    .orderBy(asc(t.position));
  return rows.map((r) => ({ name: r.name, hex: r.hex }));
}

const fmt = (cs: Colour[]) =>
  cs.length === 0 ? "(vazio)" : cs.map((c) => `${c.name} ${c.hex}`).join(", ");

async function main() {
  console.log(
    APPLY
      ? ">>> MODO APPLY — vai ESCREVER na base de dados de produção <<<\n"
      : ">>> DRY-RUN — não escreve nada (corre com --apply para aplicar) <<<\n",
  );

  const rows = await db
    .select()
    .from(schema.products)
    .where(eq(schema.products.slug, PRODUCT_SLUG));
  if (rows.length === 0) throw new Error(`Produto não encontrado: ${PRODUCT_SLUG}`);
  if (rows.length > 1) {
    throw new Error(`Slug ambíguo (${rows.length}): ${PRODUCT_SLUG}`);
  }
  const product = rows[0];

  const variantBefore = await readColours(product.id, "variant"); // "Cor do produto"
  const estampaBefore = await readColours(product.id, "estampa"); // "Cor da estampa"

  console.log(`Produto: #${product.id} [${product.slug}] ${product.name}\n`);
  console.log(`  "Cor do produto" (variante)  ANTES:  ${fmt(variantBefore)}`);
  console.log(`  "Cor do produto" (variante)  DEPOIS: ${fmt(estampaBefore)}\n`);
  console.log(`  "Cor da estampa"             ANTES:  ${fmt(estampaBefore)}`);
  console.log(`  "Cor da estampa"             DEPOIS: ${fmt(variantBefore)}\n`);

  if (variantBefore.length === 0 && estampaBefore.length === 0) {
    throw new Error("Ambas as listas estão vazias — nada para trocar. Abortado.");
  }

  if (!APPLY) {
    console.log(
      "DRY-RUN terminado. Nada foi escrito. Corre com --apply para aplicar.",
    );
    return;
  }

  // Apply — swap both lists for this product, in ONE transaction.
  await db.transaction(async (tx) => {
    await tx
      .delete(schema.productVariantColors)
      .where(eq(schema.productVariantColors.productId, product.id));
    await tx
      .delete(schema.productColors)
      .where(eq(schema.productColors.productId, product.id));

    // old "Cor da estampa" → product_variant_colors ("Cor do produto")
    if (estampaBefore.length > 0) {
      await tx.insert(schema.productVariantColors).values(
        estampaBefore.map((c, i) => ({
          productId: product.id,
          name: c.name,
          hex: c.hex,
          position: i,
        })),
      );
    }
    // old "Cor do produto" → product_colors ("Cor da estampa")
    if (variantBefore.length > 0) {
      await tx.insert(schema.productColors).values(
        variantBefore.map((c, i) => ({
          productId: product.id,
          name: c.name,
          hex: c.hex,
          position: i,
        })),
      );
    }
  });

  console.log(
    `\n✔ Concluído. As duas listas de cores da "${product.name}" foram trocadas (numa só transação).`,
  );
}

main()
  .catch((err) => {
    console.error("Falha:", err);
    process.exit(1);
  })
  .finally(async () => {
    await client.end();
  });
