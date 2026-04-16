import { describe, it, expect } from "vitest";
import { SAMPLE_BLOCK_DATA, SAMPLE_PRODUCT, SAMPLE_PRODUCTS } from "./block-samples";
import { BLOCK_TYPES, blockSchema } from "./blocks";

describe("block samples", () => {
  it("has a sample for every BlockType", () => {
    for (const bt of BLOCK_TYPES) {
      expect(SAMPLE_BLOCK_DATA[bt.type]).toBeDefined();
    }
  });

  it("every sample passes the block Zod schema", () => {
    for (const bt of BLOCK_TYPES) {
      const candidate = { id: "sample-" + bt.type, type: bt.type, data: SAMPLE_BLOCK_DATA[bt.type] };
      const parsed = blockSchema.safeParse(candidate);
      expect(parsed.success, `${bt.type}: ${JSON.stringify(parsed.error?.format())}`).toBe(true);
    }
  });

  it("SAMPLE_PRODUCT has images + colors arrays", () => {
    expect(Array.isArray(SAMPLE_PRODUCT.images)).toBe(true);
    expect(Array.isArray(SAMPLE_PRODUCT.colors)).toBe(true);
  });

  it("SAMPLE_PRODUCTS has at least 4 entries", () => {
    expect(SAMPLE_PRODUCTS.length).toBeGreaterThanOrEqual(4);
  });
});
