import type { APIRoute } from "astro";
import { z } from "zod";
import { validateCoupon } from "../../../lib/coupons";

export const prerender = false;

const Schema = z.object({
  code: z.string().min(1).max(60),
  subtotalCents: z.number().int().nonnegative(),
});

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "JSON inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ ok: false, error: "Dados inválidos" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const result = await validateCoupon(parsed.data.code, parsed.data.subtotalCents);
    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 400,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[coupons/validate]", err);
    return new Response(
      JSON.stringify({ ok: false, error: "Erro ao validar cupão." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
