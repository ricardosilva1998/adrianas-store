import { useState } from "react";
import type { OrderStatus } from "../../db/schema";

const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Nova",
  paid: "Paga",
  preparing: "Em preparação",
  shipped: "Enviada",
  delivered: "Entregue",
  cancelled: "Cancelada",
};

interface Props {
  orderId: number;
  currentStatus: OrderStatus;
  currentTracking: string | null;
  allowedTransitions: OrderStatus[];
}

export default function OrderActions({
  orderId,
  currentStatus,
  currentTracking,
  allowedTransitions,
}: Props) {
  const [status] = useState(currentStatus);
  const [tracking, setTracking] = useState(currentTracking ?? "");
  const [submitting, setSubmitting] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTransition = async (to: OrderStatus) => {
    if (to === "shipped" && !tracking.trim()) {
      setError("Indica o código de tracking antes de marcar como enviada.");
      return;
    }

    if (
      to === "cancelled" &&
      !confirm(
        "Tens a certeza que queres cancelar esta encomenda? Esta ação não pode ser revertida.",
      )
    ) {
      return;
    }

    setSubmitting(to);
    setError(null);

    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          trackingCode: to === "shipped" ? tracking.trim() : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data && (data.error as string)) || `Erro ${res.status}`,
        );
      }

      window.location.reload();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Erro ao atualizar estado",
      );
      setSubmitting(null);
    }
  };

  return (
    <div className="rounded-3xl border border-ink-line bg-surface p-6">
      <h3 className="text-lg font-semibold text-ink">Ações</h3>

      {status === "shipped" || status === "delivered" || status === "cancelled" ? (
        <p className="mt-3 text-xs text-ink-muted">
          Estado final. Sem mais transições disponíveis.
        </p>
      ) : (
        <>
          {allowedTransitions.includes("shipped") && (
            <div className="mt-4">
              <label className="field-label" htmlFor="tracking">
                Código de tracking CTT
              </label>
              <input
                id="tracking"
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                placeholder="RR000000000PT"
                className="field-input uppercase"
              />
            </div>
          )}

          <div className="mt-4 space-y-2">
            {allowedTransitions.map((to) => (
              <button
                key={to}
                type="button"
                disabled={Boolean(submitting)}
                onClick={() => handleTransition(to)}
                className={`w-full rounded-full px-4 py-2.5 text-sm font-medium transition ${
                  to === "cancelled"
                    ? "border border-ink-line text-ink hover:bg-ink hover:text-white"
                    : "bg-rosa-400 text-white hover:bg-rosa-500"
                } ${submitting === to ? "opacity-60" : ""}`}
              >
                {submitting === to
                  ? "A processar…"
                  : to === "cancelled"
                    ? "Cancelar encomenda"
                    : `Marcar como ${STATUS_LABELS[to].toLowerCase()}`}
              </button>
            ))}
          </div>
        </>
      )}

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-2xl border border-rosa-300 bg-rosa-50 p-3 text-xs text-rosa-700"
        >
          {error}
        </div>
      )}
    </div>
  );
}
