import { describe, it, expect } from "vitest";
import { applyShippingRules, mostExpensiveIndex } from "./shipping";

describe("applyShippingRules", () => {
  it("returns the selected cost when payable < 20€", () => {
    expect(applyShippingRules(550, 1999)).toEqual({ cents: 550, freeShipping: false });
  });

  it("returns 0 + freeShipping=true when payable >= 20€", () => {
    expect(applyShippingRules(550, 2000)).toEqual({ cents: 0, freeShipping: true });
    expect(applyShippingRules(550, 9999)).toEqual({ cents: 0, freeShipping: true });
  });

  it("never returns negative cents", () => {
    expect(applyShippingRules(-100, 0).cents).toBe(0);
  });
});

describe("mostExpensiveIndex", () => {
  it("returns -1 for an empty cart", () => {
    expect(mostExpensiveIndex([])).toBe(-1);
  });

  it("picks the highest unit price (quantity ignored)", () => {
    const items = [
      { price: 5, quantity: 3 },
      { price: 12, quantity: 1 },
      { price: 8, quantity: 2 },
    ];
    expect(mostExpensiveIndex(items)).toBe(1);
  });

  it("ties resolve to the earliest index", () => {
    const items = [
      { price: 10, quantity: 1 },
      { price: 10, quantity: 1 },
    ];
    expect(mostExpensiveIndex(items)).toBe(0);
  });
});
