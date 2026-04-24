import { useState } from "react";
import { RichTextEditor } from "./RichTextEditor";

type Category =
  | "tote-bags"
  | "t-shirts"
  | "necessaire"
  | "frascos-vidro"
  | "porta-chaves"
  | "capas-telemovel"
  | "garrafas"
  | "porta-joias";

const CATEGORIES: Array<{ value: Category; label: string }> = [
  { value: "tote-bags", label: "Tote Bags" },
  { value: "t-shirts", label: "T-Shirts" },
  { value: "necessaire", label: "Bolsas Necessaire" },
  { value: "frascos-vidro", label: "Frascos de Vidro" },
  { value: "porta-chaves", label: "Porta-Chaves" },
  { value: "capas-telemovel", label: "Capas de Telemóvel" },
  { value: "garrafas", label: "Garrafas de Água" },
  { value: "porta-joias", label: "Porta-Joias" },
];

export type ProductFormData = {
  id?: number;
  slug: string;
  name: string;
  description: string;
  longDescription: string;
  priceCents: number;
  category: Category;
  stock: number;
  unlimitedStock: boolean;
  bestseller: boolean;
  personalizable: boolean;
  active: boolean;
  sortOrder: number;
  variantColorTitle: string;
  images: Array<{ url: string; alt: string }>;
  colors: Array<{ name: string; hex: string }>;
  variantColors: Array<{ name: string; hex: string }>;
};

interface Props {
  initial?: ProductFormData;
  mode: "create" | "edit";
}

