import type { APIRoute } from "astro";
import { uploadPersonalizationFile, r2Configured } from "../../lib/r2";

export const prerender = false;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
]);
const MAX_BYTES = 15 * 1024 * 1024;

export const POST: APIRoute = async ({ request }) => {
  if (!r2Configured) {
    return new Response(
      JSON.stringify({
        error: "Upload indisponível. Tenta novamente mais tarde ou contacta-nos.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return new Response(JSON.stringify({ error: "Pedido inválido" }), { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return new Response(JSON.stringify({ error: "Sem ficheiro" }), { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return new Response(
      JSON.stringify({
        error: `Tipo de ficheiro não suportado (${file.type || "desconhecido"}). Usa PNG, JPG ou PDF.`,
      }),
      { status: 415 },
    );
  }

  if (file.size > MAX_BYTES) {
    const mb = Math.round(MAX_BYTES / 1024 / 1024);
    return new Response(
      JSON.stringify({ error: `Ficheiro demasiado grande (máx ${mb}MB).` }),
      { status: 413 },
    );
  }

  // Extension/content-type cross-check — extension alone is not authoritative,
  // but a mismatch is a strong signal of a spoofed upload.
  const extMatch = /\.([a-zA-Z0-9]+)$/.exec(file.name);
  const ext = extMatch?.[1]?.toLowerCase() ?? "";
  const expectedByExt: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    pdf: "application/pdf",
  };
  if (ext && expectedByExt[ext] && expectedByExt[ext] !== file.type) {
    return new Response(
      JSON.stringify({ error: "A extensão do ficheiro não corresponde ao tipo." }),
      { status: 415 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadPersonalizationFile(buffer, file.type, file.name);
    const kind = file.type === "application/pdf" ? "pdf" : "image";
    return new Response(
      JSON.stringify({ url, kind, name: file.name, size: file.size }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[personalization-upload] Falha:", err);
    return new Response(
      JSON.stringify({ error: "Erro no upload. Tenta novamente." }),
      { status: 500 },
    );
  }
};
