import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BlockCard from "./BlockCard";
import type { Block } from "../../lib/blocks";

const hero: Block = {
  id: "h1",
  type: "hero",
  data: { title: "Old", titleAccent: "", subtitle: "", buttonText: "", buttonUrl: "", imageUrl: "" },
};

describe("BlockCard", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) }) as any;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("disables the Save button until the form is dirty", () => {
    render(
      <BlockCard
        slug="home"
        block={hero}
        expanded
        onChange={() => {}}
        onMoveUp={() => {}}
        onMoveDown={() => {}}
        onRemove={() => {}}
        onToggleExpand={() => {}}
        canMoveUp
        canMoveDown
      />,
    );
    expect(screen.getByRole("button", { name: /guardar bloco/i })).toBeDisabled();
  });

  it("enables Save after editing and calls PATCH on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <BlockCard
        slug="home"
        block={hero}
        expanded
        onChange={onChange}
        onMoveUp={() => {}}
        onMoveDown={() => {}}
        onRemove={() => {}}
        onToggleExpand={() => {}}
        canMoveUp
        canMoveDown
      />,
    );
    const titleInput = screen.getByDisplayValue("Old");
    await user.clear(titleInput);
    await user.type(titleInput, "New");
    const save = screen.getByRole("button", { name: /guardar bloco/i });
    expect(save).toBeEnabled();
    await user.click(save);

    await waitFor(() => {
      expect((globalThis.fetch as any)).toHaveBeenCalledWith(
        "/api/admin/pages/home/blocks/h1",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
    expect(await screen.findByText(/guardado/i)).toBeInTheDocument();
    expect(save).toBeDisabled();
  });
});
