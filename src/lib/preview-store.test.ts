import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  putPagePreview,
  upsertPagePreview,
  getPagePreview,
  clearPagePreview,
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
