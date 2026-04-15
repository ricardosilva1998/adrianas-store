import { useStore } from "@nanostores/react";
import { cart, cartItemCount } from "./stores/cart";

export default function CartIcon() {
  const items = useStore(cart);
  const count = cartItemCount(items);

  return (
    <a
      href="/carrinho"
      aria-label={`Carrinho (${count} ${count === 1 ? "item" : "itens"})`}
      className="group relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink-line text-ink transition hover:border-rosa-400 hover:text-rosa-500"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rosa-500 px-1 text-[10px] font-semibold text-white">
          {count}
        </span>
      )}
    </a>
  );
}
