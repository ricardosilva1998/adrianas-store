import { useEffect, useState } from "react";

interface MediaItem {
  id: number;
  url: string;
  alt: string;
  tags: string;
}

interface Props {
  value: string;
  kind: "image" | "video";
  onChange: (url: string, kind: "image" | "video") => void;
  label?: string;
}

// Companion to ImagePicker for blocks that may host either an image or a
// short video. The upload endpoint /api/admin/upload accepts both and
// reports the resolved kind; the picker reflects that kind in the preview
// thumbnail and forwards it to the caller so the storefront renderer can
// pick the right element (<img> vs <video>).
export default function MediaPicker({ value, kind, onChange, label }: Props) {
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
      const { url, kind: uploadedKind } = (await res.json()) as {
        url: string;
        kind?: "image" | "video";
      };
      onChange(url, uploadedKind ?? "image");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro no upload");
    } finally {
      setUploading(false);
    }
  };

  // Clearing leaves the kind at "image" so legacy block defaults still apply.
  const handleClear = () => onChange("", "image");

  return (
    <div>
      {label && <label className="field-label">{label}</label>}
      <div className="mt-1 flex items-start gap-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-ink-line bg-rosa-50">
          {value ? (
            kind === "video" ? (
              <video
                src={value}
                className="h-full w-full object-cover"
                muted
                playsInline
                preload="metadata"
              />
            ) : (
              <img src={value} alt="" className="h-full w-full object-cover" />
            )
          ) : (
            <span className="text-[10px] text-ink-muted">Sem media</span>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value, kind)}
            placeholder="https://… ou carrega um ficheiro"
            className="field-input"
          />
          <div>
            <label className="field-label">Tipo</label>
            <div className="mt-1 flex gap-2">
              {(["image", "video"] as const).map((k) => (
                <label
                  key={k}
                  className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition ${
                    kind === k
                      ? "border-rosa-400 bg-rosa-500 text-white"
                      : "border-ink-line bg-surface text-ink-soft"
                  }`}
                >
                  <input
                    type="radio"
                    name="media-kind"
                    value={k}
                    checked={kind === k}
                    onChange={() => onChange(value, k)}
                    className="sr-only"
                  />
                  {k === "image" ? "Imagem" : "Vídeo"}
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowGallery(true)}
              className="rounded-full border border-ink-line px-3 py-1 text-xs font-medium text-ink-soft hover:border-rosa-300 hover:text-rosa-500"
            >
              Escolher imagem da galeria
            </button>
            <label className="cursor-pointer rounded-full border border-ink-line px-3 py-1 text-xs font-medium text-ink-soft hover:border-rosa-300 hover:text-rosa-500">
              {uploading ? "A carregar…" : "Carregar imagem"}
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
            <label className="cursor-pointer rounded-full border border-ink-line px-3 py-1 text-xs font-medium text-ink-soft hover:border-rosa-300 hover:text-rosa-500">
              {uploading ? "A carregar…" : "Carregar vídeo"}
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
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
                onClick={handleClear}
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
          onPick={(url) => {
            onChange(url, "image");
            setShowGallery(false);
          }}
        />
      )}
    </div>
  );
}

function GalleryModal({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (url: string) => void;
}) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    fetch("/api/admin/media")
      .then((r) => r.json())
      .then((rows: MediaItem[]) => {
        setItems(rows);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = items.filter((m) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return m.alt.toLowerCase().includes(q) || m.tags.toLowerCase().includes(q);
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
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
                    <img
                      src={m.url}
                      alt={m.alt}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-2">
                    <p className="truncate text-xs font-medium text-ink" title={m.alt}>
                      {m.alt || "(sem alt)"}
                    </p>
                    {m.tags && (
                      <p className="truncate text-[10px] text-ink-muted">{m.tags}</p>
                    )}
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
