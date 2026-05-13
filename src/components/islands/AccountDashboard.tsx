import { useState } from "react";
import {
  isValidAddress,
  isValidName,
  isValidPtPhone,
  normalizePhone,
} from "../../lib/customer-validation";
import { isFormatValid, normalizePostalCode } from "../../lib/postal-code";

type CustomerProfile = {
  id: number;
  email: string;
  name: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  nif: string | null;
};

type OrderSummary = {
  id: number;
  number: string;
  status: string;
  subtotalCents: number;
  discountCents: number;
  createdAt: string;
};

type Props = {
  customer: CustomerProfile;
  orders: OrderSummary[];
};

const STATUS_LABELS: Record<string, string> = {
  new: "Nova",
  paid: "Paga",
  preparing: "Em preparação",
  shipped: "Enviada",
  delivered: "Entregue",
  cancelled: "Cancelada",
};

const formatEuro = (cents: number) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(cents / 100);

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));

export default function AccountDashboard({ customer, orders }: Props) {
  const [profile, setProfile] = useState(customer);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const [name, setName] = useState(customer.name ?? "");
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [address, setAddress] = useState(customer.address ?? "");
  const [postalCode, setPostalCode] = useState(customer.postalCode ?? "");
  const [city, setCity] = useState(customer.city ?? "");

  const [nameError, setNameError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [postalError, setPostalError] = useState<string | null>(null);
  const [postalBusy, setPostalBusy] = useState(false);

  const validateName = () => setNameError(isValidName(name) ? null : "Indica o teu nome.");
  const validatePhone = () =>
    setPhoneError(phone === "" || isValidPtPhone(phone) ? null : "Telemóvel inválido (9 dígitos PT).");
  const validateAddress = () =>
    setAddressError(address === "" || isValidAddress(address) ? null : "Morada inválida (mín. 5 caracteres).");
  const validatePostal = async () => {
    setPostalError(null);
    if (postalCode === "") return;
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
        if (data.reason === "not-found") setPostalError("Código postal não existe.");
        return;
      }
      if (!city.trim() && data.locality) setCity(data.locality);
    } catch {
      // soft-fail
    } finally {
      setPostalBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Re-run synchronous validators on submit
    validateName();
    validatePhone();
    validateAddress();
    if (
      !isValidName(name) ||
      (phone !== "" && !isValidPtPhone(phone)) ||
      (address !== "" && !isValidAddress(address)) ||
      (postalCode !== "" && !isFormatValid(postalCode)) ||
      postalError
    ) {
      setMessage({ kind: "error", text: "Corrige os campos assinalados." });
      return;
    }
    setBusy(true);
    setMessage(null);
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    const payload: Record<string, unknown> = {
      name: name.trim(),
      phone: phone ? normalizePhone(phone) : "",
      address: address.trim(),
      postalCode: postalCode ? (normalizePostalCode(postalCode) ?? postalCode) : "",
      city: city.trim(),
      nif: (String(form.get("nif") ?? "") || null) as string | null,
    };
    if (password) payload.password = password;
    try {
      const res = await fetch("/api/account/update-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      setProfile(data.customer);
      // Sync controlled state with the normalized response (e.g. trimmed values).
      setName(data.customer.name ?? "");
      setPhone(data.customer.phone ?? "");
      setAddress(data.customer.address ?? "");
      setPostalCode(data.customer.postalCode ?? "");
      setCity(data.customer.city ?? "");
      setMessage({ kind: "ok", text: password ? "Dados e password atualizados." : "Dados atualizados." });
      const pwInput = document.getElementById("p-pw") as HTMLInputElement | null;
      if (pwInput) pwInput.value = "";
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Erro" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
      <section className="rounded-3xl border border-ink-line bg-white p-8 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-ink">Os meus dados</h2>
            <p className="mt-1 text-sm text-ink-soft">{profile.email}</p>
          </div>
          <form method="POST" action="/api/account/logout">
            <button type="submit" className="text-xs font-medium text-rosa-500 hover:underline">
              Terminar sessão
            </button>
          </form>
        </div>

        <form id="profile-form" onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="p-name">
                Nome <span className="text-red-500" aria-hidden>*</span>
              </label>
              <input
                id="p-name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={validateName}
                required
                className="field-input"
                aria-invalid={nameError !== null}
              />
              {nameError && <p className="mt-1 text-xs text-red-600">{nameError}</p>}
            </div>
            <div>
              <label className="field-label" htmlFor="p-phone">Telemóvel</label>
              <input
                id="p-phone"
                name="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={validatePhone}
                className="field-input"
                autoComplete="tel"
                inputMode="tel"
                placeholder="9XX XXX XXX"
                aria-invalid={phoneError !== null}
              />
              {phoneError && <p className="mt-1 text-xs text-red-600">{phoneError}</p>}
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="p-addr">Morada</label>
            <input
              id="p-addr"
              name="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onBlur={validateAddress}
              className="field-input"
              autoComplete="street-address"
              aria-invalid={addressError !== null}
            />
            {addressError && <p className="mt-1 text-xs text-red-600">{addressError}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="p-postal">Código postal</label>
              <input
                id="p-postal"
                name="postalCode"
                value={postalCode}
                onChange={(e) => {
                  setPostalCode(e.target.value);
                  if (postalError) setPostalError(null);
                }}
                onBlur={validatePostal}
                className="field-input"
                autoComplete="postal-code"
                inputMode="numeric"
                placeholder="0000-000"
                aria-invalid={postalError !== null}
              />
              {postalBusy && <p className="mt-1 text-xs text-ink-muted">A verificar…</p>}
              {postalError && <p className="mt-1 text-xs text-red-600">{postalError}</p>}
            </div>
            <div>
              <label className="field-label" htmlFor="p-city">Localidade</label>
              <input
                id="p-city"
                name="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="field-input"
                autoComplete="address-level2"
              />
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="p-nif">NIF (opcional)</label>
            <input id="p-nif" name="nif" defaultValue={profile.nif ?? ""} inputMode="numeric" className="field-input" />
          </div>
          <div className="border-t border-ink-line pt-4">
            <label className="field-label" htmlFor="p-pw">Nova password (opcional)</label>
            <input id="p-pw" name="password" type="password" minLength={8} className="field-input" placeholder="Deixa vazio para manter" autoComplete="new-password" />
          </div>

          {message && (
            <div
              role="alert"
              className={`rounded-2xl border p-3 text-xs ${
                message.kind === "ok"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-rosa-300 bg-rosa-50 text-rosa-700"
              }`}
            >
              {message.text}
            </div>
          )}

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? "A guardar…" : "Guardar alterações"}
          </button>
        </form>
      </section>

      <section className="rounded-3xl border border-ink-line bg-white p-8 shadow-sm">
        <h2 className="text-xl font-semibold text-ink">As minhas encomendas</h2>
        {orders.length === 0 ? (
          <p className="mt-4 text-sm text-ink-soft">Ainda não tens encomendas.</p>
        ) : (
          <ul className="mt-5 divide-y divide-ink-line">
            {orders.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 py-4 text-sm">
                <div>
                  <p className="font-mono font-semibold text-ink">{o.number}</p>
                  <p className="text-xs text-ink-muted">{formatDate(o.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-ink">
                    {formatEuro(o.subtotalCents - (o.discountCents ?? 0))}
                  </p>
                  <p className="text-xs text-ink-muted">{STATUS_LABELS[o.status] ?? o.status}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
