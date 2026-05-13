import type { APIRoute } from "astro";
import { lookupPostalCode } from "../../lib/postal-code";

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const code = url.searchParams.get("code");
  if (!code) {
    return new Response(JSON.stringify({ ok: false, reason: "format" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const result = await lookupPostalCode(code);
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
