import { useState } from "react";
import PasswordInput from "./PasswordInput";

type User = {
  id: number;
  email: string;
  name: string;
  role: "admin" | "editor";
};

interface Props {
  users: User[];
  currentUserId: number;
}

export default function UsersManager({ users: initial, currentUserId }: Props) {
  const [users, setUsers] = useState(initial);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setCreating(true);

    const form = new FormData(e.currentTarget);
    const payload = {
      email: String(form.get("email") ?? "").trim(),
      name: String(form.get("name") ?? "").trim(),
      password: String(form.get("password") ?? ""),
      role: String(form.get("role") ?? "editor") as "admin" | "editor",
    };

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      setUsers([...users, data.user]);
      e.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (id === currentUserId) {
      setError("Não podes apagar a tua própria conta.");
      return;
    }
    if (!confirm("Apagar este utilizador?")) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      setUsers(users.filter((u) => u.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao apagar");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div className="rounded-3xl border border-ink-line bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-rosa-50/40 text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-6 py-3 text-left font-semibold">Nome</th>
              <th className="px-6 py-3 text-left font-semibold">Role</th>
              <th className="px-6 py-3 text-right font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-ink-line">
                <td className="px-6 py-4">
                  <div className="font-medium text-ink">{u.name}</div>
                  <div className="text-xs text-ink-muted">{u.email}</div>
                </td>
                <td className="px-6 py-4 text-xs">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${
                      u.role === "admin"
                        ? "bg-rosa-500 text-white"
                        : "bg-blue-100 text-blue-600"
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  {u.id !== currentUserId && (
                    <button
                      type="button"
                      onClick={() => handleDelete(u.id)}
                      className="text-xs font-medium text-rosa-500 hover:underline"
                    >
                      Remover
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <aside className="rounded-3xl border border-ink-line bg-surface p-6">
        <h2 className="text-lg font-semibold text-ink">Adicionar utilizador</h2>
        <form onSubmit={handleCreate} className="mt-5 space-y-4">
          <div>
            <label className="field-label" htmlFor="u-name">Nome</label>
            <input id="u-name" name="name" required className="field-input" />
          </div>
          <div>
            <label className="field-label" htmlFor="u-email">Email</label>
            <input
              id="u-email"
              name="email"
              type="email"
              required
              className="field-input"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="u-pw">Password inicial</label>
            <PasswordInput
              id="u-pw"
              name="password"
              required
              autoComplete="new-password"
              className="field-input font-mono"
            />
            <p className="mt-1 text-[10px] text-ink-muted">
              Mínimo 8 caracteres. Clica no olho para veres o que escreveste antes de enviar.
            </p>
          </div>
          <div>
            <label className="field-label" htmlFor="u-role">Role</label>
            <select id="u-role" name="role" className="field-input" defaultValue="editor">
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {error && (
            <div className="rounded-2xl border border-rosa-300 bg-rosa-50 p-3 text-xs text-rosa-700 dark:bg-rosa-500/15 dark:text-rosa-200">
              {error}
            </div>
          )}

          <button type="submit" disabled={creating} className="btn-primary w-full">
            {creating ? "A criar…" : "Criar utilizador"}
          </button>
        </form>
      </aside>
    </div>
  );
}
