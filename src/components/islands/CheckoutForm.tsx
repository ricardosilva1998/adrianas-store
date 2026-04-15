import { useState } from "react";
import { useStore } from "@nanostores/react";
import { cart, cartSubtotal, clearCart } from "./stores/cart";

const formatEuro = (value: number) =>
  new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(value);

const PAYMENT_METHODS = [
  { id: "mbway", label: "MB Way" },
  { id: "transferencia", label: "Transferência Bancária" },
  { id: "paypal", label: "PayPal" },
] as const;

type Status = "idle" | "submitting" | "error";

export default function CheckoutForm() {
  const items = useStore(cart);
  const subtotal = cartSubtotal(items);

  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-ink-line bg-rosa-50/40 p-12 text-center">
        <h2 className="text-lg font-semibold text-ink">O carrinho está vazio</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Adiciona peças ao carrinho antes de avançar para o checkout.
        </p>
        <a href="/catalogo" className="btn-primary mt-6 inline-flex">
          Ver catálogo
        </a>
      </div>
    );
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("submitting");
    setErrorMessage(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      customer: {
        name: String(formData.get("name") ?? ""),
        email: String(formData.get("email") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        address: String(formData.get("address") ?? ""),
        postalCode: String(formData.get("postalCode") ?? ""),
        city: String(formData.get("city") ?? ""),
        nif: (formData.get("nif") as string) || null,
      },
      paymentMethod: String(formData.get("paymentMethod") ?? "mbway"),
      notes: (formData.get("notes") as string) || null,
      items: items.map((item) => ({
        productSlug: item.productSlug,
        name: item.name,
        unitPriceCents: Math.round(item.price * 100),
        quantity: item.quantity,
        image: item.image,
        personalization: item.personalization ?? null,
      })),
    };

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          (data && (data.error as string)) ||
            `Erro ${response.status} ao criar encomenda`,
        );
      }

      const data = (await response.json()) as {
        success: boolean;
        order: { id: number; number: string };
      };
      clearCart();
      window.location.href = `/obrigado?num=${encodeURIComponent(data.order.number)}`;
    } catch (err) {
      console.error(err);
      setStatus("error");
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Não foi possível submeter a encomenda. Tenta novamente ou envia-nos diretamente por email.",
      );
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-10 lg:grid-cols-[1.3fr_0.7fr] lg:items-start"
    >
      <div className="space-y-10">
        <section>
          <h2 className="text-lg font-semibold text-ink">Contacto</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className="field-label">
                Nome completo
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                autoComplete="name"
                className="field-input"
              />
            </div>
            <div>
              <label htmlFor="email" className="field-label">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="field-input"
              />
            </div>
            <div>
              <label htmlFor="phone" className="field-label">
                Telefone
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                autoComplete="tel"
                className="field-input"
              />
            </div>
            <div>
              <label htmlFor="nif" className="field-label">
                NIF (opcional)
              </label>
              <input
                id="nif"
                name="nif"
                type="text"
                inputMode="numeric"
                className="field-input"
              />
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">Morada de envio</h2>
          <div className="mt-5 grid gap-4">
            <div>
              <label htmlFor="address" className="field-label">
                Morada
              </label>
              <input
                id="address"
                name="address"
                type="text"
                required
                autoComplete="street-address"
                className="field-input"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="postalCode" className="field-label">
                  Código Postal
                </label>
                <input
                  id="postalCode"
                  name="postalCode"
                  type="text"
                  required
                  autoComplete="postal-code"
                  placeholder="0000-000"
                  className="field-input"
                />
              </div>
              <div>
                <label htmlFor="city" className="field-label">
                  Localidade
                </label>
                <input
                  id="city"
                  name="city"
                  type="text"
                  required
                  autoComplete="address-level2"
                  className="field-input"
                />
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">Método de pagamento</h2>
          <p className="mt-1 text-xs text-ink-muted">
            Recebes as instruções de pagamento por email após a submissão.
          </p>
          <fieldset className="mt-5 grid gap-3 sm:grid-cols-3">
            {PAYMENT_METHODS.map((m, i) => (
              <label
                key={m.id}
                className="relative flex cursor-pointer items-center gap-3 rounded-2xl border border-ink-line bg-white p-4 text-sm font-medium text-ink transition has-[:checked]:border-rosa-400 has-[:checked]:bg-rosa-50"
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={m.id}
                  required
                  defaultChecked={i === 0}
                  className="h-4 w-4 accent-rosa-500"
                />
                {m.label}
              </label>
            ))}
          </fieldset>
        </section>

        <section>
          <label htmlFor="notes" className="field-label">
            Notas adicionais (opcional)
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            className="field-input"
            placeholder="Indica aqui qualquer detalhe extra: modelo do telemóvel, tamanho, urgência…"
          />
        </section>

        {errorMessage && (
          <div
            role="alert"
            className="rounded-2xl border border-rosa-300 bg-rosa-50 p-4 text-sm text-rosa-700"
          >
            {errorMessage}
          </div>
        )}
      </div>

      <aside className="rounded-3xl border border-ink-line bg-white p-6 lg:sticky lg:top-28">
        <h2 className="text-lg font-semibold text-ink">Resumo da encomenda</h2>
        <ul className="mt-5 space-y-3 text-sm">
          {items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-ink">
                  {item.quantity}× {item.name}
                </p>
                {item.personalization && (
                  <p className="mt-0.5 text-xs italic text-ink-muted">
                    Personalizado
                  </p>
                )}
              </div>
              <span className="text-ink">
                {formatEuro(item.price * item.quantity)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex items-center justify-between border-t border-ink-line pt-5 text-sm">
          <span className="text-ink-soft">Subtotal</span>
          <span className="font-semibold text-ink">{formatEuro(subtotal)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-ink-muted">
          <span>Envio</span>
          <span>A combinar</span>
        </div>

        <button
          type="submit"
          disabled={status === "submitting"}
          className="btn-primary mt-6 w-full"
        >
          {status === "submitting" ? "A submeter…" : "Confirmar encomenda"}
        </button>
        <p className="mt-3 text-center text-xs text-ink-muted">
          Ao confirmar aceitas os{" "}
          <a href="/termos-condicoes" className="underline hover:text-rosa-500">
            Termos &amp; Condições
          </a>
          .
        </p>
      </aside>
    </form>
  );
}
