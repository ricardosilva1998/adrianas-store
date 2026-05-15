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

export interface NewBannerShape {
  enabled: boolean;
  contentHtml: string;
  bgHex: string;
  textHex: string;
  dismissible: boolean;
  contentVersion: string;
}

export function legacyBannerMigration(input: unknown): NewBannerShape {
  const fallback: NewBannerShape = {
    enabled: false,
    contentHtml: "",
    bgHex: "#ED7396",
    textHex: "#FFFFFF",
    dismissible: true,
    contentVersion: EMPTY_CONTENT_VERSION,
  };

  if (!input || typeof input !== "object") return fallback;
  const b = input as Record<string, unknown>;

  if (typeof b.contentHtml === "string") {
    return {
      enabled: Boolean(b.enabled),
      contentHtml: b.contentHtml,
      bgHex: typeof b.bgHex === "string" ? b.bgHex : fallback.bgHex,
      textHex: typeof b.textHex === "string" ? b.textHex : fallback.textHex,
      dismissible: typeof b.dismissible === "boolean" ? b.dismissible : true,
      contentVersion:
        typeof b.contentVersion === "string" && b.contentVersion.length > 0
          ? b.contentVersion
          : hashContentSync(b.contentHtml),
    };
  }

  if (typeof b.text === "string") {
    const text = b.text;
    const linkUrl =
      typeof b.linkUrl === "string" && b.linkUrl.length > 0 ? b.linkUrl : null;
    const contentHtml = linkUrl
      ? `<p><a href="${escapeHtml(linkUrl)}">${escapeHtml(text)}</a></p>`
      : text
      ? `<p>${escapeHtml(text)}</p>`
      : "";
    const bgHex = b.bgColor === "ink" ? "#111111" : "#ED7396";
    return {
      enabled: Boolean(b.enabled),
      contentHtml,
      bgHex,
      textHex: "#FFFFFF",
      dismissible: typeof b.dismissible === "boolean" ? b.dismissible : true,
      contentVersion: hashContentSync(contentHtml),
    };
  }

  return fallback;
}
