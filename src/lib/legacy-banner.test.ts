import { describe, it, expect } from "vitest";
import { escapeHtml, hashContentSync, hashContentAsync } from "./legacy-banner";

describe("escapeHtml", () => {
  it("escapes < and >", () => {
    expect(escapeHtml("a<b>c</b>")).toBe("a&lt;b&gt;c&lt;/b&gt;");
  });

  it("escapes &", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it('escapes " and \'', () => {
    expect(escapeHtml(`he said "hi" it's`)).toBe("he said &quot;hi&quot; it&#39;s");
  });

  it("returns empty string for empty input", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("preserves plain text", () => {
    expect(escapeHtml("Frete grátis em encomendas ≥ 20€")).toBe(
      "Frete grátis em encomendas ≥ 20€",
    );
  });
});

describe("hashContentSync", () => {
  it("returns a 12-char base64url-safe string", () => {
    const h = hashContentSync("oi");
    expect(h).toHaveLength(12);
    expect(h).toMatch(/^[A-Za-z0-9_-]{12}$/);
  });

  it("is deterministic", () => {
    expect(hashContentSync("oi")).toBe(hashContentSync("oi"));
  });

  it("differs for different inputs", () => {
    expect(hashContentSync("a")).not.toBe(hashContentSync("b"));
  });

  // Snapshot: SHA-256("oi") base64url, first 12 chars.
  // Verified via: node -e 'console.log(require("crypto").createHash("sha256").update("oi").digest("base64url").slice(0, 12))'
  it("returns the known snapshot for input 'oi'", () => {
    expect(hashContentSync("oi")).toBe("h_YzY0zEsC9i");
  });
});

describe("hashContentAsync", () => {
  it("returns the same hash as hashContentSync for several inputs", async () => {
    for (const s of ["oi", "<p>x</p>", "Frete grátis ≥ €20", ""]) {
      expect(await hashContentAsync(s)).toBe(hashContentSync(s));
    }
  });
});
