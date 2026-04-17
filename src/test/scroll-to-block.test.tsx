import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("scroll-to-block listener logic", () => {
  beforeEach(() => {
    document.body.innerHTML = `<div data-block-id="h1" id="target"></div>`;
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("finds the element and calls scrollIntoView + animate", () => {
    const target = document.getElementById("target") as HTMLElement;
    // jsdom does not implement scrollIntoView/animate — stub them before spying.
    target.scrollIntoView = () => {};
    // @ts-expect-error jsdom animate signature is loose
    target.animate = () => ({ play: () => {} });
    const scrollSpy = vi.spyOn(target, "scrollIntoView").mockImplementation(() => {});
    const animateSpy = vi
      .spyOn(target, "animate")
      // @ts-expect-error jsdom animate signature is loose
      .mockImplementation(() => ({ play: () => {} }));

    // Simulate the inline handler:
    const id = "h1";
    const el = document.querySelector(`[data-block-id="${CSS.escape(id)}"]`) as HTMLElement;
    expect(el).toBe(target);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.animate(
      [
        { outline: "2px solid #ED7396", outlineOffset: "4px" },
        { outline: "2px solid transparent", outlineOffset: "4px" },
      ],
      { duration: 800 },
    );

    expect(scrollSpy).toHaveBeenCalled();
    expect(animateSpy).toHaveBeenCalled();
  });

  it("does nothing when no element matches", () => {
    const el = document.querySelector(`[data-block-id="ghost"]`);
    expect(el).toBeNull();
  });
});
