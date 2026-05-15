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

// Sync hash for server-side use (config-server preprocess, API endpoint,
// migration script). Client islands use hashContentAsync from ./banner-hash.ts.
export function hashContentSync(html: string): string {
  return createHash("sha256").update(html).digest("base64url").slice(0, 12);
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
