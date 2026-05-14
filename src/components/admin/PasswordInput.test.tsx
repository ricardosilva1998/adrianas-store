import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PasswordInput from "./PasswordInput";

describe("PasswordInput", () => {
  it("renders the password masked by default", () => {
    const { container } = render(<PasswordInput name="password" />);
    const input = container.querySelector('input[name="password"]') as HTMLInputElement;
    expect(input.type).toBe("password");
  });

  it("reveals the password when the eye toggle is clicked", async () => {
    const user = userEvent.setup();
    const { container } = render(<PasswordInput name="password" />);
    const input = container.querySelector('input[name="password"]') as HTMLInputElement;
    await user.click(screen.getByRole("button", { name: /mostrar palavra-passe/i }));
    expect(input.type).toBe("text");
    expect(
      screen.getByRole("button", { name: /esconder palavra-passe/i }),
    ).toBeInTheDocument();
  });

  it("masks the password again when the toggle is clicked twice", async () => {
    const user = userEvent.setup();
    const { container } = render(<PasswordInput name="password" />);
    const input = container.querySelector('input[name="password"]') as HTMLInputElement;
    await user.click(screen.getByRole("button", { name: /mostrar palavra-passe/i }));
    await user.click(screen.getByRole("button", { name: /esconder palavra-passe/i }));
    expect(input.type).toBe("password");
  });

  it("forwards minLength to the input element", () => {
    const { container } = render(<PasswordInput name="password" minLength={8} />);
    const input = container.querySelector('input[name="password"]') as HTMLInputElement;
    expect(input.minLength).toBe(8);
  });
});
