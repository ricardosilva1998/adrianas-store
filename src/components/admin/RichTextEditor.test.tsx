import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RichTextEditor } from "./RichTextEditor";

describe("RichTextEditor — full mode (default)", () => {
  it("renders heading, list, alignment toolbar buttons", async () => {
    render(<RichTextEditor value="" onChange={() => {}} />);
    expect(await screen.findByTitle("Título 2")).toBeInTheDocument();
    expect(screen.getByTitle("Título 3")).toBeInTheDocument();
    expect(screen.getByTitle("Lista")).toBeInTheDocument();
    expect(screen.getByTitle("Lista numerada")).toBeInTheDocument();
    expect(screen.getByTitle("Citação")).toBeInTheDocument();
    expect(screen.getByTitle("Alinhar à esquerda")).toBeInTheDocument();
  });
});

describe("RichTextEditor — inline mode", () => {
  it("renders B / I / U / link toolbar buttons", async () => {
    render(<RichTextEditor mode="inline" value="" onChange={() => {}} />);
    expect(await screen.findByTitle("Negrito")).toBeInTheDocument();
    expect(screen.getByTitle("Itálico")).toBeInTheDocument();
    expect(screen.getByTitle("Sublinhado")).toBeInTheDocument();
    expect(screen.getByTitle("Link")).toBeInTheDocument();
  });

  it("does NOT render heading, list, blockquote, or alignment buttons", async () => {
    render(<RichTextEditor mode="inline" value="" onChange={() => {}} />);
    await screen.findByTitle("Negrito");
    expect(screen.queryByTitle("Título 2")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Título 3")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Lista")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Lista numerada")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Citação")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Alinhar à esquerda")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Centrar")).not.toBeInTheDocument();
  });
});
