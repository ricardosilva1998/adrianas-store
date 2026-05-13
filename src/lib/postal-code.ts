// Portuguese postal-code utilities.
//
// Format: 4 digits + "-" + 3 digits (e.g. "1100-100"). Existence is checked
// against geoapi.pt — a free public API that returns the locality given a
// "{CP4}-{CP3}" code. Results are cached in-process for 24h.

const FORMAT_RE = /^(\d{4})-(\d{3})$/;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const NEGATIVE_TTL_MS = 60 * 60 * 1000;

export type PostalLookup =
  | { ok: true; code: string; locality: string }
  | { ok: false; reason: "format" | "not-found" | "network"; code: string };

type CacheEntry =
  | { kind: "hit"; locality: string; expiresAt: number }
  | { kind: "miss"; expiresAt: number };

const cache = new Map<string, CacheEntry>();

/** Strip whitespace, accept "1100100" or "1100 100" or "1100-100". */
export function normalizePostalCode(raw: string): string | null {
  const cleaned = raw.replace(/\s+/g, "").trim();
  if (FORMAT_RE.test(cleaned)) return cleaned;
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length === 7) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return null;
}

export function isFormatValid(raw: string): boolean {
  return normalizePostalCode(raw) !== null;
}

async function fetchPostalLookup(code: string): Promise<PostalLookup> {
  try {
    const res = await fetch(`https://json.geoapi.pt/cp/${code}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (res.status === 404) {
      return { ok: false, reason: "not-found", code };
    }
    if (!res.ok) {
      return { ok: false, reason: "network", code };
    }
    const data = (await res.json()) as Record<string, unknown>;
    const locality =
      (typeof data.Designacao_Postal === "string" && data.Designacao_Postal) ||
      (typeof data.localidade === "string" && data.localidade) ||
      (typeof data.Concelho === "string" && data.Concelho) ||
      "";
    return { ok: true, code, locality: locality.toString() };
  } catch {
    // Soft-fail on network problems — caller decides whether to block.
    return { ok: false, reason: "network", code };
  }
}

export async function lookupPostalCode(raw: string): Promise<PostalLookup> {
  const code = normalizePostalCode(raw);
  if (!code) return { ok: false, reason: "format", code: raw };

  const cached = cache.get(code);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    if (cached.kind === "hit") {
      return { ok: true, code, locality: cached.locality };
    }
    return { ok: false, reason: "not-found", code };
  }

  const result = await fetchPostalLookup(code);
  if (result.ok) {
    cache.set(code, { kind: "hit", locality: result.locality, expiresAt: now + CACHE_TTL_MS });
  } else if (result.reason === "not-found") {
    cache.set(code, { kind: "miss", expiresAt: now + NEGATIVE_TTL_MS });
  }
  return result;
}

// Test helper — clears the cache between test cases.
export function __resetPostalCodeCache(): void {
  cache.clear();
}
