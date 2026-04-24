import { persistentAtom } from "@nanostores/persistent";

export type Personalization = {
  phrase: string;
  colors: string[];
  description: string;
};

export type VariantColor = { name: string; hex: string };

export type CartItem = {
  id: string;
  productSlug: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  category: string;
  personalization?: Personalization;
  variantColor?: VariantColor;
};

export const cart = persistentAtom<CartItem[]>("adriana-cart", [], {
  encode: JSON.stringify,
  decode: JSON.parse,
});

export const addToCart = (item: Omit<CartItem, "id">) => {
  const id = crypto.randomUUID();
  cart.set([...cart.get(), { ...item, id }]);
};

export const removeFromCart = (id: string) => {
  cart.set(cart.get().filter((item) => item.id !== id));
};

export const updateQuantity = (id: string, quantity: number) => {
  if (quantity < 1) {
    removeFromCart(id);
    return;
  }
  cart.set(
    cart.get().map((item) =>
      item.id === id ? { ...item, quantity } : item,
    ),
  );
};

export const clearCart = () => {
  cart.set([]);
};

export const cartSubtotal = (items: CartItem[]): number =>
  items.reduce((sum, item) => sum + item.price * item.quantity, 0);

export const cartItemCount = (items: CartItem[]): number =>
  items.reduce((sum, item) => sum + item.quantity, 0);
