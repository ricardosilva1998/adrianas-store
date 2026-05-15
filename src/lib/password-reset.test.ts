import { describe, it, expect } from "vitest";
import { generateResetToken, hashToken } from "./password-reset";

describe("generateResetToken", () => {
  it("returns a 64-char lowercase hex string", () => {
    const t = generateResetToken();
    expect(t).toHaveLength(64);
    expect(t).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces different tokens on subsequent calls", () => {
    const a = generateResetToken();
    const b = generateResetToken();
    expect(a).not.toBe(b);
  });
});

describe("hashToken", () => {
  it("returns a 64-char hex SHA-256 digest", () => {
    const h = hashToken("foo");
    expect(h).toHaveLength(64);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic", () => {
    expect(hashToken("oi")).toBe(hashToken("oi"));
  });

  it("differs for different inputs", () => {
    expect(hashToken("a")).not.toBe(hashToken("b"));
  });

  // Snapshot: SHA-256("oi") hex. Verified via:
  // node -e 'console.log(require("crypto").createHash("sha256").update("oi").digest("hex"))'
  it("returns the known snapshot for 'oi'", () => {
    expect(hashToken("oi")).toBe(
      "87f633634cc4b02f628685651f0a29b7bfa22a0bd841f725c6772dd00a58d489",
    );
  });
});
