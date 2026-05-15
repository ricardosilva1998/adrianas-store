import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";
import { legacyBannerMigration, hashContentSync } from "../src/lib/legacy-banner";

const url = process.env.DATABASE_URL ?? process.env.DATABASE_PUBLIC_URL;
if (!url) {
  console.error("DATABASE_URL não configurado");
  process.exit(1);
}

const client = postgres(url, { max: 1, prepare: false });
const db = drizzle(client, { schema });

async function main() {
  console.log("A inspeccionar shape do banner em site_config...");
  const [row] = await db
    .select()
    .from(schema.siteConfig)
    .where(eq(schema.siteConfig.id, 1));

  if (!row) {
    console.log("site_config singleton ausente; nada a migrar.");
    return;
  }

  const globals = row.globals as Record<string, unknown>;
  const banner = globals?.banner as Record<string, unknown> | undefined;

  if (!banner) {
    console.log("globals.banner ausente; nada a migrar.");
    return;
  }

  if (typeof banner.contentHtml === "string") {
    console.log("Shape novo já em uso (contentHtml presente). Skip.");
    return;
  }

  if (typeof banner.text !== "string") {
    console.log(
      "Shape inesperado (sem 'text' nem 'contentHtml'). Aborta para revisão manual.",
    );
    console.log("Conteúdo encontrado:", JSON.stringify(banner));
    return;
  }

  const migrated = legacyBannerMigration(banner);
  migrated.contentVersion = hashContentSync(migrated.contentHtml);

  const newGlobals = { ...globals, banner: migrated };

  await db
    .update(schema.siteConfig)
    .set({ globals: newGlobals, updatedAt: new Date() })
    .where(eq(schema.siteConfig.id, 1));

  console.log("OK — banner migrado:");
  console.log(JSON.stringify(migrated, null, 2));
}

main()
  .catch((err) => {
    console.error("Falha:", err);
    process.exit(1);
  })
  .finally(async () => {
    await client.end();
  });
