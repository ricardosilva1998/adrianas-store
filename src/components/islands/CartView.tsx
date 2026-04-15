import { useStore } from "@nanostores/react";
import {
  cart,
  cartSubtotal,
  removeFromCart,
  updateQuantity,
} from "./stores/cart";

const formatEuro = (value: number) =>
  new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(value);

export default function CartView() {
  const items = useStore(cart);
  const subtotal = cartSubtotal(items);

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-ink-line bg-rosa-50/40 p-16 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rosa-100 text-rosa-500">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
            aria-hidden="true"
          >
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
        </div>
        <h2 className="mt-5 text-xl font-semibold text-ink">
          O teu carrinho está vazio
        </h2>
        <p className="mt-2 text-sm text-ink-soft">
          Começa a explorar o catálogo e adiciona as tuas peças favoritas.
        </p>
        <a href="/catalogo" className="btn-primary mt-8 inline-flex">
          Ver catálogo
        </a>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1.3fr_0.7fr] lg:items-start">
      <ul className="divide-y divide-ink-line rounded-3xl border border-ink-line bg-white">
        {items.map((item) => (
          <li key={item.id} className="flex gap-4 p-5 sm:gap-6 sm:p-6">
            <a
              href={`/catalogo/${item.productSlug}`}
              className="block h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-rosa-50 sm:h-28 sm:w-28"
            >
              <img
                src={item.image}
                alt={item.name}
                className="h-full w-full object-cover"
              />
            </a>

            <div className="flex flex-1 flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <a
                    href={`/catalogo/${item.productSlug}`}
                    className="text-sm font-semibold text-ink transition hover:text-rosa-500 sm:text-base"
                  >
                    {item.name}
                  </a>
                  <p className="mt-1 text-xs text-ink-muted">
                    {formatEuro(item.price)} cada
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFromCart(item.id)}
                  className="text-xs font-medium text-ink-muted transition hover:text-rosa-500"
                  aria-label={`Remover ${item.name}`}
                >
                  Remover
                </button>
              </div>

              {item.personalization && (
                <div className="mt-2 rounded-xl bg-rosa-50/70 p-3 text-xs text-ink-soft">
                  <p className="font-semibold uppercase tracking-wide text-rosa-500">
                    Personalizado
                  </p>
                  {item.personalization.phrase && (
                    <p className="mt-1 italic">"{item.personalization.phrase}"</p>
                  )}
                  {item.personalization.description && (
                    <p className="mt-1">{item.personalization.description}</p>
                  )}
                  {item.personalization.colors.length > 0 && (
                    <div className="mt-2 flex gap-1.5">
                      {item.personalization.colors.map((hex) => (
                        <span
                          key={hex}
                          className="h-4 w-4 rounded-full border border-ink-line"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 flex items-center justify-between">
                <div className="inline-flex items-center gap-2 rounded-full border border-ink-line bg-white p-1">
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-rosa-50 hover:text-rosa-500"
                    aria-label="Diminuir"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm font-semibold">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-rosa-50 hover:text-rosa-500"
                    aria-label="Aumentar"
                  >
                    +
                  </button>
                </div>
                <span className="text-sm font-semibold text-ink">
                  {formatEuro(item.price * item.quantity)}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <aside className="rounded-3xl border border-ink-line bg-white p-6 lg:sticky lg:top-28">
        <h2 className="text-lg font-semibold text-ink">Resumo</h2>
        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-ink-soft">Subtotal</dt>
            <dd className="font-semibold text-ink">{formatEuro(subtotal)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-ink-soft">Envio</dt>
            <dd className="text-xs text-ink-muted">Calculado no checkout</dd>
          </div>
        </dl>
        <div className="mt-6 flex items-center justify-between border-t border-ink-line pt-5">
          <span className="text-sm font-semibold text-ink">Total estimado</span>
          <span className="text-xl font-semibold text-ink">
            {formatEuro(subtotal)}
          </span>
        </div>
        <a href="/checkout" className="btn-primary mt-6 w-full">
          Avançar para checkout
        </a>
        <a
          href="/catalogo"
          className="mt-3 block text-center text-xs text-ink-muted transition hover:text-rosa-500"
        >
          Continuar a comprar
        </a>
      </aside>
    </div>
  );
}
