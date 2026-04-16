import { describe, it, expect } from "vitest";
import { blockSchema, instantiatePreset } from "./blocks";

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
