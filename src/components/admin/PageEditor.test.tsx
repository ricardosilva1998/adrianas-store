import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PageEditor from "./PageEditor";
import type { Block } from "../../lib/blocks";

const hero: Block = {
  id: "h1",
  type: "hero",
  data: { title: "Olá", titleAccent: "", subtitle: "", buttonText: "", buttonUrl: "", imageUrl: "", layout: "image-right" as const },
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

  it("Publicar calls PUT /api/admin/pages/home with saveAsDraft:false", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<PageEditor slug="home" title="Home" initialBlocks={[hero]} published hasDraft={false} />);
    await user.click(screen.getByRole("button", { name: /publicar/i }));
    await waitFor(() =>
      expect((globalThis.fetch as any)).toHaveBeenCalledWith(
        "/api/admin/pages/home",
        expect.objectContaining({ method: "PUT" }),
      ),
    );
    const lastCall = (globalThis.fetch as any).mock.calls.at(-1);
    const body = JSON.parse(lastCall?.[1]?.body);
    expect(body.saveAsDraft).toBe(false);
  });
});
