// Shipping cost rules — shared by checkout (client), API (server) and order
// creation so client and server always agree on the displayed/charged amount.

export type ShippingMethod = {
  id: string;
  label: string;
  costCents: number;
  description: string;
};

/** Subtotal-after-discount threshold above which shipping is free (€20). */
export const FREE_SHIPPING_THRESHOLD_CENTS = 20_00;

/**
 * Final shipping cost after applying the free-shipping rule.
 * `payable` is the order subtotal minus discount (the amount the customer
 * is paying before shipping is added).
 */
export function applyShippingRules(
  selectedMethodCents: number,
  payableSubtotalCents: number,
): { cents: number; freeShipping: boolean } {
  if (payableSubtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS) {
    return { cents: 0, freeShipping: true };
  }
  return { cents: Math.max(0, selectedMethodCents), freeShipping: false };
}

/** Cart item subset needed to find the most-expensive entry. */
type CartLine = { price: number; quantity: number };

/**
 * Returns the index of the most-expensive line in the cart (by unit price).
 * Quantity is irrelevant per spec — "do artigo mais caro". Ties resolve to the
 * earliest index for determinism.
 */
export function mostExpensiveIndex(items: CartLine[]): number {
  if (items.length === 0) return -1;
  let bestIdx = 0;
  for (let i = 1; i < items.length; i++) {
    if (items[i].price > items[bestIdx].price) bestIdx = i;
  }
  return bestIdx;
}
