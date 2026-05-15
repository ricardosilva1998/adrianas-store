import DOMPurify from "isomorphic-dompurify";

// sanitizeHtml: tolerant allowlist for product descriptions and TextBlock content.
const ALLOWED_TAGS = [
  "p",
  "br",
  "span",
  "div",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "del",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
  "code",
  "a",
  "hr",
];

const ALLOWED_ATTR = ["href", "target", "rel", "style", "class"];

// sanitizeAnnouncement: tight allowlist for the announcement bar (one-line content).
const ALLOWED_TAGS_ANNOUNCEMENT = ["p", "br", "strong", "em", "u", "a", "span"];
const ALLOWED_ATTR_ANNOUNCEMENT = ["href", "target", "rel", "style"];

// Scope flag: the style hook only filters when called via sanitizeAnnouncement.
// 2026-05-15 audit found 30+ `style=` occurrences in production (products +
// page blocks) — all `color: rgb(...)`. Scoping keeps the hook defensive in
// case product descriptions ever pick up richer inline styles.
let sanitizingAnnouncement = false;
let hookRegistered = false;

const COLOR_ONLY_STYLE_RE =
  /^\s*color\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)|[a-zA-Z]+)\s*;?\s*$/;

function registerStyleHook() {
  if (hookRegistered) return;
  DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
    if (!sanitizingAnnouncement) return;
    if (data.attrName !== "style") return;
    const value = data.attrValue ?? "";
    if (!COLOR_ONLY_STYLE_RE.test(value)) {
      data.keepAttr = false;
    }
  });
  hookRegistered = true;
}

export function sanitizeHtml(input: string): string {
  if (!input) return "";
  registerStyleHook();
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    KEEP_CONTENT: true,
  });
}

export function sanitizeAnnouncement(input: string): string {
  if (!input) return "";
  registerStyleHook();
  sanitizingAnnouncement = true;
  try {
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: ALLOWED_TAGS_ANNOUNCEMENT,
      ALLOWED_ATTR: ALLOWED_ATTR_ANNOUNCEMENT,
      ALLOW_DATA_ATTR: false,
      KEEP_CONTENT: true,
      ALLOWED_URI_REGEXP: /^(https?:|mailto:|\/)/i,
    });
  } finally {
    sanitizingAnnouncement = false;
  }
}

export function isEmptyHtml(input: string): boolean {
  if (!input) return true;
  const stripped = input
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
  return stripped.length === 0;
}
