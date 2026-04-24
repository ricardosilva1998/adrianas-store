import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PageEditor from "./PageEditor";
import type { Block } from "../../lib/blocks";

const hero: Block = {
  id: "h1",
  type: "hero",
  data: { title: "Olá", titleAccent: "", subtitle: "", buttonText: "", buttonUrl: "", imageUrl: "", slides: [], layout: "image-right" as const },
};

describe("PageEditor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ token: "t1", success: true }) }) as any;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("renders a block card per block", () => {
    render(<PageEditor slug="home" title="Home" initialBlocks={[hero]} published hasDraft={false} />);
    expect(screen.getByText(/hero/i)).toBeInTheDocument();
  });

  it("disables Publicar when a block is dirty", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<PageEditor slug="home" title="Home" initialBlocks={[hero]} published hasDraft={false} />);

    // The first block (hero) starts expanded by default (expanded = initialBlocks[0].id).
    // No expand click needed — the form is already visible.
    const titleInput = await screen.findByDisplayValue("Olá");
    await user.clear(titleInput);
    await user.type(titleInput, "Dirty");

    // Publicar button should now be disabled.
    const publishBtn = screen.getByRole("button", { name: /publicar/i });
    expect(publishBtn).toBeDisabled();
  });

  it("Publicar calls POST /api/admin/pages/home/publish with no body", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<PageEditor slug="home" title="Home" initialBlocks={[hero]} published hasDraft={false} />);
    await user.click(screen.getByRole("button", { name: /publicar/i }));
    await waitFor(() =>
      expect((globalThis.fetch as any)).toHaveBeenCalledWith(
        "/api/admin/pages/home/publish",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    const publishCall = (globalThis.fetch as any).mock.calls.find(
      (c: string[]) => c[0] === "/api/admin/pages/home/publish",
    );
    expect(publishCall?.[1]?.body).toBeUndefined();
  });
});
