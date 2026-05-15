import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AnnouncementDismissButton from "./AnnouncementDismissButton";

beforeEach(() => {
  localStorage.clear();
});

describe("AnnouncementDismissButton", () => {
  it("renders a button when not dismissed", () => {
    render(<AnnouncementDismissButton version="v1" />);
    expect(screen.getByRole("button", { name: /fechar aviso/i })).toBeInTheDocument();
  });

  it("does NOT render when localStorage already has the key", () => {
    localStorage.setItem("drisclub-banner-dismissed-v1", "1");
    render(<AnnouncementDismissButton version="v1" />);
    expect(screen.queryByRole("button", { name: /fechar aviso/i })).not.toBeInTheDocument();
  });

  it("sets the localStorage key on click", async () => {
    const user = userEvent.setup();
    render(<AnnouncementDismissButton version="v1" />);
    await user.click(screen.getByRole("button", { name: /fechar aviso/i }));
    expect(localStorage.getItem("drisclub-banner-dismissed-v1")).toBe("1");
  });

  it("hides the surrounding [data-announcement-version] element when clicked", async () => {
    const user = userEvent.setup();
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-announcement-version", "v1");
    document.body.appendChild(wrapper);
    try {
      render(<AnnouncementDismissButton version="v1" />, { container: wrapper });
      await user.click(screen.getByRole("button", { name: /fechar aviso/i }));
      expect(wrapper.style.display).toBe("none");
    } finally {
      wrapper.remove();
    }
  });

  it("uses a different localStorage key for different versions", async () => {
    const user = userEvent.setup();
    render(<AnnouncementDismissButton version="v1" />);
    await user.click(screen.getByRole("button", { name: /fechar aviso/i }));
    expect(localStorage.getItem("drisclub-banner-dismissed-v1")).toBe("1");
    expect(localStorage.getItem("drisclub-banner-dismissed-v2")).toBeNull();
  });
});
