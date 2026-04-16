import { describe, it, expect } from "vitest";

describe("vitest smoke", () => {
  it("adds numbers", () => {
    expect(1 + 2).toBe(3);
  });

  it("has jsdom", () => {
    document.body.innerHTML = `<h1>ola</h1>`;
    expect(document.querySelector("h1")?.textContent).toBe("ola");
  });
});
