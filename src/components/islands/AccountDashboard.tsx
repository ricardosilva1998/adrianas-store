import { useState } from "react";

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    const payload: Record<string, unknown> = {
      name: String(form.get("name") ?? ""),
      phone: String(form.get("phone") ?? ""),
      address: String(form.get("address") ?? ""),
      postalCode: String(form.get("postalCode") ?? ""),
      city: String(form.get("city") ?? ""),
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
              <label className="field-label" htmlFor="p-name">Nome</label>
              <input id="p-name" name="name" defaultValue={profile.name} required className="field-input" />
            </div>
            <div>
              <label className="field-label" htmlFor="p-phone">Telefone</label>
              <input id="p-phone" name="phone" defaultValue={profile.phone} className="field-input" autoComplete="tel" />
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="p-addr">Morada</label>
            <input id="p-addr" name="address" defaultValue={profile.address} className="field-input" autoComplete="street-address" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="p-postal">Código postal</label>
              <input id="p-postal" name="postalCode" defaultValue={profile.postalCode} className="field-input" autoComplete="postal-code" placeholder="0000-000" />
            </div>
            <div>
              <label className="field-label" htmlFor="p-city">Localidade</label>
              <input id="p-city" name="city" defaultValue={profile.city} className="field-input" autoComplete="address-level2" />
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
