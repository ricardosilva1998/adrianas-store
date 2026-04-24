import { describe, it, expect } from "vitest";
import {
  replaceBlockData,
  appendBlock,
  removeBlockById,
  reorderBlocks,
} from "./page-blocks";
import type { Block } from "./blocks";

const hero: Block = { id: "a", type: "hero", data: { title: "Olá", titleAccent: "", subtitle: "", buttonText: "", buttonUrl: "", imageUrl: "", slides: [], layout: "image-right" } };
const text: Block = { id: "b", type: "text", data: { html: "<p>hi</p>" } };
const faq: Block = { id: "c", type: "faq", data: { title: "", items: [] } };

describe("replaceBlockData", () => {
  it("replaces data on matching id, preserves order", () => {
    const out = replaceBlockData([hero, text, faq], "b", { html: "<p>new</p>" });
    expect(out.ok).toBe(true);
    expect(out.blocks[1]).toEqual({ id: "b", type: "text", data: { html: "<p>new</p>" } });
    expect(out.blocks.map((b) => b.id)).toEqual(["a", "b", "c"]);
  });

  it("returns ok:false when id is missing", () => {
    const out = replaceBlockData([hero, text], "zzz", { html: "<p>no</p>" });
    expect(out.ok).toBe(false);
    expect(out.blocks).toEqual([hero, text]);
  });

  it("rejects data that fails the block schema", () => {
    const out = replaceBlockData([text], "b", { html: 42 as unknown as string });
    expect(out.ok).toBe(false);
  });
});

describe("appendBlock", () => {
  it("appends to the end and returns a new array", () => {
    const out = appendBlock([hero], text);
    expect(out.blocks).toEqual([hero, text]);
    expect(out.ok).toBe(true);
  });

  it("rejects a block whose data doesn't match its type", () => {
    const bad = { id: "x", type: "hero", data: { title: 1 } } as unknown as Block;
    const out = appendBlock([], bad);
    expect(out.ok).toBe(false);
  });

  it("appendBlock accepts a block with a new id but a caller is responsible for uniqueness", () => {
    const out = appendBlock([hero], text); // different ids: "a" vs "b"
    expect(out.ok).toBe(true);
  });
});

describe("removeBlockById", () => {
  it("removes matching id", () => {
    const out = removeBlockById([hero, text, faq], "b");
    expect(out.ok).toBe(true);
    expect(out.blocks.map((b) => b.id)).toEqual(["a", "c"]);
  });

  it("returns ok:false when id is missing", () => {
    const out = removeBlockById([hero], "zzz");
    expect(out.ok).toBe(false);
  });
});

describe("reorderBlocks", () => {
  it("reorders to match ids sequence", () => {
    const out = reorderBlocks([hero, text, faq], ["c", "a", "b"]);
    expect(out.ok).toBe(true);
    expect(out.blocks.map((b) => b.id)).toEqual(["c", "a", "b"]);
  });

  it("returns ok:false when ids sequence is a different set", () => {
    const out = reorderBlocks([hero, text], ["a", "zzz"]);
    expect(out.ok).toBe(false);
  });

  it("returns ok:false when ids sequence has wrong length", () => {
    const out = reorderBlocks([hero, text, faq], ["a", "b"]);
    expect(out.ok).toBe(false);
  });

  it("returns ok:false when ids contain duplicates", () => {
    const out = reorderBlocks([hero, text], ["a", "a"]);
    expect(out.ok).toBe(false);
  });
});

it.skip("/api/admin/pages/[slug]/discard-draft returns 404 for unknown slug (integration test)", () => {
  // Covered by the endpoint's SELECT-before-UPDATE check added in commit fc7c958.
  // Real HTTP test requires a test DB harness; skipped until one exists.
});
