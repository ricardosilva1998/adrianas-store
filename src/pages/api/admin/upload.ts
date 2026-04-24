import type { APIRoute } from "astro";
import { uploadMedia, r2Configured } from "../../../lib/r2";

export const prerender = false;

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

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

  const isImage = ALLOWED_IMAGE_TYPES.has(file.type);
  const isVideo = ALLOWED_VIDEO_TYPES.has(file.type);

  if (!isImage && !isVideo) {
    return new Response(
      JSON.stringify({
        error: `Tipo de ficheiro não suportado (${file.type || "desconhecido"}). Usa JPG/PNG/WEBP/GIF para imagens ou MP4/WebM/MOV para vídeos.`,
      }),
      { status: 415 },
    );
  }

  const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / 1024 / 1024);
    return new Response(
      JSON.stringify({ error: `Ficheiro demasiado grande (máx ${mb}MB)` }),
      { status: 413 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadMedia(buffer, file.type, file.name);
    const kind = isVideo ? "video" : "image";
    return new Response(JSON.stringify({ url, kind }), {
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
