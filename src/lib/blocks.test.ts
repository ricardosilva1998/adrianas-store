import { describe, it, expect } from "vitest";
import { instantiatePreset } from "./blocks";

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
