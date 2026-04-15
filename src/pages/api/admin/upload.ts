import type { APIRoute } from "astro";
import { uploadImage, r2Configured } from "../../../lib/r2";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  if (!r2Configured) {
    return new Response(
      JSON.stringify({
        error:
          "Cloudflare R2 não configurado. Define R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET e R2_PUBLIC_URL nas env vars. Alternativa: usa 'Adicionar URL' com uma imagem alojada externamente.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return new Response(JSON.stringify({ error: "Sem ficheiro" }), { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return new Response(
      JSON.stringify({ error: "Ficheiro demasiado grande (máx 5MB)" }),
      { status: 413 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadImage(buffer, file.type, file.name);
    return new Response(JSON.stringify({ url }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[upload] Falha:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Erro no upload",
      }),
      { status: 500 },
    );
  }
};
