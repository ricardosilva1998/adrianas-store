import { useState } from "react";
import PersonalizeModal from "./PersonalizeModal";
import { addToCart, type Personalization, type VariantColor } from "./stores/cart";

type ColorOption = { name: string; hex: string };

interface ProductInput {
  slug: string;
  name: string;
  price: number;
  image: string;
  category: string;
  personalizable: boolean;
  availableColors: ColorOption[];
  variantColors?: ColorOption[];
}

interface Props {
  product: ProductInput;
}

export default function ProductActions({ product }: Props) {
  const variantColors = product.variantColors ?? [];
  const requireVariant = variantColors.length > 0;

  const [quantity, setQuantity] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [personalization, setPersonalization] = useState<
    Personalization | undefined
  >(undefined);
  const [selectedVariant, setSelectedVariant] = useState<VariantColor | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const canAdd = !requireVariant || selectedVariant !== null;

  const handleAdd = (includePersonalization: boolean) => {
    if (!canAdd) {
      setFeedback("Escolhe uma cor antes de adicionar.");
      window.setTimeout(() => setFeedback(null), 3000);
      return;
    }
    addToCart({
      productSlug: product.slug,
      name: product.name,
      price: product.price,
      quantity,
      image: product.image,
      category: product.category,
      personalization:
        includePersonalization && personalization ? personalization : undefined,
      variantColor: selectedVariant ?? undefined,
    });
    setFeedback(
      includePersonalization && personalization
        ? "Adicionado ao carrinho com personalização."
        : "Adicionado ao carrinho.",
    );
    window.setTimeout(() => setFeedback(null), 3000);
  };

  const dec = () => setQuantity((q) => Math.max(1, q - 1));
  const inc = () => setQuantity((q) => Math.min(20, q + 1));

  return (
    <div className="flex flex-col gap-4">
      {requireVariant && (
        <div>
          <p className="field-label">Cor do produto</p>
          <p className="mt-1 text-xs text-ink-muted">Escolhe uma cor.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {variantColors.map((c) => {
              const active = selectedVariant?.hex === c.hex;
              return (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setSelectedVariant({ name: c.name, hex: c.hex })}
                  aria-pressed={active}
                  aria-label={`Escolher cor ${c.name}`}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? "border-rosa-400 bg-rosa-50 text-rosa-600 ring-2 ring-rosa-400"
                      : "border-ink-line text-ink-soft hover:border-rosa-300"
                  }`}
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

      <div className="flex items-center gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-ink-line bg-white p-1 text-ink">
          <button
            type="button"
            onClick={dec}
            aria-label="Diminuir quantidade"
            className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-rosa-50 hover:text-rosa-500"
          >
            −
          </button>
          <span className="w-8 text-center text-sm font-semibold">
            {quantity}
          </span>
          <button
            type="button"
            onClick={inc}
            aria-label="Aumentar quantidade"
            className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-rosa-50 hover:text-rosa-500"
          >
            +
          </button>
        </div>
        <span className="text-xs text-ink-muted">Quantidade</span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          className="btn-primary flex-1 disabled:opacity-60 disabled:cursor-not-allowed"
          onClick={() => handleAdd(Boolean(personalization))}
          disabled={!canAdd}
          title={!canAdd ? "Escolhe uma cor primeiro" : undefined}
        >
          Adicionar ao carrinho
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
        </button>

        {product.personalizable && (
          <button
            type="button"
            className="btn-secondary flex-1"
            onClick={() => setModalOpen(true)}
          >
            {personalization ? "Editar personalização" : "Personalizar"}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            </svg>
          </button>
        )}
      </div>

      {personalization && (
        <div className="rounded-2xl border border-rosa-200 bg-rosa-50/60 p-4 text-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-rosa-500">
                Personalização guardada
              </p>
              {personalization.phrase && (
                <p className="mt-2 font-medium text-ink">
                  “{personalization.phrase}”
                </p>
              )}
              {personalization.description && (
                <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                  {personalization.description}
                </p>
              )}
              {personalization.colors.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {personalization.colors.map((hex) => (
                    <span
                      key={hex}
                      className="h-5 w-5 rounded-full border border-ink-line"
                      style={{ backgroundColor: hex }}
                      aria-label={hex}
                    />
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              className="text-xs font-medium text-rosa-500 underline"
              onClick={() => setPersonalization(undefined)}
            >
              Remover
            </button>
          </div>
        </div>
      )}

      {feedback && (
        <div
          role="status"
          className="rounded-2xl border border-rosa-200 bg-rosa-50 px-4 py-3 text-xs text-rosa-600"
        >
          {feedback} <a href="/carrinho" className="font-semibold underline">Ver carrinho →</a>
        </div>
      )}

      {modalOpen && (
        <PersonalizeModal
          productName={product.name}
          availableColors={product.availableColors}
          initial={personalization}
          onCancel={() => setModalOpen(false)}
          onConfirm={(p) => {
            setPersonalization(p);
            setModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
