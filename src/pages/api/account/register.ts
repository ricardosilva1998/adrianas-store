import type { APIRoute } from "astro";
import { z } from "zod";
import { db, schema } from "../../../db/client";
import { eq } from "drizzle-orm";
import {
  hashCustomerPassword,
  createCustomerToken,
  setCustomerCookie,
} from "../../../lib/customer-auth";
import { sendWelcomeEmail } from "../../../lib/email";

export const prerender = false;

const Schema = z.object({
  email: z.string().email().max(200),
  name: z.string().min(1).max(200),
  password: z.string().min(8).max(200),
});

export const POST: APIRoute = async ({ request, cookies }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Dados inválidos. Email válido, nome e password com 8+ caracteres." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const email = parsed.data.email.toLowerCase().trim();
  const name = parsed.data.name.trim();

  const [existing] = await db
    .select({ id: schema.customers.id })
    .from(schema.customers)
    .where(eq(schema.customers.email, email))
    .limit(1);
  if (existing) {
    return new Response(
      JSON.stringify({ error: "Já existe uma conta com este email. Faz login." }),
      { status: 409, headers: { "Content-Type": "application/json" } },
    );
  }

  const passwordHash = await hashCustomerPassword(parsed.data.password);
  const [created] = await db
    .insert(schema.customers)
    .values({ email, name, passwordHash })
    .returning({
      id: schema.customers.id,
      email: schema.customers.email,
      name: schema.customers.name,
    });

  const token = await createCustomerToken(created);
  setCustomerCookie(cookies, token);

  // Fire-and-forget: welcome email failures should never block account
  // creation. The email module swallows errors and logs internally.
  void sendWelcomeEmail({ name: created.name, email: created.email });

  return new Response(
    JSON.stringify({ success: true, customer: created }),
    { status: 201, headers: { "Content-Type": "application/json" } },
  );
};
