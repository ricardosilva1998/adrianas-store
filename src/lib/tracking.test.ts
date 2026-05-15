import { describe, it, expect } from "vitest";
import {
  shouldTrack,
  getClientIp,
  computeVisitorHash,
} from "./tracking";

function req(method: string, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/x", { method, headers });
}

describe("shouldTrack", () => {
  const html = { accept: "text/html" };

  it("counts homepage GET with text/html accept", () => {
    expect(shouldTrack(req("GET", html), new URL("http://x/"))).toBe(true);
  });

  it("counts product pages", () => {
    expect(
      shouldTrack(req("GET", html), new URL("http://x/catalogo/tote-bag")),
    ).toBe(true);
  });

  it("counts institutional pages", () => {
    for (const p of [
      "/sobre-nos",
      "/contactos",
      "/faq",
      "/envios-devolucoes",
      "/politica-privacidade",
      "/termos",
    ]) {
      expect(shouldTrack(req("GET", html), new URL(`http://x${p}`))).toBe(true);
    }
  });

  it("excludes catalog listing", () => {
    expect(shouldTrack(req("GET", html), new URL("http://x/catalogo"))).toBe(
      false,
    );
  });

  it("excludes catalog category", () => {
    expect(
      shouldTrack(req("GET", html), new URL("http://x/catalogo/categoria/totes")),
    ).toBe(false);
  });

  it("excludes admin", () => {
    expect(shouldTrack(req("GET", html), new URL("http://x/admin/orders"))).toBe(
      false,
    );
  });

  it("excludes api", () => {
    expect(shouldTrack(req("GET", html), new URL("http://x/api/products"))).toBe(
      false,
    );
  });

  it("excludes non-GET", () => {
    expect(shouldTrack(req("POST", html), new URL("http://x/"))).toBe(false);
  });

  it("excludes draft preview", () => {
    expect(
      shouldTrack(req("GET", html), new URL("http://x/?draft=1")),
    ).toBe(false);
  });

  it("excludes ?preview=token", () => {
    expect(
      shouldTrack(req("GET", html), new URL("http://x/?preview=abc")),
    ).toBe(false);
  });

  it("excludes bots", () => {
    expect(
      shouldTrack(
        req("GET", { ...html, "user-agent": "Googlebot/2.1" }),
        new URL("http://x/"),
      ),
    ).toBe(false);
  });

  it("excludes requests without text/html accept", () => {
    expect(
      shouldTrack(req("GET", { accept: "application/json" }), new URL("http://x/")),
    ).toBe(false);
  });
});

describe("getClientIp", () => {
  it("uses first IP from x-forwarded-for", () => {
    const h = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(getClientIp(h)).toBe("1.2.3.4");
  });

  it("trims whitespace", () => {
    const h = new Headers({ "x-forwarded-for": "  1.2.3.4 , 5.6.7.8" });
    expect(getClientIp(h)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    const h = new Headers({ "x-real-ip": "9.9.9.9" });
    expect(getClientIp(h)).toBe("9.9.9.9");
  });

  it("returns 'unknown' when nothing present", () => {
    expect(getClientIp(new Headers())).toBe("unknown");
  });
});

describe("computeVisitorHash", () => {
  const baseInput = {
    ip: "1.2.3.4",
    ua: "Mozilla/5.0",
    dateIso: "2026-05-15",
    secret: "test-secret",
  };

  it("is deterministic for same input", () => {
    const a = computeVisitorHash(baseInput);
    const b = computeVisitorHash(baseInput);
    expect(a).toBe(b);
  });

  it("returns 16-char string", () => {
    expect(computeVisitorHash(baseInput)).toHaveLength(16);
  });

  it("differs across days for same ip+ua", () => {
    const a = computeVisitorHash({ ...baseInput, dateIso: "2026-05-15" });
    const b = computeVisitorHash({ ...baseInput, dateIso: "2026-05-16" });
    expect(a).not.toBe(b);
  });

  it("differs across IPs same day", () => {
    const a = computeVisitorHash({ ...baseInput, ip: "1.1.1.1" });
    const b = computeVisitorHash({ ...baseInput, ip: "2.2.2.2" });
    expect(a).not.toBe(b);
  });

  it("differs across user agents same day", () => {
    const a = computeVisitorHash({ ...baseInput, ua: "A" });
    const b = computeVisitorHash({ ...baseInput, ua: "B" });
    expect(a).not.toBe(b);
  });
});
