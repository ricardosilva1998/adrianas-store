import type { APIRoute } from "astro";
import { siteConfigSchema } from "../../../../lib/config";
import { clearPreview, putPreview, upsertPreview } from "../../../../lib/preview-store";

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = siteConfigSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Validação falhou", issues: parsed.error.issues }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const token = putPreview(parsed.data);
  return new Response(JSON.stringify({ token }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

// PUT with ?token=... refreshes the same token with new config (used for
// every form edit so we don't churn through tokens).
export const PUT: APIRoute = async ({ request, url }) => {
  const token = url.searchParams.get("token");
  if (!token) {
    return new Response(JSON.stringify({ error: "token em falta" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = siteConfigSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Validação falhou", issues: parsed.error.issues }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  upsertPreview(token, parsed.data);
  return new Response(JSON.stringify({ token }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const DELETE: APIRoute = async ({ url }) => {
  const token = url.searchParams.get("token");
  if (token) clearPreview(token);
  return new Response(null, { status: 204 });
};
