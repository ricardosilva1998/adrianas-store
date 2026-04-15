import { useEffect, useState } from "react";
import type { Personalization } from "./stores/cart";

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

  const remaining = MAX_CHARS - phrase.length;
  const isValid = phrase.trim().length > 0 || description.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    onConfirm({ phrase: phrase.trim(), colors, description: description.trim() });
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
            <p className="mt-1 text-xs text-ink-muted">
              Se tiveres uma imagem de referência, podes enviar depois por email.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-ink-line px-6 py-4">
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={!isValid}>
            Guardar personalização
          </button>
        </div>
      </form>
    </div>
  );
}
