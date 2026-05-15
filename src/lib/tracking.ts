import { createHash } from "node:crypto";

const TRACKED_PATTERNS: ReadonlyArray<RegExp> = [
  /^\/$/,
  /^\/catalogo\/[^/]+$/,
  /^\/(sobre-nos|contactos|faq|envios-devolucoes|politica-privacidade|termos)$/,
];

const BOT_UA_RE =
  /bot|crawler|spider|preview|monitor|lighthouse|headlesschrome/i;

export function shouldTrack(request: Request, url: URL): boolean {
  if (request.method !== "GET") return false;

  const accept = request.headers.get("accept") ?? "";
  if (!accept.includes("text/html")) return false;

  if (url.searchParams.has("draft") || url.searchParams.has("preview")) {
    return false;
  }

  const ua = request.headers.get("user-agent") ?? "";
  if (BOT_UA_RE.test(ua)) return false;

  return TRACKED_PATTERNS.some((re) => re.test(url.pathname));
}

export function getClientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const xri = headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "unknown";
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function computeVisitorHash(input: {
  ip: string;
  ua: string;
  dateIso: string;
  secret: string;
}): string {
  const dailySalt = sha256(`${input.secret}:${input.dateIso}`);
  return sha256(`${dailySalt}:${input.ip}:${input.ua}`).slice(0, 16);
}

export async function recordPageView(input: {
  path: string;
  ip: string;
  ua: string;
}): Promise<void> {
  const secret = process.env.JWT_SECRET ?? "";
  if (!secret) {
    return;
  }
  const dateIso = new Date().toISOString().slice(0, 10);
  const visitorHash = computeVisitorHash({
    ip: input.ip,
    ua: input.ua,
    dateIso,
    secret,
  });
  // Lazy-import to keep pure helpers (and their tests) free of the db/client
  // module-load side-effects (which require DATABASE_URL).
  const { db, schema } = await import("../db/client");
  await db.insert(schema.pageViews).values({
    path: input.path,
    visitorHash,
  });
}
