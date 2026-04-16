import { useEffect, useState } from "react";

interface MediaItem {
  id: number;
  url: string;
  alt: string;
  tags: string;
}

interface Props {
  value: string;
  onChange: (url: string) => void;
  label?: string;
}

export default function ImagePicker({ value, onChange, label }: Props) {
  const [showGallery, setShowGallery] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Upload falhou (${res.status})`);
      }
      const { url } = await res.json() as { url: string };
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro no upload");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      {label && <label className="field-label">{label}</label>}
      <div className="mt-1 flex items-start gap-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-ink-line bg-rosa-50">
          {value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[10px] text-ink-muted">Sem imagem</span>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://… ou escolhe da galeria"
            className="field-input"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowGallery(true)}
              className="rounded-full border border-ink-line px-3 py-1 text-xs font-medium text-ink-soft hover:border-rosa-300 hover:text-rosa-500"
            >
              Escolher da galeria
            </button>
            <label className="cursor-pointer rounded-full border border-ink-line px-3 py-1 text-xs font-medium text-ink-soft hover:border-rosa-300 hover:text-rosa-500">
              {uploading ? "A carregar…" : "Carregar ficheiro"}
              <input
                type="file"
                accept="image/*"
                disabled={uploading}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                  e.target.value = "";
                }}
              />
            </label>
            {value && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="rounded-full border border-ink-line px-3 py-1 text-xs font-medium text-ink-muted hover:border-red-300 hover:text-red-500"
              >
                Limpar
              </button>
            )}
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </div>

      {showGallery && (
        <GalleryModal
          onClose={() => setShowGallery(false)}
          onPick={(url) => { onChange(url); setShowGallery(false); }}
        />
      )}
    </div>
  );
}

function GalleryModal({ onClose, onPick }: { onClose: () => void; onPick: (url: string) => void }) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    fetch("/api/admin/media")
      .then((r) => r.json())
      .then((rows: MediaItem[]) => { setItems(rows); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = items.filter((m) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return m.alt.toLowerCase().includes(q) || m.tags.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-line px-6 py-4">
          <h3 className="text-lg font-semibold text-ink">Galeria</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-ink-muted hover:text-rosa-500"
          >
            Fechar ✕
          </button>
        </div>
        <div className="border-b border-ink-line px-6 py-3">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrar por alt ou tag…"
            className="field-input"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <p className="text-center text-sm text-ink-muted">A carregar…</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-ink-muted">
              Sem imagens. Adiciona em <code>/admin/media</code>.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {filtered.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onPick(m.url)}
                  className="group overflow-hidden rounded-2xl border border-ink-line bg-surface text-left transition hover:border-rosa-300 hover:shadow"
                >
                  <div className="aspect-square w-full overflow-hidden bg-rosa-50">
                    <img src={m.url} alt={m.alt} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
                  </div>
                  <div className="p-2">
                    <p className="truncate text-xs font-medium text-ink" title={m.alt}>
                      {m.alt || "(sem alt)"}
                    </p>
                    {m.tags && <p className="truncate text-[10px] text-ink-muted">{m.tags}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
