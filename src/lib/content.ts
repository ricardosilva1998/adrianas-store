import { marked } from "marked";
import { sanitizeHtml } from "./sanitize";

const HTML_TAG_RE = /<(p|h[1-6]|ul|ol|li|strong|em|b|i|u|s|span|div|br|blockquote|a|hr|pre|code)[\s>/]/i;

export function renderBlockContent({
  html,
  markdown,
}: {
  html?: string;
  markdown?: string;
}): string {
  const explicitHtml = (html ?? "").trim();
  if (explicitHtml) return sanitizeHtml(html as string);
  const md = (markdown ?? "").trim();
  if (!md) return "";
  const parsed = marked.parse(markdown as string, { async: false }) as string;
  return sanitizeHtml(parsed);
}

export function renderMixedContent(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (HTML_TAG_RE.test(trimmed)) return sanitizeHtml(raw);
  const parsed = marked.parse(raw, { async: false }) as string;
  return sanitizeHtml(parsed);
}
