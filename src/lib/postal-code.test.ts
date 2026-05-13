import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  __resetPostalCodeCache,
  isFormatValid,
  lookupPostalCode,
  normalizePostalCode,
} from "./postal-code";

describe("normalizePostalCode", () => {
  it.each([
    ["1100-100", "1100-100"],
    ["1100100", "1100-100"],
    ["1100 100", "1100-100"],
    ["  1100-100  ", "1100-100"],
  ])("normalises %s → %s", (input, expected) => {
    expect(normalizePostalCode(input)).toBe(expected);
  });

  it.each(["abc", "1100", "11000-100", "1100-10", ""])("rejects %s", (n) => {
    expect(normalizePostalCode(n)).toBeNull();
    expect(isFormatValid(n)).toBe(false);
  });

  it("forgiving 7-digit normalisation (any dash placement)", () => {
    // "110-1000" has 7 digits → normalises to "1101-000". Existence is the
    // authoritative check, so we accept loose input and rely on the lookup
    // to flag genuinely non-existent codes.
    expect(normalizePostalCode("110-1000")).toBe("1101-000");
  });
});

describe("lookupPostalCode", () => {
  beforeEach(() => {
    __resetPostalCodeCache();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns format error before hitting the network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await lookupPostalCode("nope");
    expect(res).toEqual({ ok: false, reason: "format", code: "nope" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns ok + locality on 200", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ Designacao_Postal: "LISBOA" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const res = await lookupPostalCode("1100-100");
    expect(res).toEqual({ ok: true, code: "1100-100", locality: "LISBOA" });
  });

  it("returns not-found on 404", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("not found", { status: 404 }),
    );
    const res = await lookupPostalCode("0000-000");
    expect(res).toEqual({ ok: false, reason: "not-found", code: "0000-000" });
  });

  it("caches positive lookups (no second fetch)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ Designacao_Postal: "PORTO" }), { status: 200 }),
    );
    await lookupPostalCode("4000-001");
    await lookupPostalCode("4000-001");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("soft-fails on network error (no exception thrown)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("ECONNRESET"));
    const res = await lookupPostalCode("1200-200");
    expect(res).toEqual({ ok: false, reason: "network", code: "1200-200" });
  });
});
