import { describe, it, expect } from "vitest";
import { blockSchema, createBlock, instantiatePreset } from "./blocks";

describe("instantiatePreset", () => {
  it("returns a new block with a fresh nanoid id and deep-cloned data", () => {
    const preset = {
      type: "hero" as const,
      data: {
        title: "X",
        titleAccent: "",
        subtitle: "",
        buttonText: "",
        buttonUrl: "",
        imageUrl: "",
        items: [{ q: "hi" }],
      },
    };
    const a = instantiatePreset(preset);
    const b = instantiatePreset(preset);
    expect(a.id).not.toBe(b.id);
    expect(a.id).toHaveLength(10);
    expect(a.id).toMatch(/^[A-Za-z0-9_-]+$/); // nanoid alphabet
    expect(a.type).toBe("hero");
    expect(a.data).toEqual(preset.data);
    expect(a.data).not.toBe(preset.data); // not same reference
  });
});

describe("backward compat on existing blocks", () => {
  it("hero block parses without the new layout field and gets default image-right", () => {
    const old = { id: "h", type: "hero" as const, data: { title: "x", titleAccent: "", subtitle: "", buttonText: "", buttonUrl: "", imageUrl: "" } };
    const parsed = blockSchema.safeParse(old);
    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.type === "hero") {
      expect(parsed.data.data.layout).toBe("image-right");
    }
  });

  it("hero block parses without hideOnMobile and gets default false", () => {
    const old = { id: "h", type: "hero" as const, data: { title: "x", titleAccent: "", subtitle: "", buttonText: "", buttonUrl: "", imageUrl: "" } };
    const parsed = blockSchema.safeParse(old);
    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.type === "hero") {
      expect(parsed.data.data.hideOnMobile).toBe(false);
    }
  });

  it("hero block accepts hideOnMobile set to true", () => {
    const block = { id: "h", type: "hero" as const, data: { title: "x", titleAccent: "", subtitle: "", buttonText: "", buttonUrl: "", imageUrl: "", hideOnMobile: true } };
    const parsed = blockSchema.safeParse(block);
    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.type === "hero") {
      expect(parsed.data.data.hideOnMobile).toBe(true);
    }
  });

  it("cta-banner block parses without backgroundImage/align and gets defaults", () => {
    const old = { id: "c", type: "cta-banner" as const, data: { title: "x", subtitle: "", buttonText: "", buttonUrl: "", bgColor: "ink" } };
    const parsed = blockSchema.safeParse(old);
    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.type === "cta-banner") {
      expect(parsed.data.data.backgroundImage).toBe("");
      expect(parsed.data.data.align).toBe("left");
    }
  });

  it("image-text-split parses without imageAspect and gets default landscape", () => {
    const old = { id: "i", type: "image-text-split" as const, data: { imageUrl: "", imageAlt: "", title: "", markdown: "", layout: "image-left" } };
    const parsed = blockSchema.safeParse(old);
    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.type === "image-text-split") {
      expect(parsed.data.data.imageAspect).toBe("landscape");
    }
  });

  it("product-grid parses without columns/layout and gets defaults", () => {
    const old = { id: "p", type: "product-grid" as const, data: { title: "", subtitle: "", filter: "bestsellers" } };
    const parsed = blockSchema.safeParse(old);
    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.type === "product-grid") {
      expect(parsed.data.data.columns).toBe("4");
      expect(parsed.data.data.layout).toBe("grid");
    }
  });
});

describe("new block schemas", () => {
  it("stats minimum shape parses", () => {
    const parsed = blockSchema.safeParse({ id: "s", type: "stats", data: { items: [{ value: "1", label: "a" }] } });
    expect(parsed.success).toBe(true);
  });
  it("shipping-strip minimum shape parses", () => {
    const parsed = blockSchema.safeParse({ id: "s", type: "shipping-strip", data: { items: [{ icon: "truck", title: "x" }] } });
    expect(parsed.success).toBe(true);
  });
  it("feature-list rejects more than 6 items", () => {
    const items = Array.from({ length: 7 }, () => ({ icon: "star" as const, title: "x", description: "y" }));
    const parsed = blockSchema.safeParse({ id: "f", type: "feature-list", data: { items } });
    expect(parsed.success).toBe(false);
  });
  it("stats rejects more than 4 items", () => {
    const items = Array.from({ length: 5 }, () => ({ value: "1", label: "a" }));
    const parsed = blockSchema.safeParse({ id: "s", type: "stats", data: { items } });
    expect(parsed.success).toBe(false);
  });
});

describe("product-grid filter schema", () => {
  it("accepts bestsellers, all, and category:<slug>", () => {
    for (const filter of ["bestsellers", "all", "category:tote-bags"]) {
      const parsed = blockSchema.safeParse({
        id: "p",
        type: "product-grid",
        data: { title: "", subtitle: "", filter, columns: "4", layout: "grid" },
      });
      expect(parsed.success).toBe(true);
    }
  });

  it("rejects nonsense filter values", () => {
    const parsed = blockSchema.safeParse({
      id: "p",
      type: "product-grid",
      data: { title: "", subtitle: "", filter: "foo", columns: "4", layout: "grid" },
    });
    expect(parsed.success).toBe(false);
  });
});

describe("URL safety validation", () => {
  it("rejects hero imageUrl with quote characters", () => {
    const bad = { id: "h", type: "hero", data: { title: "", titleAccent: "", subtitle: "", buttonText: "", buttonUrl: "", imageUrl: "x.jpg') ; opacity:0", layout: "background-image" } };
    const parsed = blockSchema.safeParse(bad);
    expect(parsed.success).toBe(false);
  });
});

describe("social-links block", () => {
  it("round-trips a populated block through the schema", () => {
    const input = {
      id: "abc1234567",
      type: "social-links" as const,
      data: {
        title: "Segue-nos",
        subtitle: "",
        items: [
          { icon: "instagram" as const, label: "@drisclub", url: "https://instagram.com/drisclub" },
          { icon: "email" as const, label: "", url: "mailto:ola@drisclub.com" },
        ],
      },
    };
    const parsed = blockSchema.parse(input);
    expect(parsed).toEqual(input);
  });

  it("defaults title to 'Segue-nos' and starts with no items", () => {
    const fresh = createBlock("social-links");
    expect(fresh.type).toBe("social-links");
    if (fresh.type !== "social-links") throw new Error("type narrowing");
    expect(fresh.data.title).toBe("Segue-nos");
    expect(fresh.data.items).toEqual([]);
  });

  it("rejects unknown social icon values", () => {
    const bad = {
      id: "abc1234567",
      type: "social-links" as const,
      data: {
        title: "x",
        subtitle: "",
        items: [{ icon: "myspace", label: "", url: "https://example.com" }],
      },
    };
    expect(() => blockSchema.parse(bad)).toThrow();
  });

  it("caps items at 7 entries", () => {
    const icons = [
      "instagram",
      "facebook",
      "tiktok",
      "youtube",
      "pinterest",
      "whatsapp",
      "email",
      "instagram",
    ] as const;
    const input = {
      id: "abc1234567",
      type: "social-links" as const,
      data: {
        title: "x",
        subtitle: "",
        items: icons.map((icon) => ({ icon, label: "", url: "https://x" })),
      },
    };
    expect(() => blockSchema.parse(input)).toThrow();
  });
});
