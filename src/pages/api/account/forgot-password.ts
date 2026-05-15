import type { APIRoute } from "astro";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "../../../db/client";
import { createResetToken } from "../../../lib/password-reset";
import { sendPasswordResetEmail } from "../../../lib/email";

export const prerender = false;

const Schema = z.object({
  email: z.string().email().max(200),
});

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  // Always respond 200 with a generic message — never confirm or deny
  // whether the email exists, to prevent account enumeration.
  const genericOk = new Response(
    JSON.stringify({
      success: true,
      message:
        "Se existir uma conta com esse email, vais receber um email com instruções para repor a palavra-passe.",
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );

  if (!parsed.success) return genericOk;

  const email = parsed.data.email.toLowerCase().trim();

  const [customer] = await db
    .select({
      id: schema.customers.id,
      email: schema.customers.email,
      name: schema.customers.name,
    })
    .from(schema.customers)
    .where(eq(schema.customers.email, email))
    .limit(1);

  if (!customer) {
    // Same generic response, but no token created / no email sent.
    return genericOk;
  }

  try {
    const token = await createResetToken(customer.id);
    const origin = new URL(request.url).origin;
    const resetUrl = `${origin}/conta/repor-password?token=${token}`;
    await sendPasswordResetEmail({
      name: customer.name,
      email: customer.email,
      resetUrl,
    });
  } catch (err) {
    // Log but still return the generic OK so the response is constant-time.
    console.error("[forgot-password] Falha:", err);
  }

  return genericOk;
};
