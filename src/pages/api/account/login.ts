import type { APIRoute } from "astro";
import { z } from "zod";
import {
  loginCustomer,
  createCustomerToken,
  setCustomerCookie,
} from "../../../lib/customer-auth";

export const prerender = false;

const Schema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
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
      JSON.stringify({ error: "Dados inválidos." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const session = await loginCustomer(parsed.data.email, parsed.data.password);
  if (!session) {
    return new Response(
      JSON.stringify({ error: "Email ou password incorretos." }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const token = await createCustomerToken(session);
  setCustomerCookie(cookies, token);

  return new Response(
    JSON.stringify({ success: true, customer: session }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
};
