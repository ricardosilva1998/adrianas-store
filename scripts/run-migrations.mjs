import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const url = process.env.DATABASE_URL ?? process.env.DATABASE_PUBLIC_URL;
if (!url) {
  console.error("[migrate] DATABASE_URL não configurado");
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false });
const db = drizzle(sql);

try {
  console.log("[migrate] A correr migrations...");
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  console.log("[migrate] ✔ Migrations concluídas.");
} catch (err) {
  console.error("[migrate] Falha:", err);
  process.exit(1);
} finally {
  await sql.end();
}
