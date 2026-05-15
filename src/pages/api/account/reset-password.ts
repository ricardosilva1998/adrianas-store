import type { APIRoute } from "astro";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "../../../db/client";
import { hashCustomerPassword } from "../../../lib/customer-auth";
import {
  findActiveResetToken,
  markResetTokenUsed,
} from "../../../lib/password-reset";

export const prerender = false;

const Schema = z.object({
  token: z.string().min(1).max(128),
  password: z.string().min(8).max(200),
});

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Palavra-passe deve ter pelo menos 8 caracteres." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const active = await findActiveResetToken(parsed.data.token);
  if (!active) {
    return new Response(
      JSON.stringify({
        error:
          "Link inválido ou expirado. Pede um novo email de reposição de palavra-passe.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const passwordHash = await hashCustomerPassword(parsed.data.password);

  await db
    .update(schema.customers)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(schema.customers.id, active.customerId));

  await markResetTokenUsed(active.rowId);

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
};
