import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  putPagePreview,
  upsertPagePreview,
  getPagePreview,
  clearPagePreview,
  putBlockPreview,
  getBlockPreview,
  clearBlockPreview,
} from "./preview-store";

const makePayload = (slug = "home") => ({
  slug,
  title: "Home",
  blocks: [
    {
      id: "a",
      type: "hero" as const,
      data: { title: "", titleAccent: "", subtitle: "", buttonText: "", buttonUrl: "", imageUrl: "", layout: "image-right" as const },
    },
  ],
});

describe("page preview store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("putPagePreview returns a unique string token", () => {
    const a = putPagePreview(makePayload());
    const b = putPagePreview(makePayload());
    expect(a).not.toBe(b);
    expect(typeof a).toBe("string");
  });

  it("getPagePreview retrieves the stored payload", () => {
    const token = putPagePreview(makePayload("sobre"));
    expect(getPagePreview(token)?.slug).toBe("sobre");
  });

  it("upsertPagePreview overwrites an existing entry", () => {
    const token = putPagePreview(makePayload("home"));
    upsertPagePreview(token, makePayload("sobre"));
    expect(getPagePreview(token)?.slug).toBe("sobre");
  });

  it("clearPagePreview removes the entry", () => {
    const token = putPagePreview(makePayload());
    clearPagePreview(token);
    expect(getPagePreview(token)).toBeNull();
  });

  it("expires after the TTL", () => {
    const token = putPagePreview(makePayload());
    vi.advanceTimersByTime(11 * 60 * 1000);
    expect(getPagePreview(token)).toBeNull();
  });
});

describe("block preview store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("putBlockPreview returns a unique string token", () => {
    const a = putBlockPreview({ type: "hero", data: {} });
    const b = putBlockPreview({ type: "hero", data: {} });
    expect(a).not.toBe(b);
  });

  it("getBlockPreview retrieves stored value", () => {
    const t = putBlockPreview({ type: "faq", data: { title: "x" } });
    expect(getBlockPreview(t)?.type).toBe("faq");
  });

  it("clearBlockPreview removes the entry", () => {
    const t = putBlockPreview({ type: "hero", data: {} });
    clearBlockPreview(t);
    expect(getBlockPreview(t)).toBeNull();
  });

  it("expires after TTL", () => {
    const t = putBlockPreview({ type: "hero", data: {} });
    vi.advanceTimersByTime(11 * 60 * 1000);
    expect(getBlockPreview(t)).toBeNull();
  });
});