const emptyProduct: ProductFormData = {
  slug: "",
  name: "",
  description: "",
  longDescription: "",
  priceCents: 0,
  category: "tote-bags",
  stock: 10,
  unlimitedStock: true,
  bestseller: false,
  personalizable: true,
  active: true,
  sortOrder: 0,
  variantColorTitle: "Cor do produto",
  images: [],
  colors: [],
  variantColors: [],
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export default function ProductForm({ initial, mode }: Props) {
  const [data, setData] = useState<ProductFormData>(initial ?? emptyProduct);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const update = <K extends keyof ProductFormData>(
    key: K,
    value: ProductFormData[K],
  ) => {
    setData((d) => ({ ...d, [key]: value }));
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Erro ${res.status}`);
      }
      const body = (await res.json()) as { url: string };
      update("images", [...data.images, { url: body.url, alt: "" }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no upload");
    } finally {
      setUploading(false);
    }
  };

  const handleImageUrlAdd = () => {
    const url = prompt("URL da imagem:");
    if (!url) return;
    update("images", [...data.images, { url, alt: "" }]);
  };

  const removeImage = (i: number) => {
    update(
      "images",
      data.images.filter((_, idx) => idx !== i),
    );
  };

  const moveImage = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= data.images.length) return;
    const next = [...data.images];
    [next[i], next[j]] = [next[j], next[i]];
    update("images", next);
  };

  const addColor = () => {
    update("colors", [...data.colors, { name: "", hex: "#F691B4" }]);
  };

  const updateColor = (i: number, field: "name" | "hex", value: string) => {
    const next = [...data.colors];
    next[i] = { ...next[i], [field]: value };
    update("colors", next);
  };

  const removeColor = (i: number) => {
    update(
      "colors",
      data.colors.filter((_, idx) => idx !== i),
    );
  };

  const addVariantColor = () => {
    update("variantColors", [...data.variantColors, { name: "", hex: "#111111" }]);
  };

  const updateVariantColor = (i: number, field: "name" | "hex", value: string) => {
    const next = [...data.variantColors];
    next[i] = { ...next[i], [field]: value };
    update("variantColors", next);
  };

  const removeVariantColor = (i: number) => {
    update(
      "variantColors",
      data.variantColors.filter((_, idx) => idx !== i),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!data.slug) update("slug", slugify(data.name));

    setSubmitting(true);
    try {
      const url =
        mode === "create"
          ? "/api/admin/products"
          : `/api/admin/products/${data.id}`;
      const method = mode === "create" ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          slug: data.slug || slugify(data.name),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Erro ${res.status}`);
      }

      window.location.href = "/admin/products";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao guardar");
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!data.id) return;
    if (
      !confirm(
        `Apagar o produto "${data.name}"? Esta ação não pode ser revertida.`,
      )
    ) {
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/products/${data.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Erro ao apagar");
      window.location.href = "/admin/products";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao apagar");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
      <div className="space-y-6">
        <section className="rounded-3xl border border-ink-line bg-surface p-6">
          <h2 className="text-lg font-semibold text-ink">Informação básica</h2>
          <div className="mt-5 grid gap-4">
            <div>
              <label className="field-label" htmlFor="name">Nome</label>
              <input
                id="name"
                value={data.name}
                onChange={(e) => {
                  update("name", e.target.value);
                  if (mode === "create") update("slug", slugify(e.target.value));
                }}
                required
                className="field-input"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="slug">Slug (URL)</label>
              <input
                id="slug"
                value={data.slug}
                onChange={(e) => update("slug", slugify(e.target.value))}
                required
                className="field-input font-mono"
              />
            </div>
            <div>
              <label className="field-label">Descrição curta</label>
              <div className="mt-2">
                <RichTextEditor
                  value={data.description}
                  onChange={(html) => update("description", html)}
                  minHeight={120}
                />
              </div>
            </div>
            <div>
              <label className="field-label">Descrição longa</label>
              <div className="mt-2">
                <RichTextEditor
                  value={data.longDescription}
                  onChange={(html) => update("longDescription", html)}
                  minHeight={240}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-ink-line bg-surface p-6">
          <h2 className="text-lg font-semibold text-ink">Imagens</h2>
          <p className="mt-1 text-xs text-ink-muted">
            Adiciona as fotos reais do produto. Podes fazer upload ou colar um URL externo.
          </p>

          <div className="mt-5 grid gap-3">
            {data.images.map((img, i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl border border-ink-line p-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-rosa-50">
                  <img src={img.url} alt={img.alt} className="h-full w-full object-cover" />
                </div>
                <div className="flex-1">
                  <p className="truncate text-xs text-ink-muted">{img.url}</p>
                  <input
                    value={img.alt}
                    onChange={(e) => {
                      const next = [...data.images];
                      next[i] = { ...next[i], alt: e.target.value };
                      update("images", next);
                    }}
                    placeholder="Texto alternativo (opcional)"
                    className="mt-1 w-full rounded-lg border border-ink-line px-2 py-1 text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => moveImage(i, -1)}
                    className="rounded-full border border-ink-line px-2 py-1 text-[10px] hover:bg-rosa-50"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveImage(i, 1)}
                    className="rounded-full border border-ink-line px-2 py-1 text-[10px] hover:bg-rosa-50"
                  >
                    ↓
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="text-xs text-rosa-500 hover:underline"
                >
                  Remover
                </button>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <label className="cursor-pointer rounded-full bg-rosa-400 px-4 py-2 text-xs font-medium text-white hover:bg-rosa-500">
              {uploading ? "A enviar…" : "+ Upload de imagem"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImageUpload(f);
                  e.target.value = "";
                }}
              />
            </label>
            <button
              type="button"
              onClick={handleImageUrlAdd}
              className="rounded-full border border-ink-line px-4 py-2 text-xs font-medium text-ink-soft hover:border-rosa-300 hover:text-rosa-500"
            >
              + Adicionar URL
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-ink-line bg-surface p-6">
          <h2 className="text-lg font-semibold text-ink">Cores disponíveis</h2>
          <p className="mt-1 text-xs text-ink-muted">
            Para peças personalizáveis (cores de estampa). Cliente pode escolher uma ou várias.
          </p>
          {data.colors.map((c, i) => (
            <div key={i} className="mt-3 flex items-center gap-3">
              <input
                type="color"
                value={c.hex}
                onChange={(e) => updateColor(i, "hex", e.target.value)}
                className="h-9 w-12 rounded border border-ink-line"
              />
              <input
                value={c.name}
                onChange={(e) => updateColor(i, "name", e.target.value)}
                placeholder="Nome (ex: Rosa)"
                className="flex-1 rounded-xl border border-ink-line px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => removeColor(i)}
                className="text-xs text-rosa-500 hover:underline"
              >
                Remover
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addColor}
            className="mt-4 rounded-full border border-ink-line px-4 py-2 text-xs font-medium text-ink-soft hover:border-rosa-300 hover:text-rosa-500"
          >
            + Adicionar cor
          </button>
        </section>

        <section className="rounded-3xl border border-ink-line bg-surface p-6">
          <h2 className="text-lg font-semibold text-ink">Cor do produto (variante)</h2>
          <p className="mt-1 text-xs text-ink-muted">
            Para produtos vendidos em várias cores físicas (ex: acessórios). Escolha única obrigatória no checkout. Deixa vazio se este produto não tem variantes de cor.
          </p>
          <div className="mt-4">
            <label className="field-label" htmlFor="variantColorTitle">
              Título mostrado na loja
            </label>
            <input
              id="variantColorTitle"
              value={data.variantColorTitle}
              onChange={(e) => update("variantColorTitle", e.target.value)}
              placeholder="Cor do produto"
              className="field-input"
            />
            <p className="mt-1 text-xs text-ink-muted">
              Aparece acima dos botões de cor na página do produto.
            </p>
          </div>
          {data.variantColors.map((c, i) => (
            <div key={i} className="mt-3 flex items-center gap-3">
              <input
                type="color"
                value={c.hex}
                onChange={(e) => updateVariantColor(i, "hex", e.target.value)}
                className="h-9 w-12 rounded border border-ink-line"
              />
              <input
                value={c.name}
                onChange={(e) => updateVariantColor(i, "name", e.target.value)}
                placeholder="Nome (ex: Preto)"
                className="flex-1 rounded-xl border border-ink-line px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => removeVariantColor(i)}
                className="text-xs text-rosa-500 hover:underline"
              >
                Remover
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addVariantColor}
            className="mt-4 rounded-full border border-ink-line px-4 py-2 text-xs font-medium text-ink-soft hover:border-rosa-300 hover:text-rosa-500"
          >
            + Adicionar cor
          </button>
        </section>
      </div>

      <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
        <section className="rounded-3xl border border-ink-line bg-surface p-6">
          <h2 className="text-lg font-semibold text-ink">Preço e stock</h2>
          <div className="mt-5 grid gap-4">
            <div>
              <label className="field-label" htmlFor="price">Preço (€)</label>
              <input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={(data.priceCents / 100).toFixed(2)}
                onChange={(e) => update("priceCents", Math.round(parseFloat(e.target.value || "0") * 100))}
                required
                className="field-input"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="category">Categoria</label>
              <select
                id="category"
                value={data.category}
                onChange={(e) => update("category", e.target.value as Category)}
                className="field-input"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={data.unlimitedStock}
                onChange={(e) => update("unlimitedStock", e.target.checked)}
                className="h-4 w-4 accent-rosa-500"
              />
              Stock ilimitado
            </label>
            {!data.unlimitedStock && (
              <div>
                <label className="field-label" htmlFor="stock">Stock disponível</label>
                <input
                  id="stock"
                  type="number"
                  min="0"
                  value={data.stock}
                  onChange={(e) => update("stock", parseInt(e.target.value || "0"))}
                  className="field-input"
                />
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-ink-line bg-surface p-6">
          <h2 className="text-lg font-semibold text-ink">Publicação</h2>
          <div className="mt-5 space-y-3 text-sm">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={data.active}
                onChange={(e) => update("active", e.target.checked)}
                className="h-4 w-4 accent-rosa-500"
              />
              Visível na loja
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={data.bestseller}
                onChange={(e) => update("bestseller", e.target.checked)}
                className="h-4 w-4 accent-rosa-500"
              />
              Marcar como bestseller (aparece na homepage)
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={data.personalizable}
                onChange={(e) => update("personalizable", e.target.checked)}
                className="h-4 w-4 accent-rosa-500"
              />
              Permitir personalização
            </label>
            <div>
              <label className="field-label" htmlFor="sortOrder">Ordem</label>
              <input
                id="sortOrder"
                type="number"
                value={data.sortOrder}
                onChange={(e) => update("sortOrder", parseInt(e.target.value || "0"))}
                className="field-input"
              />
            </div>
          </div>
        </section>

        {error && (
          <div
            role="alert"
            className="rounded-2xl border border-rosa-300 bg-rosa-50 p-4 text-sm text-rosa-700"
          >
            {error}
          </div>
        )}

        <div className="space-y-3">
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full"
          >
            {submitting ? "A guardar…" : mode === "create" ? "Criar produto" : "Guardar alterações"}
          </button>
          {mode === "edit" && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={submitting}
              className="w-full rounded-full border border-rosa-300 px-4 py-2.5 text-sm font-medium text-rosa-500 hover:bg-rosa-50"
            >
              Apagar produto
            </button>
          )}
        </div>
      </aside>
    </form>
  );
}
