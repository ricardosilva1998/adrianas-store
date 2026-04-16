import { useState } from "react";

interface MediaItem {
  id: number;
  url: string;
  alt: string;
  tags: string;
  isPlaceholder: boolean;
  createdAt: string | Date;
}

interface Props {
  initial: MediaItem[];
}

export default function MediaGallery({ initial }: Props) {
  const [items, setItems] = useState<MediaItem[]>(initial);
  const [filter, setFilter] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [showAddUrl, setShowAddUrl] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newAlt, setNewAlt] = useState("");
  const [newTags, setNewTags] = useState("");
  const [error, setError] = useState<string | null>(null);

  const filtered = items.filter((m) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return m.alt.toLowerCase().includes(q) || m.tags.toLowerCase().includes(q);
  });

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const upRes = await fetch("/api/admin/upload", { method: "POST", body: fd });
      if (!upRes.ok) {
        const body = await upRes.json().catch(() => ({}));
        throw new Error(body.error ?? `Upload falhou (${upRes.status})`);
      }
      const { url } = await upRes.json() as { url: string };

      const addRes = await fetch("/api/admin/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, alt: file.name.replace(/\.[^.]+$/, ""), tags: "" }),
      });
      if (!addRes.ok) {
        const body = await addRes.json().catch(() => ({}));
        throw new Error(body.error ?? "Erro ao registar na galeria");
      }
      const row = await addRes.json() as MediaItem;
      setItems((prev) => [row, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro no upload");
    } finally {
      setUploading(false);
    }
  };

  const handleAddUrl = async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newUrl, alt: newAlt, tags: newTags }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Erro ${res.status}`);
      }
      const row = await res.json() as MediaItem;
      setItems((prev) => [row, ...prev]);
      setNewUrl(""); setNewAlt(""); setNewTags(""); setShowAddUrl(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Remover esta imagem da galeria?")) return;
    await fetch(`/api/admin/media/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((m) => m.id !== id));
  };

  const handleCopy = async (id: number, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* ignore */ }
  };

  return (
    <div className="grid gap-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-ink-line bg-white p-4">
        <input
          type="text"
          placeholder="Filtrar por alt ou tag..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="field-input flex-1 min-w-[200px]"
        />
        <label className="btn-secondary cursor-pointer text-xs">
          {uploading ? "A enviar..." : "Carregar imagem"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              e.target.value = "";
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => setShowAddUrl((v) => !v)}
          className="btn-secondary text-xs"
        >
          {showAddUrl ? "Cancelar" : "Adicionar URL"}
        </button>
      </div>

      {showAddUrl && (
        <div className="grid gap-3 rounded-3xl border border-dashed border-rosa-300 bg-rosa-50/60 p-6">
          <input
            type="url"
            placeholder="https://exemplo.com/imagem.jpg"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className="field-input"
          />
          <input
            type="text"
            placeholder="Texto alternativo (opcional)"
            value={newAlt}
            onChange={(e) => setNewAlt(e.target.value)}
            className="field-input"
          />
          <input
            type="text"
            placeholder="Tags separadas por vírgula (opcional)"
            value={newTags}
            onChange={(e) => setNewTags(e.target.value)}
            className="field-input"
          />
          <button type="button" onClick={handleAddUrl} className="btn-primary self-start">
            Adicionar
          </button>
        </div>
      )}

      {error && <p className="text-xs text-rosa-600">{error}</p>}

      {filtered.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-ink-line bg-rosa-50/30 p-12 text-center text-sm text-ink-muted">
          {filter ? "Sem resultados para o filtro." : "A galeria está vazia."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((m) => (
            <div key={m.id} className="group relative overflow-hidden rounded-2xl border border-ink-line bg-white">
              <div className="aspect-square w-full overflow-hidden bg-rosa-50">
                <img src={m.url} alt={m.alt} className="h-full w-full object-cover" loading="lazy" />
              </div>
              <div className="p-3">
                <p className="truncate text-xs font-medium text-ink" title={m.alt}>{m.alt || "(sem alt)"}</p>
                {m.tags && <p className="mt-0.5 truncate text-[10px] text-ink-muted">{m.tags}</p>}
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(m.id, m.url)}
                    className="flex-1 rounded-lg border border-ink-line px-2 py-1 text-[10px] font-medium text-ink-soft hover:border-rosa-300 hover:text-rosa-500"
                  >
                    {copied === m.id ? "Copiado!" : "Copiar URL"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(m.id)}
                    className="rounded-lg border border-ink-line px-2 py-1 text-[10px] text-ink-muted hover:border-red-300 hover:text-red-500"
                    title="Remover"
                  >
                    ✕
                  </button>
                </div>
                {m.isPlaceholder && (
                  <span className="mt-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700">
                    Placeholder
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
