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
      data: { title: "", titleAccent: "", subtitle: "", buttonText: "", buttonUrl: "", imageUrl: "", slides: [], layout: "image-right" as const },
    };
    render(<BlockForm block={block} onChange={onChange} />);
    const titleInput = screen.getAllByRole("textbox")[0];
    await user.type(titleInput, "Olá");
    expect(onChange).toHaveBeenCalled();
  });

  it("toggles hideOnMobile when the 'esconder na versão mobile' checkbox is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const block: Block = {
      id: "a",
      type: "hero",
      data: { title: "", titleAccent: "", subtitle: "", buttonText: "", buttonUrl: "", imageUrl: "", slides: [], layout: "image-right" as const, hideOnMobile: false },
    };
    render(<BlockForm block={block} onChange={onChange} />);
    const checkbox = screen.getByRole("checkbox", { name: /esconder na versão mobile/i });
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);
    expect(onChange).toHaveBeenCalledWith({ hideOnMobile: true });
  });
});

describe("BlockForm(faq)", () => {
  it("shows an 'add question' affordance", () => {
    const block: Block = { id: "c", type: "faq", data: { title: "", items: [] } };
    render(<BlockForm block={block} onChange={() => {}} />);
    expect(screen.getByText(/adicionar pergunta/i)).toBeInTheDocument();
  });
});
