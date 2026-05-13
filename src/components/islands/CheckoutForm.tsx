import { useEffect, useState } from "react";
import { useStore } from "@nanostores/react";
import { cart, cartSubtotal, clearCart } from "./stores/cart";
import {
  isValidAddress,
  isValidName,
  isValidPtPhone,
  normalizePhone,
} from "../../lib/customer-validation";
import { isFormatValid, normalizePostalCode } from "../../lib/postal-code";
import {
  applyShippingRules,
  FREE_SHIPPING_THRESHOLD_CENTS,
  mostExpensiveIndex,
  type ShippingMethod,
} from "../../lib/shipping";

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

type AppliedCoupon = {
  code: string;
  discountCents: number;
};

type InitialProfile = {
  name: string;
  email: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  nif: string;
};

type Props = {
  initial?: InitialProfile;
};

export default function CheckoutForm({ initial }: Props = {}) {
  const items = useStore(cart);
  const subtotal = cartSubtotal(items);

  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [postalCode, setPostalCode] = useState(initial?.postalCode ?? "");
  const [city, setCity] = useState(initial?.city ?? "");

  const [nameError, setNameError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [postalError, setPostalError] = useState<string | null>(null);
  const [postalBusy, setPostalBusy] = useState(false);

  const validateName = () => {
    setNameError(isValidName(name) ? null : "Indica o teu nome completo.");
  };
  const validatePhone = () => {
    setPhoneError(isValidPtPhone(phone) ? null : "Telemóvel inválido (9 dígitos PT).");
  };
  const validateAddress = () => {
    setAddressError(
      isValidAddress(address) ? null : "Indica a morada completa (mín. 5 caracteres).",
    );
  };
  const validatePostal = async () => {
    setPostalError(null);
    if (!postalCode) {
      setPostalError("Indica o código postal.");
      return;
    }
    if (!isFormatValid(postalCode)) {
      setPostalError("Formato inválido (ex: 0000-000).");
      return;
    }
    const normalized = normalizePostalCode(postalCode);
    if (normalized && normalized !== postalCode) setPostalCode(normalized);
    setPostalBusy(true);
    try {
      const res = await fetch(
        `/api/validate-postal-code?code=${encodeURIComponent(normalized ?? postalCode)}`,
      );
      const data = (await res.json()) as
        | { ok: true; locality: string }
        | { ok: false; reason: "format" | "not-found" | "network" };
      if (!data.ok) {
        if (data.reason === "not-found") {
          setPostalError("Código postal não existe.");
        }
        // network/format already covered by previous checks; stay silent
        return;
      }
      // Auto-fill city when empty or when it differs from the lookup result.
      if (!city.trim() && data.locality) setCity(data.locality);
    } catch {
      // Soft-fail: don't block customer on network hiccup.
    } finally {
      setPostalBusy(false);
    }
  };

  const fieldsValid =
    isValidName(name) &&
    isValidPtPhone(phone) &&
    isValidAddress(address) &&
    isFormatValid(postalCode) &&
    city.trim().length > 0 &&
    !postalError;

  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  const subtotalCents = Math.round(subtotal * 100);
  const discountCents = coupon?.discountCents ?? 0;
  const payableBeforeShipping = Math.max(0, subtotalCents - discountCents);

  // Shipping methods come from the most-expensive item in the cart.
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [selectedShippingId, setSelectedShippingId] = useState<string | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const shippingSlug = (() => {
    const idx = mostExpensiveIndex(items);
    return idx === -1 ? null : items[idx].productSlug;
  })();

  useEffect(() => {
    if (!shippingSlug) {
      setShippingMethods([]);
      setSelectedShippingId(null);
      return;
    }
    let cancelled = false;
    setShippingLoading(true);
    setShippingError(null);
    fetch(`/api/products/${encodeURIComponent(shippingSlug)}/shipping`)
      .then((res) => res.json())
      .then((data: { methods?: ShippingMethod[]; error?: string }) => {
        if (cancelled) return;
        const list = Array.isArray(data.methods) ? data.methods : [];
        setShippingMethods(list);
        // Pre-select cheapest method so the total is meaningful from the start.
        if (list.length > 0) {
          const cheapest = list.reduce((m, n) => (n.costCents < m.costCents ? n : m), list[0]);
          setSelectedShippingId(cheapest.id);
        } else {
          setSelectedShippingId(null);
        }
        if (data.error) setShippingError(data.error);
      })
      .catch(() => {
        if (!cancelled) setShippingError("Não foi possível obter os métodos de envio.");
      })
      .finally(() => {
        if (!cancelled) setShippingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [shippingSlug]);

  const selectedShipping =
    shippingMethods.find((m) => m.id === selectedShippingId) ?? null;
  const shippingRule = applyShippingRules(
    selectedShipping?.costCents ?? 0,
    payableBeforeShipping,
  );
  const shippingCents = shippingRule.cents;
  const freeShipping = shippingRule.freeShipping;
  const totalCents = Math.max(0, payableBeforeShipping + shippingCents);

  const noShippingAvailable =
    !shippingLoading && shippingMethods.length === 0;
  const needsShippingChoice =
    shippingMethods.length > 1 && selectedShipping === null;

  const applyCoupon = async () => {
    const code = couponInput.trim();
    if (!code) return;
    setCouponBusy(true);
    setCouponError(null);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, subtotalCents }),
      });
      const data = await res.json();
      if (!data.ok) {
        setCoupon(null);
        setCouponError(data.error || "Cupão inválido.");
        return;
      }
      setCoupon({ code: data.code, discountCents: data.discountCents });
      setCouponInput(data.code);
    } catch (err) {
      setCouponError(err instanceof Error ? err.message : "Erro a validar cupão.");
    } finally {
      setCouponBusy(false);
    }
  };

  const removeCoupon = () => {
    setCoupon(null);
    setCouponInput("");
    setCouponError(null);
  };

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

    // Re-run synchronous validators on submit so users can't bypass blur events
    // by hitting Enter immediately.
    validateName();
    validatePhone();
    validateAddress();
    if (!fieldsValid) {
      setStatus("idle");
      setErrorMessage("Corrige os campos assinalados antes de submeter.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const normalizedPhone = normalizePhone(phone);
    const normalizedPostal = normalizePostalCode(postalCode) ?? postalCode;
    const payload = {
      customer: {
        name: name.trim(),
        email: String(formData.get("email") ?? ""),
        phone: normalizedPhone,
        address: address.trim(),
        postalCode: normalizedPostal,
        city: city.trim(),
        nif: (formData.get("nif") as string) || null,
      },
      paymentMethod: String(formData.get("paymentMethod") ?? "mbway"),
      notes: (formData.get("notes") as string) || null,
      couponCode: coupon?.code ?? null,
      shipping: selectedShipping
        ? {
            id: selectedShipping.id,
            label: selectedShipping.label,
            description: selectedShipping.description,
            // Client-suggested cents; the server re-applies the free-shipping
            // rule against its own subtotal/discount calculation.
            costCents: selectedShipping.costCents,
          }
        : null,
      items: items.map((item) => ({
        productSlug: item.productSlug,
        name: item.name,
        unitPriceCents: Math.round(item.price * 100),
        quantity: item.quantity,
        image: item.image,
        personalization: item.personalization ?? null,
        variantColor: item.variantColor ?? null,
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
                Nome completo <span className="text-red-500" aria-hidden>*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={validateName}
                aria-invalid={nameError !== null}
                aria-describedby={nameError ? "name-error" : undefined}
                className="field-input"
              />
              {nameError && (
                <p id="name-error" className="mt-1 text-xs text-red-600">{nameError}</p>
              )}
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
                defaultValue={initial?.email}
                className="field-input"
              />
            </div>
            <div>
              <label htmlFor="phone" className="field-label">
                Telemóvel <span className="text-red-500" aria-hidden>*</span>
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                autoComplete="tel"
                inputMode="tel"
                placeholder="9XX XXX XXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={validatePhone}
                aria-invalid={phoneError !== null}
                aria-describedby={phoneError ? "phone-error" : undefined}
                className="field-input"
              />
              {phoneError && (
                <p id="phone-error" className="mt-1 text-xs text-red-600">{phoneError}</p>
              )}
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
                defaultValue={initial?.nif}
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
                Morada <span className="text-red-500" aria-hidden>*</span>
              </label>
              <input
                id="address"
                name="address"
                type="text"
                required
                autoComplete="street-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onBlur={validateAddress}
                aria-invalid={addressError !== null}
                aria-describedby={addressError ? "address-error" : undefined}
                className="field-input"
              />
              {addressError && (
                <p id="address-error" className="mt-1 text-xs text-red-600">{addressError}</p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="postalCode" className="field-label">
                  Código Postal <span className="text-red-500" aria-hidden>*</span>
                </label>
                <input
                  id="postalCode"
                  name="postalCode"
                  type="text"
                  required
                  autoComplete="postal-code"
                  inputMode="numeric"
                  placeholder="0000-000"
                  value={postalCode}
                  onChange={(e) => {
                    setPostalCode(e.target.value);
                    if (postalError) setPostalError(null);
                  }}
                  onBlur={validatePostal}
                  aria-invalid={postalError !== null}
                  aria-describedby={postalError ? "postal-error" : undefined}
                  className="field-input"
                />
                {postalBusy && (
                  <p className="mt-1 text-xs text-ink-muted">A verificar…</p>
                )}
                {postalError && (
                  <p id="postal-error" className="mt-1 text-xs text-red-600">{postalError}</p>
                )}
              </div>
              <div>
                <label htmlFor="city" className="field-label">
                  Localidade <span className="text-red-500" aria-hidden>*</span>
                </label>
                <input
                  id="city"
                  name="city"
                  type="text"
                  required
                  autoComplete="address-level2"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="field-input"
                />
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">Método de envio</h2>
          <p className="mt-1 text-xs text-ink-muted">
            {freeShipping
              ? "Envio grátis para encomendas iguais ou superiores a 20€."
              : items.length > 1
                ? "Escolhe o método de envio. Aplica-se ao artigo mais caro do carrinho."
                : "Escolhe o método de envio."}
          </p>
          {shippingLoading ? (
            <p className="mt-4 text-xs text-ink-muted">A carregar métodos de envio…</p>
          ) : noShippingAvailable ? (
            <p className="mt-4 rounded-2xl border border-red-300 bg-red-50 p-4 text-xs text-red-700">
              Este produto não tem métodos de envio configurados. Contacta-nos
              para finalizar a encomenda.
            </p>
          ) : (
            <fieldset className="mt-5 grid gap-3">
              {shippingMethods.map((m) => {
                const checked = selectedShippingId === m.id;
                return (
                  <label
                    key={m.id}
                    className="relative flex cursor-pointer items-start gap-3 rounded-2xl border border-ink-line bg-white p-4 text-sm text-ink transition has-[:checked]:border-rosa-400 has-[:checked]:bg-rosa-50"
                  >
                    <input
                      type="radio"
                      name="shippingMethodId"
                      value={m.id}
                      checked={checked}
                      onChange={() => setSelectedShippingId(m.id)}
                      className="mt-0.5 accent-rosa-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-medium">{m.label}</span>
                        <span className="text-sm font-semibold text-ink">
                          {freeShipping ? (
                            <span>
                              <span className="line-through text-ink-muted">
                                {formatEuro(m.costCents / 100)}
                              </span>{" "}
                              <span className="text-emerald-600">Grátis</span>
                            </span>
                          ) : (
                            formatEuro(m.costCents / 100)
                          )}
                        </span>
                      </div>
                      {m.description && (
                        <p className="mt-1 text-xs text-ink-muted">{m.description}</p>
                      )}
                    </div>
                  </label>
                );
              })}
            </fieldset>
          )}
          {shippingError && (
            <p className="mt-3 text-xs text-red-600">{shippingError}</p>
          )}
          {!freeShipping && payableBeforeShipping > 0 && (
            <p className="mt-3 text-xs text-ink-muted">
              Faltam {formatEuro((FREE_SHIPPING_THRESHOLD_CENTS - payableBeforeShipping) / 100)}{" "}
              para envio grátis.
            </p>
          )}
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
                    {item.personalization.attachment && (
                      <>
                        {" · ficheiro "}
                        <span className="not-italic uppercase tracking-wide">
                          {item.personalization.attachment.kind}
                        </span>
                      </>
                    )}
                  </p>
                )}
              </div>
              <span className="text-ink">
                {formatEuro(item.price * item.quantity)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-5 border-t border-ink-line pt-5">
          <label className="field-label" htmlFor="coupon-code">Cupão de desconto</label>
          {coupon ? (
            <div className="mt-2 flex items-center justify-between rounded-2xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs">
              <span className="font-mono font-semibold text-emerald-700">{coupon.code}</span>
              <button
                type="button"
                onClick={removeCoupon}
                className="text-[11px] font-medium text-emerald-700 hover:underline"
              >
                Remover
              </button>
            </div>
          ) : (
            <div className="mt-2 flex gap-2">
              <input
                id="coupon-code"
                type="text"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                placeholder="Insere código"
                className="field-input flex-1 font-mono uppercase"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={applyCoupon}
                disabled={couponBusy || !couponInput.trim()}
                className="btn-secondary shrink-0 px-4 text-xs"
              >
                {couponBusy ? "…" : "Aplicar"}
              </button>
            </div>
          )}
          {couponError && (
            <p className="mt-2 text-xs text-rosa-700">{couponError}</p>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-ink-line pt-5 text-sm">
          <span className="text-ink-soft">Subtotal</span>
          <span className="font-semibold text-ink">{formatEuro(subtotal)}</span>
        </div>
        {coupon && (
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-ink-soft">Desconto ({coupon.code})</span>
            <span className="font-semibold text-emerald-600">
              −{formatEuro(discountCents / 100)}
            </span>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-ink-soft">Envio</span>
          {shippingLoading ? (
            <span className="text-xs text-ink-muted">a calcular…</span>
          ) : freeShipping ? (
            <span className="font-semibold text-emerald-600">Grátis</span>
          ) : selectedShipping ? (
            <span className="font-semibold text-ink">
              {formatEuro(shippingCents / 100)}
            </span>
          ) : (
            <span className="text-xs text-ink-muted">—</span>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-ink-line pt-3 text-sm">
          <span className="font-semibold text-ink">Total</span>
          <span className="font-semibold text-ink">{formatEuro(totalCents / 100)}</span>
        </div>

        <button
          type="submit"
          disabled={
            status === "submitting" ||
            !fieldsValid ||
            postalBusy ||
            shippingLoading ||
            noShippingAvailable ||
            needsShippingChoice
          }
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
