import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull, gt } from "drizzle-orm";

// Lazy-import db so this module can be required by tests that exercise only
// the pure helpers (generateResetToken / hashToken) without a DB connection.
async function getDb() {
  const { db, schema } = await import("../db/client");
  return { db, schema };
}

// 32 random bytes → 64 hex chars. Roughly 256 bits of entropy — sufficient
// against online guessing and against offline cracking of stolen hashes.
export function generateResetToken(): string {
  return randomBytes(32).toString("hex");
}

// SHA-256(token) → 64 hex chars. We never store the plaintext token; it lives
// in the recipient's inbox and in the reset link they click. If the DB row
// leaks, the attacker still cannot reset passwords without the plaintext.
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const TOKEN_TTL_MS = 60 * 60 * 1000;

// Insert a new reset token row for a customer. Returns the plaintext token
// (to embed in the email link). The DB stores only the hash + expiry.
export async function createResetToken(customerId: number): Promise<string> {
  const token = generateResetToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  const { db, schema } = await getDb();
  await db.insert(schema.passwordResetTokens).values({
    customerId,
    tokenHash,
    expiresAt,
  });
  return token;
}

export interface ConsumeResult {
  customerId: number;
  rowId: number;
}

// Find a non-expired, non-used row matching the hashed token. Returns null
// if the token is unknown, expired, or already consumed. Caller is responsible
// for marking `used_at` after successfully updating the password (kept separate
// so the caller can wrap update + mark in a transaction).
export async function findActiveResetToken(token: string): Promise<ConsumeResult | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const now = new Date();
  const { db, schema } = await getDb();
  const [row] = await db
    .select({
      id: schema.passwordResetTokens.id,
      customerId: schema.passwordResetTokens.customerId,
    })
    .from(schema.passwordResetTokens)
    .where(
      and(
        eq(schema.passwordResetTokens.tokenHash, tokenHash),
        isNull(schema.passwordResetTokens.usedAt),
        gt(schema.passwordResetTokens.expiresAt, now),
      ),
    )
    .limit(1);
  return row ? { customerId: row.customerId, rowId: row.id } : null;
}

// Mark the token row consumed. Idempotent: re-calling on an already-used
// row is a no-op because the row is filtered out by findActiveResetToken on
// subsequent lookups.
export async function markResetTokenUsed(rowId: number): Promise<void> {
  const { db, schema } = await getDb();
  await db
    .update(schema.passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(schema.passwordResetTokens.id, rowId));
}
