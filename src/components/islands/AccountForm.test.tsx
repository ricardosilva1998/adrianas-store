import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AccountForm from "./AccountForm";

describe("AccountForm — password visibility", () => {
  it("register mode shows a password visibility toggle", async () => {
    const user = userEvent.setup();
    render(<AccountForm />);
    await user.click(screen.getByRole("button", { name: /criar conta/i }));
    expect(
      screen.getByRole("button", { name: /mostrar palavra-passe/i }),
    ).toBeInTheDocument();
  });

  it("clicking the eye toggle unmasks the password field in register mode", async () => {
    const user = userEvent.setup();
    const { container } = render(<AccountForm />);
    await user.click(screen.getByRole("button", { name: /criar conta/i }));
    const input = container.querySelector('input[name="password"]') as HTMLInputElement;
    expect(input.type).toBe("password");
    await user.click(screen.getByRole("button", { name: /mostrar palavra-passe/i }));
    expect(input.type).toBe("text");
  });

  it("keeps the 8-character minimum on the password in register mode", async () => {
    const user = userEvent.setup();
    const { container } = render(<AccountForm />);
    await user.click(screen.getByRole("button", { name: /criar conta/i }));
    const input = container.querySelector('input[name="password"]') as HTMLInputElement;
    expect(input.minLength).toBe(8);
  });
});
