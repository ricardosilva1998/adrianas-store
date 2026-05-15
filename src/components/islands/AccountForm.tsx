import { useState } from "react";
import PasswordInput from "../admin/PasswordInput";

type Mode = "login" | "register" | "forgot";

export default function AccountForm() {
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const form = new FormData(e.currentTarget);
    try {
      if (mode === "forgot") {
        const res = await fetch("/api/account/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: String(form.get("email") ?? "") }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
        setInfo(
          data.message ??
            "Se existir uma conta com esse email, vais receber um email com instruções.",
        );
        return;
      }

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

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setInfo(null);
  };

  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-ink-line bg-white p-8 shadow-sm">
      {mode !== "forgot" && (
        <div className="flex gap-2 rounded-full bg-rosa-50 p-1">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
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
      )}

      {mode === "forgot" && (
        <div className="mb-2">
          <h2 className="text-lg font-semibold text-ink">Esqueci-me da palavra-passe</h2>
          <p className="mt-1 text-xs text-ink-soft">
            Indica o email da tua conta. Se existir, enviamos um link para definires uma nova palavra-passe.
          </p>
        </div>
      )}

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
        {mode !== "forgot" && (
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
            {mode === "login" && (
              <p className="mt-2 text-right text-xs">
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="text-ink-soft underline-offset-2 hover:text-rosa-500 hover:underline"
                >
                  Esqueci-me da palavra-passe
                </button>
              </p>
            )}
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-2xl border border-rosa-300 bg-rosa-50 p-3 text-xs text-rosa-700">
            {error}
          </div>
        )}
        {info && (
          <div role="status" className="rounded-2xl border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-700">
            {info}
          </div>
        )}

        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy
            ? "A processar…"
            : mode === "login"
              ? "Entrar"
              : mode === "register"
                ? "Criar conta"
                : "Enviar email de reposição"}
        </button>

        {mode === "forgot" && (
          <p className="text-center text-xs text-ink-muted">
            <button
              type="button"
              onClick={() => switchMode("login")}
              className="hover:text-rosa-500 hover:underline"
            >
              ← Voltar ao login
            </button>
          </p>
        )}
      </form>
    </div>
  );
}
