import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BlockPickerDialog from "./BlockPickerDialog";

describe("BlockPickerDialog", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] }) as any;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists page-context blocks only (no product-* / catalog-grid-bound)", () => {
    render(<BlockPickerDialog open context="page" onClose={() => {}} onInsertBlockType={() => {}} onInsertPreset={() => {}} />);
    expect(screen.getByText(/hero/i)).toBeInTheDocument();
    expect(screen.queryByText(/galeria do produto/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/grelha do catálogo/i)).not.toBeInTheDocument();
  });

  it("switching to 'Meus blocos' fetches presets", async () => {
    const user = userEvent.setup();
    render(<BlockPickerDialog open context="page" onClose={() => {}} onInsertBlockType={() => {}} onInsertPreset={() => {}} />);
    await user.click(screen.getByRole("tab", { name: /meus blocos/i }));
    await waitFor(() =>
      expect((globalThis.fetch as any)).toHaveBeenCalledWith(
        "/api/admin/block-presets?context=page",
      ),
    );
  });

  it("calls onInsertBlockType with the selected type when 'Inserir' is clicked", async () => {
    const user = userEvent.setup();
    const onInsertBlockType = vi.fn();
    render(<BlockPickerDialog open context="page" onClose={() => {}} onInsertBlockType={onInsertBlockType} onInsertPreset={() => {}} />);
    await user.click(screen.getByText(/hero/i));
    await user.click(screen.getByRole("button", { name: /inserir/i }));
    expect(onInsertBlockType).toHaveBeenCalledWith("hero");
  });
});
