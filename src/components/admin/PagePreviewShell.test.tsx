import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import PagePreviewShell from "./PagePreviewShell";

describe("PagePreviewShell", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ token: "t1" }) }) as any;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("creates a preview token on mount", async () => {
    render(
      <PagePreviewShell
        slug="home"
        title="Home"
        blocks={[]}
        onPublish={async () => {}}
        onDiscardDraft={async () => {}}
      >
        <div />
      </PagePreviewShell>,
    );
    await waitFor(() =>
      expect((globalThis.fetch as any)).toHaveBeenCalledWith(
        "/api/admin/pages/home/preview",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("debounces preview PUTs after props change", async () => {
    const { rerender } = render(
      <PagePreviewShell
        slug="home"
        title="Home"
        blocks={[]}
        onPublish={async () => {}}
        onDiscardDraft={async () => {}}
      >
        <div />
      </PagePreviewShell>,
    );
    await waitFor(() => expect((globalThis.fetch as any)).toHaveBeenCalledTimes(1));

    rerender(
      <PagePreviewShell
        slug="home"
        title="Home v2"
        blocks={[]}
        onPublish={async () => {}}
        onDiscardDraft={async () => {}}
      >
        <div />
      </PagePreviewShell>,
    );
    expect((globalThis.fetch as any)).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(400);

    await waitFor(() =>
      expect((globalThis.fetch as any)).toHaveBeenLastCalledWith(
        expect.stringContaining("/api/admin/pages/home/preview?token=t1"),
        expect.objectContaining({ method: "PUT" }),
      ),
    );
  });
});
