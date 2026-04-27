import { useEffect, useState } from "react";
import type { Coupon } from "../../db/schema";

type DiscountKind = "percent" | "amount";

const formatEuro = (cents: number) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(cents / 100);

const formatDate = (d: Date | string | null): string => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "short" }).format(date);
};

const inputValueToISO = (raw: string): string | null => {
  if (!raw) return null;
  const d = new Date(`${raw}T23:59:59`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export default function CouponsManager() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<DiscountKind>("percent");
  const [percent, setPercent] = useState("10");
  const [amount, setAmount] = useState("5.00");
  const [minOrder, setMinOrder] = useState("0.00");
  const [validUntil, setValidUntil] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/coupons");
        if (!res.ok) throw new Error(`Erro ${res.status}`);
        const data = await res.json();
        setCoupons(data.coupons ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro a carregar cupões");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const payload: Record<string, unknown> = {
        code: code.trim(),
        description: description.trim(),
        minOrderCents: Math.round(parseFloat(minOrder || "0") * 100),
        active: true,
      };
      if (kind === "percent") {
        payload.percentOff = parseInt(percent, 10);
      } else {
        payload.amountOffCents = Math.round(parseFloat(amount || "0") * 100);
      }
      const validISO = inputValueToISO(validUntil);
      if (validISO) payload.validUntil = validISO;
      if (maxUses) payload.maxUses = parseInt(maxUses, 10);

      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      setCoupons([data.coupon, ...coupons]);
      setCode("");
      setDescription("");
      setPercent("10");
      setAmount("5.00");
      setMinOrder("0.00");
      setValidUntil("");
      setMaxUses("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro a criar cupão");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (c: Coupon) => {
    try {
      const res = await fetch(`/api/admin/coupons/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !c.active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      setCoupons(coupons.map((x) => (x.id === c.id ? data.coupon : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro a atualizar");
    }
  };

  const handleDelete = async (c: Coupon) => {
    if (!confirm(`Apagar cupão ${c.code}?`)) return;
    try {
      const res = await fetch(`/api/admin/coupons/${c.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      setCoupons(coupons.filter((x) => x.id !== c.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro a apagar");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div>
        {loading ? (
          <p className="text-sm text-ink-muted">A carregar cupões…</p>
        ) : coupons.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-ink-line bg-surface p-8 text-center text-sm text-ink-muted">
            Ainda não há cupões. Cria um na coluna ao lado.
          </div>
        ) : (
          <div className="rounded-3xl border border-ink-line bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-rosa-50/40 text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold">Código</th>
                  <th className="px-5 py-3 text-left font-semibold">Desconto</th>
                  <th className="px-5 py-3 text-left font-semibold">Mín.</th>
                  <th className="px-5 py-3 text-left font-semibold">Usos</th>
                  <th className="px-5 py-3 text-left font-semibold">Validade</th>
                  <th className="px-5 py-3 text-right font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c.id} className="border-t border-ink-line">
                    <td className="px-5 py-4">
                      <div className="font-mono font-semibold text-ink">{c.code}</div>
                      {c.description && (
                        <div className="text-[11px] text-ink-muted">{c.description}</div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-ink">
                      {c.percentOff != null
                        ? `${c.percentOff}%`
                        : c.amountOffCents != null
                          ? formatEuro(c.amountOffCents)
                          : "—"}
                    </td>
                    <td className="px-5 py-4 text-ink-soft">
                      {c.minOrderCents > 0 ? formatEuro(c.minOrderCents) : "—"}
                    </td>
                    <td className="px-5 py-4 text-ink-soft">
                      {c.usedCount}{c.maxUses != null ? ` / ${c.maxUses}` : ""}
                    </td>
                    <td className="px-5 py-4 text-ink-soft">{formatDate(c.validUntil)}</td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(c)}
                          className={`text-xs font-medium ${c.active ? "text-emerald-600" : "text-ink-muted"} hover:underline`}
                        >
                          {c.active ? "Ativo" : "Inativo"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(c)}
                          className="text-xs font-medium text-rosa-500 hover:underline"
                        >
                          Apagar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <aside className="rounded-3xl border border-ink-line bg-surface p-6">
        <h2 className="text-lg font-semibold text-ink">Criar cupão</h2>
        <form onSubmit={handleCreate} className="mt-5 space-y-4">
          <div>
            <label className="field-label" htmlFor="c-code">Código</label>
            <input
              id="c-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
              minLength={2}
              className="field-input font-mono uppercase"
              placeholder="PRIMEIRA10"
            />
            <p className="mt-1 text-[10px] text-ink-muted">Letras, números, hífen e underscore. Insensível a maiúsculas/minúsculas.</p>
          </div>

          <div>
            <label className="field-label" htmlFor="c-desc">Descrição (interna)</label>
            <input
              id="c-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="field-input"
              placeholder="Ex: 10% para primeira compra"
            />
          </div>

          <div>
            <label className="field-label">Tipo de desconto</label>
            <div className="mt-2 flex gap-2">
              {(["percent", "amount"] as const).map((k) => (
                <label
                  key={k}
                  className={`flex-1 cursor-pointer rounded-full border px-3 py-2 text-center text-xs font-medium transition ${
                    kind === k
                      ? "border-rosa-400 bg-rosa-500 text-white"
                      : "border-ink-line bg-surface text-ink-soft"
                  }`}
                >
                  <input
                    type="radio"
                    name="c-kind"
                    checked={kind === k}
                    onChange={() => setKind(k)}
                    className="sr-only"
                  />
                  {k === "percent" ? "Percentagem" : "Valor fixo (€)"}
                </label>
              ))}
            </div>
          </div>

          {kind === "percent" ? (
            <div>
              <label className="field-label" htmlFor="c-pct">Percentagem (%)</label>
              <input
                id="c-pct"
                type="number"
                min={1}
                max={100}
                step={1}
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                required
                className="field-input"
              />
            </div>
          ) : (
            <div>
              <label className="field-label" htmlFor="c-amt">Valor (€)</label>
              <input
                id="c-amt"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="field-input"
              />
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="c-min">Mín. compra (€)</label>
              <input
                id="c-min"
                type="number"
                min="0"
                step="0.01"
                value={minOrder}
                onChange={(e) => setMinOrder(e.target.value)}
                className="field-input"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="c-uses">Usos máximos</label>
              <input
                id="c-uses"
                type="number"
                min="1"
                step="1"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="Sem limite"
                className="field-input"
              />
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="c-until">Válido até</label>
            <input
              id="c-until"
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="field-input"
            />
            <p className="mt-1 text-[10px] text-ink-muted">Deixa vazio para sem data limite.</p>
          </div>

          {error && (
            <div className="rounded-2xl border border-rosa-300 bg-rosa-50 p-3 text-xs text-rosa-700 dark:bg-rosa-500/15 dark:text-rosa-200">
              {error}
            </div>
          )}

          <button type="submit" disabled={creating} className="btn-primary w-full">
            {creating ? "A criar…" : "Criar cupão"}
          </button>
        </form>
      </aside>
    </div>
  );
}
