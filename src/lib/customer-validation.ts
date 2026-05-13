// Shared validators for the customer-facing forms (checkout + account).
// Used by both Zod schemas (server) and React islands (client) so error
// messaging stays consistent.

/** Strip everything that is not a digit. */
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * Portuguese phone number: exactly 9 digits.
 *
 * Accepts any prefix used by mainland operators today — landline (2x),
 * mobile (9x) — since CTT may call either one. Country-code prefixes
 * ("+351 / 00351") are stripped if the resulting number still has the
 * expected 9 digits.
 */
export function isValidPtPhone(raw: string): boolean {
  let n = normalizePhone(raw);
  if (n.startsWith("00351")) n = n.slice(5);
  else if (n.startsWith("351") && n.length === 12) n = n.slice(3);
  if (n.length !== 9) return false;
  const first = n[0];
  return first === "2" || first === "9";
}

export function isValidName(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed.length < 2 || trimmed.length > 200) return false;
  // Reject digit-only or symbol-only inputs (names need at least one letter).
  return /\p{L}/u.test(trimmed);
}

export function isValidAddress(raw: string): boolean {
  const trimmed = raw.trim();
  return trimmed.length >= 5 && trimmed.length <= 500;
}
