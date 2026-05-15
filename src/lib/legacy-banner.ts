import { createHash } from "node:crypto";

export function escapeHtml(s: string): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Sync hash for server-side use (Zod preprocess, API endpoint, migration script).
export function hashContentSync(html: string): string {
  return createHash("sha256").update(html).digest("base64url").slice(0, 12);
}

// Async hash for client-side use (admin editor onChange).
// Uses Web Crypto API; result must equal hashContentSync for the same input.
export async function hashContentAsync(html: string): Promise<string> {
  const data = new TextEncoder().encode(html);
  const buf = await globalThis.crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(buf);
  let b64: string;
  if (typeof btoa === "function") {
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    b64 = btoa(bin);
  } else {
    b64 = Buffer.from(bytes).toString("base64");
  }
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "").slice(0, 12);
}

export const EMPTY_CONTENT_VERSION = hashContentSync("");
