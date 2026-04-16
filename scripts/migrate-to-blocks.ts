import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import * as schema from "../src/db/schema";

const url = process.env.DATABASE_URL ?? process.env.DATABASE_PUBLIC_URL;
if (!url) {
  console.error("DATABASE_URL nao configurado");
  process.exit(1);
}

const client = postgres(url, { max: 1, prepare: false });
const db = drizzle(client, { schema });

const main = async () => {
  try {
    // 1. Convert existing pages (body markdown -> text block)
    console.log("Converting existing pages to blocks...");
    const existingPages = await db.select().from(schema.pages);

    for (const page of existingPages) {
      if (page.slug === "home") {
        console.log(`  · ${page.slug} (homepage, skip)`);
        continue;
      }

      const blocks = (page.blocks as any[]) ?? [];
      if (blocks.length > 0) {
        console.log(`  · ${page.slug} (already has blocks, skip)`);
        continue;
      }

      if (page.body && page.body.trim()) {
        const textBlock = {
          id: nanoid(10),
          type: "text",
          data: { markdown: page.body },
        };

        await db
          .update(schema.pages)
          .set({ blocks: [textBlock] })
          .where(eq(schema.pages.slug, page.slug));

        console.log(`  ✔ ${page.slug} (converted body to text block)`);
      } else {
        console.log(`  · ${page.slug} (empty body, skip)`);
      }
    }

    // 2. Create homepage if it doesn't exist
    const [existingHome] = await db
      .select()
      .from(schema.pages)
      .where(eq(schema.pages.slug, "home"))
      .limit(1);

    if (existingHome) {
      console.log("  · home (already exists, skip)");
    } else {
      console.log("Creating homepage...");

      const homeBlocks = [
        {
          id: nanoid(10),
          type: "hero",
          data: {
            title: 'Pecas unicas,<br /><span class="text-rosa-500">feitas para ti.</span>',
            subtitle:
              "Pecas personalizadas com carinho. T-shirts, tote bags, bolsas e acessorios personalizados a mao no nosso atelier em Portugal.",
            buttonText: "Ver catalogo",
            buttonUrl: "/catalogo",
            imageUrl: "",
          },
        },
        {
          id: nanoid(10),
          type: "product-grid",
          data: {
            title: "Mais vendidos",
            subtitle:
              "As pecas que os nossos clientes mais pedem. T-shirts, tote bags e bolsas personalizadas com carinho.",
            filter: "bestsellers",
          },
        },
        {
          id: nanoid(10),
          type: "category-grid",
          data: {
            title: "Categorias em destaque",
            subtitle: "Encontra a peca ideal para personalizar ou oferecer.",
            categories: ["tote-bags", "t-shirts", "necessaire", "frascos-vidro"],
          },
        },
        {
          id: nanoid(10),
          type: "cta-banner",
          data: {
            title: "A tua frase, o teu doodle, a tua peca.",
            subtitle:
              "Em cada produto podes escrever uma frase ate 100 caracteres, escolher as cores e descrever o desenho que queres estampado. Nos fazemos o resto a mao.",
            buttonText: "Ver como encomendar",
            buttonUrl: "/como-encomendar",
            bgColor: "ink",
          },
        },
      ];

      await db.insert(schema.pages).values({
        slug: "home",
        title: "Homepage",
        body: "",
        blocks: homeBlocks,
        published: true,
      });

      console.log("  ✔ home (created with 4 blocks)");
    }

    console.log("✅ Migracao concluida.");
  } finally {
    await client.end();
  }
};

main().catch((err) => {
  console.error("❌ Migracao falhou:", err);
  process.exit(1);
});
