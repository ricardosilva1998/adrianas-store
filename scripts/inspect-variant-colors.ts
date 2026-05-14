// scripts/inspect-variant-colors.ts
//
// READ-ONLY diagnostic. Prints every product with its variant-color title,
// its product_variant_colors ("Cor do produto") and its product_colors
// (personalisation palette), so the current state is visible before any
// copy operation. Writes nothing.
//
// Run with:  railway run npx tsx scripts/inspect-variant-colors.ts

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { asc, eq } from "drizzle-orm";
import * as schema from "../src/db/schema";

// Run locally via `railway run`: DATABASE_URL points at Railway's internal
// host (postgres.railway.internal), which only resolves inside Railway.
// Prefer the public proxy URL so the script is reachable from a laptop.
const url = process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não configurado");
  process.exit(1);
}

const client = postgres(url, { max: 1, prepare: false });
const db = drizzle(client, { schema });

async function main() {
  const products = await db
    .select()
    .from(schema.products)
    .orderBy(asc(schema.products.id));

  console.log(`${products.length} produto(s):\n`);

  for (const p of products) {
    console.log(
      `#${p.id}  [${p.slug}]  ${p.name}   (categoria: ${p.category}, ativo: ${p.active})`,
    );
    console.log(`   variantColorTitle: "${p.variantColorTitle}"`);

    const variantColors = await db
      .select()
      .from(schema.productVariantColors)
      .where(eq(schema.productVariantColors.productId, p.id))
      .orderBy(asc(schema.productVariantColors.position));

    if (variantColors.length === 0) {
      console.log("   product_variant_colors: (vazio)");
    } else {
      console.log(`   product_variant_colors (${variantColors.length}):`);
      for (const c of variantColors) {
        console.log(`      - "${c.name}"  ${c.hex}  (pos ${c.position})`);
      }
    }

    const personalisationColors = await db
      .select()
      .from(schema.productColors)
      .where(eq(schema.productColors.productId, p.id))
      .orderBy(asc(schema.productColors.position));

    if (personalisationColors.length === 0) {
      console.log("   product_colors: (vazio)");
    } else {
      console.log(`   product_colors (${personalisationColors.length}):`);
      for (const c of personalisationColors) {
        console.log(`      - "${c.name}"  ${c.hex}  (pos ${c.position})`);
      }
    }

    console.log("");
  }
}

main()
  .catch((err) => {
    console.error("Falha:", err);
    process.exit(1);
  })
  .finally(async () => {
    await client.end();
  });
