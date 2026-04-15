import { useState } from "react";
import { marked } from "marked";

interface Props {
  slug: string;
  title: string;
  body: string;
}

export default function PageEditor({ slug, title: initialTitle, body: initialBody }: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const html = marked.parse(body, { async: false }) as string;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`/api/admin/pages/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      setSuccess(true);
      window.setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6">
      <div className="rounded-3xl border border-ink-line bg-white p-6">
        <label className="field-label" htmlFor="title">Título</label>
        <input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="field-input"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-ink-line bg-white p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Editor (Markdown)</h3>
            <span className="text-[10px] text-ink-muted">Suporta **negrito**, ## cabeçalhos, listas</span>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={24}
            className="mt-4 w-full resize-y rounded-xl border border-ink-line bg-white p-4 font-mono text-xs leading-relaxed"
          />
        </div>

        <div className="rounded-3xl border border-ink-line bg-white p-6">
          <h3 className="text-sm font-semibold text-ink">Preview</h3>
          <article
            className="prose prose-sm mt-4 max-w-none text-ink-soft"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          {error && <p className="text-xs text-rosa-600">{error}</p>}
          {success && <p className="text-xs text-emerald-600">Guardado!</p>}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-primary"
        >
          {saving ? "A guardar…" : "Guardar alterações"}
        </button>
      </div>
    </div>
  );
}
