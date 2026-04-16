import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ThemeToggle from "./ThemeToggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    document.documentElement.classList.remove("dark");
    document.cookie = "adriana-admin-theme=; Max-Age=0; Path=/";
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads the current mode from the html.dark class on mount", () => {
    document.documentElement.classList.add("dark");
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: /mudar para modo claro/i })).toBeInTheDocument();
  });

  it("toggling adds html.dark and writes localStorage + cookie", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    const btn = screen.getByRole("button", { name: /mudar para modo escuro/i });
    await user.click(btn);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("adriana-admin-theme")).toBe("dark");
    expect(document.cookie).toContain("adriana-admin-theme=dark");
  });

  it("toggling again returns to light", async () => {
    const user = userEvent.setup();
    document.documentElement.classList.add("dark");
    render(<ThemeToggle />);
    await user.click(screen.getByRole("button", { name: /mudar para modo claro/i }));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("adriana-admin-theme")).toBe("light");
    expect(document.cookie).toContain("adriana-admin-theme=light");
  });
});
