import { useState } from "react";
import PasswordInput from "../admin/PasswordInput";

type Mode = "login" | "register";

export default function AccountForm() {
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const payload =
      mode === "login"
        ? {
            email: String(form.get("email") ?? ""),
            password: String(form.get("password") ?? ""),
          }
        : {
            email: String(form.get("email") ?? ""),
            name: String(form.get("name") ?? ""),
            password: String(form.get("password") ?? ""),
          };
    try {
      const res = await fetch(`/api/account/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      window.location.href = "/conta";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-ink-line bg-white p-8 shadow-sm">
      <div className="flex gap-2 rounded-full bg-rosa-50 p-1">
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
              mode === m
                ? "bg-white text-ink shadow-sm"
                : "text-ink-soft hover:text-rosa-500"
            }`}
          >
            {m === "login" ? "Entrar" : "Criar conta"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {mode === "register" && (
          <div>
            <label className="field-label" htmlFor="acc-name">Nome</label>
            <input id="acc-name" name="name" required maxLength={200} className="field-input" autoComplete="name" />
          </div>
        )}
        <div>
          <label className="field-label" htmlFor="acc-email">Email</label>
          <input
            id="acc-email"
            name="email"
            type="email"
            required
            className="field-input"
            autoComplete="email"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="acc-pw">Password</label>
          <PasswordInput
            id="acc-pw"
            name="password"
            required
            minLength={mode === "register" ? 8 : 1}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
          {mode === "register" && (
            <p className="mt-1 text-[11px] text-ink-muted">Mínimo 8 caracteres.</p>
          )}
        </div>

        {error && (
          <div role="alert" className="rounded-2xl border border-rosa-300 bg-rosa-50 p-3 text-xs text-rosa-700">
            {error}
          </div>
        )}

        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? "A processar…" : mode === "login" ? "Entrar" : "Criar conta"}
        </button>
      </form>
    </div>
  );
}
