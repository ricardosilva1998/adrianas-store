import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

function Greeting({ name }: { name: string }) {
  return <span>Olá {name}</span>;
}

describe("react smoke", () => {
  it("renders a component", () => {
    render(<Greeting name="Dris" />);
    expect(screen.getByText("Olá Dris")).toBeInTheDocument();
  });
});
