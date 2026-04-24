import { describe, it, expect } from "vitest";
import { normalizeSocialUrl } from "./icons";

describe("normalizeSocialUrl", () => {
  it("returns empty string for empty input", () => {
    expect(normalizeSocialUrl("email", "")).toBe("");
    expect(normalizeSocialUrl("email", "   ")).toBe("");
    expect(normalizeSocialUrl("instagram", "")).toBe("");
  });

  describe("email", () => {
    it("prepends mailto: when only the address is provided", () => {
      expect(normalizeSocialUrl("email", "ola@drisclub.com")).toBe("mailto:ola@drisclub.com");
    });

    it("keeps existing mailto: prefix", () => {
      expect(normalizeSocialUrl("email", "mailto:ola@drisclub.com")).toBe("mailto:ola@drisclub.com");
    });

    it("is case-insensitive on the mailto: scheme", () => {
      expect(normalizeSocialUrl("email", "MAILTO:ola@drisclub.com")).toBe("MAILTO:ola@drisclub.com");
    });

    it("trims whitespace", () => {
      expect(normalizeSocialUrl("email", "  ola@drisclub.com  ")).toBe("mailto:ola@drisclub.com");
    });

    it("rewrites tel: prefix to mailto:", () => {
      expect(normalizeSocialUrl("email", "tel:ola@drisclub.com")).toBe("mailto:ola@drisclub.com");
    });
  });

  describe("whatsapp", () => {
    it("converts bare phone numbers to wa.me links", () => {
      expect(normalizeSocialUrl("whatsapp", "+351 912 345 678")).toBe("https://wa.me/351912345678");
      expect(normalizeSocialUrl("whatsapp", "351912345678")).toBe("https://wa.me/351912345678");
    });

    it("keeps existing wa.me URLs as-is", () => {
      expect(normalizeSocialUrl("whatsapp", "https://wa.me/351912345678")).toBe("https://wa.me/351912345678");
    });

    it("keeps whatsapp: deep links", () => {
      expect(normalizeSocialUrl("whatsapp", "whatsapp://send?phone=351912345678")).toBe("whatsapp://send?phone=351912345678");
    });
  });

  describe("other social networks", () => {
    it("keeps absolute URLs unchanged", () => {
      expect(normalizeSocialUrl("instagram", "https://instagram.com/drisclub")).toBe("https://instagram.com/drisclub");
    });

    it("prepends https:// when a bare domain is entered", () => {
      expect(normalizeSocialUrl("instagram", "instagram.com/drisclub")).toBe("https://instagram.com/drisclub");
    });

    it("strips leading slashes before prepending https://", () => {
      expect(normalizeSocialUrl("facebook", "//facebook.com/drisclub")).toBe("https://facebook.com/drisclub");
    });
  });
});
