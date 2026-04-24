import { describe, it, expect } from "vitest";
import { sanitizeHtml, isEmptyHtml } from "./sanitize";

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
