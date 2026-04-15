import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ?? process.env.DATABASE_PUBLIC_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL não configurado. Define a variável de ambiente (Postgres do Railway ou outra instância).",
  );
}

const globalForDb = globalThis as unknown as {
  __adrianaSql?: ReturnType<typeof postgres>;
};

const sql =
  globalForDb.__adrianaSql ??
  postgres(connectionString, {
    max: 10,
    prepare: false,
  });

if (!globalForDb.__adrianaSql) {
  globalForDb.__adrianaSql = sql;
}

export const db = drizzle(sql, { schema });
export { schema };
