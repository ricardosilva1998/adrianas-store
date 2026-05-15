import { useState } from "react";
import PasswordInput from "../admin/PasswordInput";

interface Props {
  token: string;
}

export default function ResetPasswordForm({ token }: Props) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Link inválido — abre o email mais recente para usar o link correto.");
      return;
    }
    if (password.length < 8) {
      setError("A palavra-passe deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("A confirmação não coincide com a palavra-passe.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/account/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="mx-auto w-full max-w-md rounded-3xl border border-ink-line bg-white p-8 text-center shadow-sm">
        <h2 className="text-xl font-semibold text-ink">Palavra-passe alterada ✓</h2>
        <p className="mt-2 text-sm text-ink-soft">
          A tua palavra-passe foi reposta com sucesso. Já podes entrar com a nova.
        </p>
        <a href="/conta" className="btn-primary mt-6 inline-block">
          Ir para a conta
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-ink-line bg-white p-8 shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="field-label" htmlFor="rp-pw">Nova palavra-passe</label>
          <PasswordInput
            id="rp-pw"
            name="password"
            value={password}
            onChange={setPassword}
            required
            minLength={8}
            autoComplete="new-password"
          />
          <p className="mt-1 text-[11px] text-ink-muted">Mínimo 8 caracteres.</p>
        </div>
        <div>
          <label className="field-label" htmlFor="rp-pw-confirm">Confirmar palavra-passe</label>
          <PasswordInput
            id="rp-pw-confirm"
            name="confirm"
            value={confirm}
            onChange={setConfirm}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        {error && (
          <div role="alert" className="rounded-2xl border border-rosa-300 bg-rosa-50 p-3 text-xs text-rosa-700">
            {error}
          </div>
        )}

        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? "A guardar…" : "Definir nova palavra-passe"}
        </button>

        <p className="text-center text-xs text-ink-muted">
          <a href="/conta" className="hover:text-rosa-500 hover:underline">
            ← Voltar ao login
          </a>
        </p>
      </form>
    </div>
  );
}
