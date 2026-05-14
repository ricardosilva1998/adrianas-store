// scripts/copy-estampa-colors.ts
//
// One-off data fix. Copies colours INTO the "Cor da estampa" (the
// product_colors table) of five target products, REPLACING whatever estampa
// colours each target currently has.
//
//   Capa de Telemóvel  — "Cor do produto" (product_variant_colors)
//       → estampa of: Frasco de Vidro, Garrafa de Água, Porta-Chaves
//   Bolsa Necessaire   — estampa colours (product_colors)
//       → estampa of: Tote Bag, T-Shirt
//
// Each target's "Cor do produto (variante)" (product_variant_colors) is NOT
// touched — so e.g. Porta-Chaves keeps its "Cor da argola" exactly as is.
//
// Source colours are read LIVE from the DB at run time — never hard-coded.
//
// Dry-run (default — prints before→after for every target, writes nothing):
//   railway run npx tsx scripts/copy-estampa-colors.ts
// Apply (deletes + inserts product_colors for the 5 targets, one transaction):
//   railway run npx tsx scripts/copy-estampa-colors.ts --apply

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

type SourceTable = "variant" | "estampa";

// destination is ALWAYS product_colors ("Cor da estampa"); mode is REPLACE.
const GROUPS: Array<{
  label: string;
  sourceSlug: string;
  sourceTable: SourceTable;
  targetSlugs: string[];
}> = [
  {
    label: 'Capa de Telemóvel — "Cor do produto" (variante)',
    sourceSlug: "capa-telemovel-drisclub",
    sourceTable: "variant",
    targetSlugs: [
      "frasco-vidro-drisclub",
      "garrafa-agua-vidro",
      "porta-chaves-personalizado",
    ],
  },
  {
    label: "Bolsa Necessaire — cores de estampa",
    sourceSlug: "necessaire-classica",
    sourceTable: "estampa",
    targetSlugs: ["tote-bag-drisclub", "t-shirt-drisclub"],
  },
];

const client = postgres(url, { max: 1, prepare: false });
const db = drizzle(client, { schema });

type Colour = { name: string; hex: string };

async function findProduct(slug: string) {
  const rows = await db
    .select()
    .from(schema.products)
    .where(eq(schema.products.slug, slug));
  if (rows.length === 0) throw new Error(`Produto não encontrado: ${slug}`);
  if (rows.length > 1) throw new Error(`Slug ambíguo (${rows.length}): ${slug}`);
  return rows[0];
}

/** Variant colours = product_variant_colors; estampa colours = product_colors. */
async function readColours(
  productId: number,
  table: SourceTable,
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

  // Resolve everything and build the full plan first (read-only).
  const plan: Array<{
    targetId: number;
    targetName: string;
    targetSlug: string;
    before: Colour[];
    after: Colour[];
  }> = [];

  for (const group of GROUPS) {
    const source = await findProduct(group.sourceSlug);
    const sourceColours = await readColours(source.id, group.sourceTable);
    console.log(`Fonte: #${source.id} [${source.slug}] ${source.name}`);
    console.log(`  ${group.label}`);
    console.log(`  → ${sourceColours.length} cor(es): ${fmt(sourceColours)}\n`);

    if (sourceColours.length === 0) {
      throw new Error(
        `A fonte "${group.sourceSlug}" não tem cores — nada para copiar. Abortado.`,
      );
    }

    for (const targetSlug of group.targetSlugs) {
      const target = await findProduct(targetSlug);
      const before = await readColours(target.id, "estampa");
      plan.push({
        targetId: target.id,
        targetName: target.name,
        targetSlug: target.slug,
        before,
        after: sourceColours,
      });
      console.log(`  Alvo: #${target.id} [${target.slug}] ${target.name}`);
      console.log(`     "Cor da estampa" ANTES:  ${fmt(before)}`);
      console.log(`     "Cor da estampa" DEPOIS: ${fmt(sourceColours)}`);
      console.log("");
    }
    console.log("");
  }

  if (!APPLY) {
    console.log(
      "DRY-RUN terminado. Nada foi escrito. Corre com --apply para aplicar.",
    );
    return;
  }

  // Apply — all 5 targets in ONE transaction (all-or-nothing).
  await db.transaction(async (tx) => {
    for (const item of plan) {
      await tx
        .delete(schema.productColors)
        .where(eq(schema.productColors.productId, item.targetId));
      await tx.insert(schema.productColors).values(
        item.after.map((c, i) => ({
          productId: item.targetId,
          name: c.name,
          hex: c.hex,
          position: i,
        })),
      );
      console.log(
        `  ✔ ${item.targetSlug} — ${item.after.length} cor(es) de estampa aplicada(s)`,
      );
    }
  });

  console.log("\n✔ Concluído. Os 5 alvos foram atualizados numa só transação.");
}

main()
  .catch((err) => {
    console.error("Falha:", err);
    process.exit(1);
  })
  .finally(async () => {
    await client.end();
  });
