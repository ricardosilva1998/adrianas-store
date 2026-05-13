import { describe, it, expect } from "vitest";
import {
  isValidAddress,
  isValidName,
  isValidPtPhone,
  normalizePhone,
} from "./customer-validation";

describe("isValidPtPhone", () => {
  it.each([
    "912345678",
    "212345678",
    "912 345 678",
    "+351 912 345 678",
    "00351 912 345 678",
    "351912345678",
  ])("accepts %s", (n) => {
    expect(isValidPtPhone(n)).toBe(true);
  });

  it.each([
    "",
    "12345",
    "12345678", // 8 digits
    "1234567890", // 10 digits
    "812345678", // starts with 8
    "abc",
  ])("rejects %s", (n) => {
    expect(isValidPtPhone(n)).toBe(false);
  });

  it("normalizePhone strips non-digits", () => {
    expect(normalizePhone("+351 912 345 678")).toBe("351912345678");
  });
});

describe("isValidName", () => {
  it("accepts normal names", () => {
    expect(isValidName("Maria Silva")).toBe(true);
    expect(isValidName("João")).toBe(true);
    expect(isValidName("Anne-Marie O'Connor")).toBe(true);
  });

  it("rejects empty / too short / digits-only", () => {
    expect(isValidName("")).toBe(false);
    expect(isValidName(" ")).toBe(false);
    expect(isValidName("A")).toBe(false);
    expect(isValidName("12345")).toBe(false);
    expect(isValidName("...")).toBe(false);
  });
});

describe("isValidAddress", () => {
  it("requires 5+ trimmed characters", () => {
    expect(isValidAddress("Rua das Flores, 12")).toBe(true);
    expect(isValidAddress("    ")).toBe(false);
    expect(isValidAddress("R 1")).toBe(false);
  });
});
