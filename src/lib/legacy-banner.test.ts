import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  hashContentSync,
  hashContentAsync,
  legacyBannerMigration,
} from "./legacy-banner";
import { globalsSchema } from "./config";

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

describe("legacyBannerMigration", () => {
  it("preserves an already-new shape unchanged", () => {
    const input = {
      enabled: true,
      contentHtml: "<p>oi</p>",
      bgHex: "#ED7396",
      textHex: "#FFFFFF",
      dismissible: true,
      contentVersion: "abc123def456",
    };
    expect(legacyBannerMigration(input)).toEqual(input);
  });

  it("recomputes contentVersion if missing on new shape", () => {
    const out = legacyBannerMigration({
      enabled: true,
      contentHtml: "<p>oi</p>",
      bgHex: "#ED7396",
      textHex: "#FFFFFF",
      dismissible: true,
    });
    expect(out.contentVersion).toBe(hashContentSync("<p>oi</p>"));
  });

  it("migrates legacy rosa + no link", () => {
    const out = legacyBannerMigration({
      enabled: true,
      text: "Frete grátis ≥ 20€",
      linkUrl: null,
      bgColor: "rosa",
      dismissible: true,
    });
    expect(out.contentHtml).toBe("<p>Frete grátis ≥ 20€</p>");
    expect(out.bgHex).toBe("#ED7396");
    expect(out.textHex).toBe("#FFFFFF");
    expect(out.enabled).toBe(true);
    expect(out.dismissible).toBe(true);
    expect(out.contentVersion).toBe(hashContentSync("<p>Frete grátis ≥ 20€</p>"));
  });

  it("migrates legacy ink + linkUrl set", () => {
    const out = legacyBannerMigration({
      enabled: false,
      text: "Ver coleção",
      linkUrl: "/catalogo",
      bgColor: "ink",
      dismissible: false,
    });
    expect(out.contentHtml).toBe('<p><a href="/catalogo">Ver coleção</a></p>');
    expect(out.bgHex).toBe("#111111");
    expect(out.textHex).toBe("#FFFFFF");
    expect(out.enabled).toBe(false);
    expect(out.dismissible).toBe(false);
  });

  it("escapes HTML in legacy text", () => {
    const out = legacyBannerMigration({
      enabled: true,
      text: 'Promo <script>alert("x")</script>',
      linkUrl: null,
      bgColor: "rosa",
      dismissible: true,
    });
    expect(out.contentHtml).toBe(
      "<p>Promo &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</p>",
    );
  });

  it("handles linkUrl set to empty string as no link", () => {
    const out = legacyBannerMigration({
      enabled: true,
      text: "olá",
      linkUrl: "",
      bgColor: "rosa",
      dismissible: true,
    });
    expect(out.contentHtml).toBe("<p>olá</p>");
  });

  it("escapes linkUrl in href", () => {
    const out = legacyBannerMigration({
      enabled: true,
      text: "x",
      linkUrl: '/a"><script>x</script>',
      bgColor: "rosa",
      dismissible: true,
    });
    expect(out.contentHtml).not.toContain("<script>");
    expect(out.contentHtml).toContain("&quot;");
  });

  it("falls back to defaults when input is null", () => {
    const out = legacyBannerMigration(null);
    expect(out.enabled).toBe(false);
    expect(out.contentHtml).toBe("");
    expect(out.bgHex).toBe("#ED7396");
    expect(out.textHex).toBe("#FFFFFF");
    expect(out.dismissible).toBe(true);
    expect(out.contentVersion).toBe(hashContentSync(""));
  });

  it("falls back to defaults when input is empty object", () => {
    const out = legacyBannerMigration({});
    expect(out.contentHtml).toBe("");
    expect(out.enabled).toBe(false);
  });
});

describe("globalsSchema accepts the new banner shape", () => {
  const baseGlobals = {
    identity: {
      name: "x",
      tagline: "y",
      description: "z",
      email: "a@b.com",
      whatsapp: "+351 9",
      instagram: "@x",
      shippingProvider: "CTT",
      preparationDays: "3 dias",
    },
    nav: [{ href: "/", label: "x" }],
    footer: { columns: [], bottomText: "x" },
    payments: [{ id: "mbway" as const, label: "MB Way", instructions: "x" }],
    notifyEmails: [],
  };

  it("accepts the new banner shape directly", () => {
    const parsed = globalsSchema.parse({
      ...baseGlobals,
      banner: {
        enabled: true,
        contentHtml: "<p>oi</p>",
        bgHex: "#FF0000",
        textHex: "#FFFFFF",
        dismissible: true,
        contentVersion: "abc123def456",
      },
    });
    expect(parsed.banner.contentHtml).toBe("<p>oi</p>");
    expect(parsed.banner.bgHex).toBe("#FF0000");
  });

  it("accepts legacy shape after legacyBannerMigration converts it", () => {
    const migrated = legacyBannerMigration({
      enabled: true,
      text: "Frete grátis",
      linkUrl: null,
      bgColor: "rosa",
      dismissible: true,
    });
    const parsed = globalsSchema.parse({ ...baseGlobals, banner: migrated });
    expect(parsed.banner.contentHtml).toBe("<p>Frete grátis</p>");
    expect(parsed.banner.bgHex).toBe("#ED7396");
    expect(parsed.banner.textHex).toBe("#FFFFFF");
    expect(parsed.banner.contentVersion).toHaveLength(12);
  });

  it("rejects invalid hex in bgHex", () => {
    expect(() =>
      globalsSchema.parse({
        ...baseGlobals,
        banner: {
          enabled: true,
          contentHtml: "<p>x</p>",
          bgHex: "rosa",
          textHex: "#FFFFFF",
          dismissible: true,
          contentVersion: "abc123def456",
        },
      }),
    ).toThrow();
  });
});
