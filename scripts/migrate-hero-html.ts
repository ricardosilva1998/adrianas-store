import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";

const url = process.env.DATABASE_URL ?? process.env.DATABASE_PUBLIC_URL;
if (!url) {
  console.error("DATABASE_URL não configurado");
  process.exit(1);
}

const client = postgres(url, { max: 1, prepare: false });
const db = drizzle(client, { schema });

function cleanHeroTitle(raw: string): { title: string; titleAccent: string } {
  if (!raw) return { title: "", titleAccent: "" };

  // Split on <br> variants (must come before tag stripping)
  const parts = raw.split(/<br\s*\/?\s*>/i);
  const first = parts[0] ?? "";
  const second = parts.slice(1).join(" ");

  const strip = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

  return {
    title: strip(first),
    titleAccent: strip(second),
  };
}

async function main() {
  console.log("A limpar HTML de blocos hero existentes...");

  const pages = await db.select().from(schema.pages);
  let changed = 0;

  for (const page of pages) {
    const publicBlocks = Array.isArray(page.blocks) ? [...(page.blocks as any[])] : [];
    const draftBlocks = Array.isArray(page.draftBlocks) ? [...(page.draftBlocks as any[])] : null;
    let pageChanged = false;

    const clean = (blocks: any[]): any[] =>
      blocks.map((b) => {
        if (b?.type !== "hero") return b;
        const needs = /<[^>]+>/.test(b.data?.title ?? "");
        if (!needs && b.data?.titleAccent !== undefined) return b;
        const { title, titleAccent } = cleanHeroTitle(b.data?.title ?? "");
        pageChanged = true;
        return {
          ...b,
          data: {
            title,
            titleAccent,
            subtitle: b.data?.subtitle ?? "",
            buttonText: b.data?.buttonText ?? "",
            buttonUrl: b.data?.buttonUrl ?? "",
            imageUrl: b.data?.imageUrl ?? "",
          },
        };
      });

    const newPublic = clean(publicBlocks);
    const newDraft = draftBlocks ? clean(draftBlocks) : null;

    if (pageChanged) {
      await db
        .update(schema.pages)
        .set({
          blocks: newPublic,
          draftBlocks: newDraft,
          updatedAt: new Date(),
        })
        .where(eq(schema.pages.slug, page.slug));
      console.log(`  OK: ${page.slug}`);
      changed += 1;
    }
  }

  console.log(`${changed} pagina(s) limpa(s).`);
}

main()
  .catch((err) => {
    console.error("Falha:", err);
    process.exit(1);
  })
  .finally(async () => {
    await client.end();
  });
