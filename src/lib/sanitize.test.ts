import { describe, it, expect } from "vitest";
import { sanitizeHtml, sanitizeAnnouncement, isEmptyHtml } from "./sanitize";

describe("sanitizeHtml", () => {
  it("preserves safe formatting tags", () => {
    const out = sanitizeHtml("<p><strong>oi</strong> <em>tudo</em> <u>bem</u>?</p>");
    expect(out).toContain("<strong>oi</strong>");
    expect(out).toContain("<em>tudo</em>");
    expect(out).toContain("<u>bem</u>");
  });

  it("strips <script> tags", () => {
    const out = sanitizeHtml("<p>ok</p><script>alert('x')</script>");
    expect(out).not.toContain("<script>");
    expect(out).not.toContain("alert");
    expect(out).toContain("<p>ok</p>");
  });

  it("strips on* event handlers", () => {
    const out = sanitizeHtml('<a href="#" onclick="alert(1)">clica</a>');
    expect(out).not.toContain("onclick");
    expect(out).toContain('href="#"');
  });

  it("strips javascript: URLs", () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toContain("javascript:");
  });

  it("allows inline color style", () => {
    const out = sanitizeHtml('<span style="color: red">oi</span>');
    expect(out).toContain("color");
    expect(out).toContain("red");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeHtml("")).toBe("");
  });
});

describe("isEmptyHtml", () => {
  it("returns true for empty string", () => {
    expect(isEmptyHtml("")).toBe(true);
  });

  it("returns true for <p></p>", () => {
    expect(isEmptyHtml("<p></p>")).toBe(true);
  });

  it("returns false for content", () => {
    expect(isEmptyHtml("<p>oi</p>")).toBe(false);
  });

  it("returns true for only whitespace and tags", () => {
    expect(isEmptyHtml("<p>   </p>")).toBe(true);
  });
});

describe("sanitizeAnnouncement", () => {
  it("preserves safe inline tags", () => {
    const out = sanitizeAnnouncement("<p><strong>oi</strong> <em>x</em> <u>y</u></p>");
    expect(out).toContain("<strong>oi</strong>");
    expect(out).toContain("<em>x</em>");
    expect(out).toContain("<u>y</u>");
  });

  it("preserves <a href> with safe URL", () => {
    const out = sanitizeAnnouncement('<p><a href="/catalogo">x</a></p>');
    expect(out).toContain('<a href="/catalogo">');
  });

  it('preserves <span style="color: #ED7396">', () => {
    const out = sanitizeAnnouncement('<p><span style="color: #ED7396">x</span></p>');
    expect(out).toContain("color");
    expect(out).toContain("ED7396");
  });

  it("strips <script>", () => {
    const out = sanitizeAnnouncement("<p>oi</p><script>alert(1)</script>");
    expect(out).not.toContain("<script>");
    expect(out).not.toContain("alert");
  });

  it("strips <iframe> and <style>", () => {
    const out = sanitizeAnnouncement('<p>oi</p><iframe src="x"></iframe><style>x</style>');
    expect(out).not.toContain("<iframe");
    expect(out).not.toContain("<style");
  });

  it("strips <h1>, <ul>, <li>, <img>", () => {
    const out = sanitizeAnnouncement('<h1>x</h1><ul><li>y</li></ul><img src="x">');
    expect(out).not.toContain("<h1");
    expect(out).not.toContain("<ul");
    expect(out).not.toContain("<li");
    expect(out).not.toContain("<img");
  });

  it("strips javascript: in href", () => {
    const out = sanitizeAnnouncement('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toContain("javascript:");
  });

  it("strips data: in href", () => {
    const out = sanitizeAnnouncement('<a href="data:text/html,x">x</a>');
    expect(out).not.toContain("data:text");
  });

  it("rejects style with non-color properties", () => {
    const out = sanitizeAnnouncement('<span style="display: none">x</span>');
    expect(out).not.toContain("display");
  });

  it('rejects style="font-size:100px"', () => {
    const out = sanitizeAnnouncement('<span style="font-size:100px">x</span>');
    expect(out).not.toContain("font-size");
  });

  it("rejects composed style with color + other (background not allowed)", () => {
    const out = sanitizeAnnouncement('<span style="color: red; background: blue">x</span>');
    expect(out).not.toContain("background");
  });

  it('accepts style="color: red"', () => {
    const out = sanitizeAnnouncement('<span style="color: red">x</span>');
    expect(out).toContain("color");
    expect(out).toContain("red");
  });

  it('accepts style="color: rgb(255, 0, 0)"', () => {
    const out = sanitizeAnnouncement('<span style="color: rgb(255, 0, 0)">x</span>');
    expect(out).toContain("color");
    expect(out).toMatch(/rgb\(\s*255\s*,/);
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeAnnouncement("")).toBe("");
  });
});

describe("sanitizeHtml is unaffected by the announcement scope flag", () => {
  it('still accepts <span style="color: red"> in product descriptions', () => {
    const out = sanitizeHtml('<span style="color: red">x</span>');
    expect(out).toContain("color");
  });

  it("still accepts <h1> in product descriptions", () => {
    const out = sanitizeHtml("<h1>x</h1>");
    expect(out).toContain("<h1");
  });

  it('still accepts <span style="font-size:12px"> in product descriptions (hook scoped)', () => {
    const out = sanitizeHtml('<span style="font-size:12px">x</span>');
    expect(out).toContain("font-size");
  });
});
