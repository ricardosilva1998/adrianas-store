import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BlockCard from "./BlockCard";
import type { Block } from "../../lib/blocks";

const hero: Block = {
  id: "h1",
  type: "hero",
  data: { title: "Old", titleAccent: "", subtitle: "", buttonText: "", buttonUrl: "", imageUrl: "", layout: "image-right" as const },
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

  it("POSTs to /api/admin/block-presets when the preset modal is confirmed", async () => {
    const user = userEvent.setup();
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
    await user.click(screen.getByRole("button", { name: /mais opções/i }));
    await user.click(screen.getByRole("menuitem", { name: /guardar como bloco personalizado/i }));
    const input = await screen.findByPlaceholderText(/Hero da home/i);
    await user.type(input, "Hero home");
    await user.click(screen.getByRole("button", { name: /^guardar$/i }));
    await waitFor(() =>
      expect((globalThis.fetch as any)).toHaveBeenCalledWith(
        "/api/admin/block-presets",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });
});
