import { describe, it, expect } from "vitest";
import { clampFocal, focalFromDrag, focalToCss } from "./focal-point";

describe("clampFocal", () => {
  it("clamps coordinates into 0-100", () => {
    expect(clampFocal({ x: -10, y: 120 })).toEqual({ x: 0, y: 100 });
    expect(clampFocal({ x: 50, y: 50 })).toEqual({ x: 50, y: 50 });
  });

  it("replaces NaN with 50", () => {
    expect(clampFocal({ x: NaN, y: 30 })).toEqual({ x: 50, y: 30 });
  });
});

describe("focalToCss", () => {
  it("renders X% Y%", () => {
    expect(focalToCss({ x: 25, y: 75 })).toBe("25% 75%");
  });
  it("falls back to 50% 50% for missing/invalid", () => {
    expect(focalToCss(undefined)).toBe("50% 50%");
    expect(focalToCss(null)).toBe("50% 50%");
  });
});

describe("focalFromDrag", () => {
  // 200x100 container, 400x100 image → overflow 200x0 (only horizontal).
  const base = {
    containerW: 200,
    containerH: 100,
    imageW: 400,
    imageH: 100,
    current: { x: 50, y: 50 },
  };

  it("dragging right moves focal left (smaller X%)", () => {
    const next = focalFromDrag({ ...base, deltaPxX: 20, deltaPxY: 0 });
    expect(next.x).toBeLessThan(50);
    expect(next.y).toBe(50);
  });

  it("dragging left moves focal right (larger X%)", () => {
    const next = focalFromDrag({ ...base, deltaPxX: -50, deltaPxY: 0 });
    expect(next.x).toBeGreaterThan(50);
  });

  it("clamps focal at the edges", () => {
    const next = focalFromDrag({ ...base, deltaPxX: 100_000, deltaPxY: 0 });
    expect(next.x).toBe(0);
  });

  it("returns current when there is no overflow on that axis", () => {
    // Image already same size as container → no overflow vertical.
    const same = { ...base, imageH: 100, containerH: 100 };
    const next = focalFromDrag({ ...same, deltaPxX: 0, deltaPxY: 50 });
    expect(next.y).toBe(50);
  });
});
