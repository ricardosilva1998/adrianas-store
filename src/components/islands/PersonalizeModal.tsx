import { useEffect, useRef, useState } from "react";
import type { Personalization, PersonalizationAttachment } from "./stores/cart";

type ColorOption = {
  name: string;
  hex: string;
};

interface Props {
  productName: string;
  availableColors: ColorOption[];
  initial?: Personalization;
  onCancel: () => void;
  onConfirm: (p: Personalization) => void;
}

const MAX_CHARS = 100;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "application/pdf"];

export default function PersonalizeModal({
  productName,
  availableColors,
  initial,
  onCancel,
  onConfirm,
}: Props) {
  const [phrase, setPhrase] = useState(initial?.phrase ?? "");
  const [colors, setColors] = useState<string[]>(initial?.colors ?? []);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [attachment, setAttachment] = useState<PersonalizationAttachment | undefined>(
    initial?.attachment,
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onEsc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onEsc);
      document.body.style.overflow = "";
    };
  }, [onCancel]);

  const toggleColor = (hex: string) => {
    setColors((prev) =>
      prev.includes(hex) ? prev.filter((c) => c !== hex) : [...prev, hex],
    );
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    setUploadError(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setUploadError("Só são aceites ficheiros PNG, JPG ou PDF.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setUploadError("O ficheiro tem mais de 15 MB.");
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/personalization-upload", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Erro ${res.status}`);
      }
      const data = (await res.json()) as { url: string; kind: "image" | "pdf"; name: string };
      setAttachment({ url: data.url, kind: data.kind, name: data.name });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Erro no upload");
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = () => {
    setAttachment(undefined);
    setUploadError(null);
  };

  const remaining = MAX_CHARS - phrase.length;
  const isValid =
    phrase.trim().length > 0 ||
    description.trim().length > 0 ||
    attachment !== undefined;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    onConfirm({
      phrase: phrase.trim(),
      colors,
      description: description.trim(),
      attachment,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Personalizar ${productName}`}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Fechar"
        onClick={onCancel}
      />

      <form
        onSubmit={handleSubmit}
        className="relative z-10 flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-line px-6 py-5">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-rosa-500">
              Personalizar
            </span>
            <h2 className="mt-1 text-lg font-semibold text-ink">{productName}</h2>
          </div>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition hover:bg-rosa-50 hover:text-rosa-500"
            aria-label="Fechar"
            onClick={onCancel}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div>
            <label htmlFor="phrase" className="field-label">
              Frase ou texto
            </label>
            <textarea
              id="phrase"
              value={phrase}
              maxLength={MAX_CHARS}
              rows={3}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder="Ex: 'Mantém a calma e bebe café'"
              className="field-input resize-none"
            />
            <div className="mt-1 flex items-center justify-between">
              <span className="text-xs text-ink-muted">
                Máx. {MAX_CHARS} caracteres
              </span>
              <span
                className={`text-xs font-medium ${
                  remaining < 10 ? "text-rosa-500" : "text-ink-muted"
                }`}
              >
                {remaining}
              </span>
            </div>
          </div>

          {availableColors.length > 0 && (
            <div className="mt-6">
              <label className="field-label">Cores para a estampa</label>
              <p className="mt-1 text-xs text-ink-muted">
                Podes escolher uma ou várias cores.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {availableColors.map((c) => {
                  const active = colors.includes(c.hex);
                  return (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => toggleColor(c.hex)}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        active
                          ? "border-rosa-400 bg-rosa-50 text-rosa-500"
                          : "border-ink-line text-ink-soft hover:border-rosa-300"
                      }`}
                      aria-pressed={active}
                    >
                      <span
                        className="inline-block h-4 w-4 rounded-full border border-ink-line"
                        style={{ backgroundColor: c.hex }}
                      />
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-6">
            <label htmlFor="description" className="field-label">
              Descreve o teu desenho ou ideia
            </label>
            <textarea
              id="description"
              value={description}
              rows={4}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: um pequeno doodle de um gato com chapéu, no canto inferior direito"
              className="field-input resize-none"
            />
          </div>

          <div className="mt-6">
            <label className="field-label">Imagem ou PDF de referência (opcional)</label>
            <p className="mt-1 text-xs text-ink-muted">
              Aceita PNG, JPG ou PDF. Máx. 15 MB.
            </p>

            {attachment ? (
              <div className="mt-3 flex items-start gap-4 rounded-2xl border border-ink-line bg-rosa-50/40 p-3">
                {attachment.kind === "image" ? (
                  <img
                    src={attachment.url}
                    alt={attachment.name}
                    className="h-20 w-20 flex-shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-xl bg-rosa-100 text-rosa-600">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-8 w-8"
                      aria-hidden="true"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <path d="M14 2v6h6" />
                      <path d="M9 13h6M9 17h6" />
                    </svg>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink" title={attachment.name}>
                    {attachment.name}
                  </p>
                  <p className="mt-0.5 text-xs uppercase tracking-wide text-ink-muted">
                    {attachment.kind}
                  </p>
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-xs font-medium text-rosa-500 underline"
                  >
                    Ver ficheiro
                  </a>
                </div>
                <button
                  type="button"
                  onClick={removeAttachment}
                  className="text-xs font-medium text-rosa-500 underline"
                >
                  Remover
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="mt-3 inline-flex items-center gap-2 rounded-full border border-dashed border-ink-line px-4 py-2 text-sm font-medium text-ink-soft transition hover:border-rosa-300 hover:text-rosa-500 disabled:opacity-50"
              >
                {uploading ? "A carregar…" : "Adicionar imagem ou PDF"}
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
              onChange={handleFileChange}
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
            />

            {uploadError && (
              <p className="mt-2 text-xs font-medium text-red-600">{uploadError}</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-ink-line px-6 py-4">
          <p className="text-xs text-ink-muted">
            Preenche frase, descrição ou envia ficheiro.
          </p>
          <div className="flex items-center gap-3">
            <button type="button" className="btn-ghost" onClick={onCancel}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={!isValid || uploading}>
              Guardar personalização
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
