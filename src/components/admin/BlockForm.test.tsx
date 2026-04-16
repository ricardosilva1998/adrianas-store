import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BlockForm from "./BlockForm";
import type { Block } from "../../lib/blocks";

describe("BlockForm(hero)", () => {
  it("calls onChange when title is edited", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const block: Block = {
      id: "a",
      type: "hero",
      data: { title: "", titleAccent: "", subtitle: "", buttonText: "", buttonUrl: "", imageUrl: "" },
    };
    render(<BlockForm block={block} onChange={onChange} />);
    const titleInput = screen.getAllByRole("textbox")[0];
    await user.type(titleInput, "Olá");
    expect(onChange).toHaveBeenCalled();
  });
});

describe("BlockForm(faq)", () => {
  it("shows an 'add question' affordance", () => {
    const block: Block = { id: "c", type: "faq", data: { title: "", items: [] } };
    render(<BlockForm block={block} onChange={() => {}} />);
    expect(screen.getByText(/adicionar pergunta/i)).toBeInTheDocument();
  });
});
