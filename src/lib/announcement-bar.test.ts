import { describe, it, expect } from "vitest";
import { getAnnouncementRender } from "./announcement-bar";
import type { Globals } from "./config";

function makeBanner(overrides: Partial<Globals["banner"]> = {}): Globals["banner"] {
  return {
    enabled: true,
    contentHtml: "<p>oi</p>",
    bgHex: "#ED7396",
    textHex: "#FFFFFF",
    dismissible: true,
    contentVersion: "abc123def456",
    ...overrides,
  };
}

describe("getAnnouncementRender", () => {
  it("returns shouldRender=false when enabled=false", () => {
    expect(getAnnouncementRender(makeBanner({ enabled: false })).shouldRender).toBe(false);
  });

  it("returns shouldRender=false when contentHtml is empty", () => {
    expect(getAnnouncementRender(makeBanner({ contentHtml: "" })).shouldRender).toBe(false);
  });

  it("returns shouldRender=false when contentHtml is only empty tags", () => {
    expect(getAnnouncementRender(makeBanner({ contentHtml: "<p></p>" })).shouldRender).toBe(
      false,
    );
    expect(getAnnouncementRender(makeBanner({ contentHtml: "<p><br></p>" })).shouldRender).toBe(
      false,
    );
  });

  it("returns shouldRender=true with sanitized HTML when valid", () => {
    const out = getAnnouncementRender(makeBanner({ contentHtml: "<p>oi</p>" }));
    expect(out.shouldRender).toBe(true);
    expect(out.safeHtml).toContain("oi");
  });

  it("strips <script> from contentHtml in safeHtml", () => {
    const out = getAnnouncementRender(
      makeBanner({ contentHtml: "<p>oi</p><script>alert(1)</script>" }),
    );
    expect(out.safeHtml).not.toContain("<script>");
    expect(out.safeHtml).toContain("oi");
  });

  it("returns inline style string with bgHex and textHex", () => {
    const out = getAnnouncementRender(makeBanner({ bgHex: "#FF0000", textHex: "#FFFFFF" }));
    expect(out.style).toBe("background:#FF0000;color:#FFFFFF");
  });

  it("returns empty safeHtml when shouldRender is false", () => {
    const out = getAnnouncementRender(makeBanner({ enabled: false }));
    expect(out.safeHtml).toBe("");
  });
});
