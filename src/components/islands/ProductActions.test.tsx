import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ProductActions from "./ProductActions";
import { cart, clearCart } from "./stores/cart";

const baseProduct = {
  slug: "tote-bag",
  name: "Tote bag",
  price: 18,
  image: "/img.jpg",
  category: "bolsas",
  personalizable: true,
  availableColors: [{ name: "Rosa", hex: "#ff66aa" }],
};

describe("ProductActions — mandatory personalization", () => {
  beforeEach(() => {
    clearCart();
  });

  it("disables 'Adicionar ao carrinho' and shows asterisk when product is personalizable and no personalization is set", () => {
    render(<ProductActions product={baseProduct} />);
    const addBtn = screen.getByRole("button", { name: /adicionar ao carrinho/i });
    expect(addBtn).toBeDisabled();
    // Asterisks on both labels (Adicionar + Personalizar)
    const asterisks = screen.getAllByText("*");
    expect(asterisks.length).toBeGreaterThanOrEqual(2);
    // Hint text below buttons
    expect(
      screen.getByText(/personalização é obrigatória/i),
    ).toBeInTheDocument();
    // Cart still empty
    expect(cart.get()).toHaveLength(0);
  });

  it("enables 'Adicionar ao carrinho' for products that are NOT personalizable", () => {
    render(<ProductActions product={{ ...baseProduct, personalizable: false }} />);
    const addBtn = screen.getByRole("button", { name: /adicionar ao carrinho/i });
    expect(addBtn).toBeEnabled();
    // No "Personalizar" button at all
    expect(screen.queryByRole("button", { name: /^personalizar/i })).toBeNull();
  });
});
