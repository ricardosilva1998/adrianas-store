import { useState } from "react";
import { marked } from "marked";
import type { Block, BlockType } from "../../lib/blocks";
import { BLOCK_TYPES, createBlock } from "../../lib/blocks";

interface Props {
  slug: string;
  title: string;
  blocks: Block[];
  published: boolean;
  mode: "create" | "edit";
}

export default function BlockEditor({
  slug: initialSlug,
  title: initialTitle,
  blocks: initialBlocks,
  published: initialPublished,
  mode,
}: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [slug, setSlug] = useState(initialSlug);
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [published, setPublished] = useState(initialPublished);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [expandedBlock, setExpandedBlock] = useState<string | null>(
    initialBlocks[0]?.id ?? null,
  );
  const [showPicker, setShowPicker] = useState(false);

  const updateBlock = (id: string, data: any) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, data: { ...b.data, ...data } } : b)),
    );
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const moveBlock = (id: string, direction: "up" | "down") => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx === -1) return prev;
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
      return copy;
    });
  };

  const addBlock = (type: BlockType) => {
    const block = createBlock(type);
    setBlocks((prev) => [...prev, block]);
    setExpandedBlock(block.id);
    setShowPicker(false);
  };

  const autoSlug = (value: string) => {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (mode === "create") {
      setSlug(autoSlug(value));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const url =
        mode === "create" ? "/api/admin/pages" : `/api/admin/pages/${initialSlug}`;
      const method = mode === "create" ? "POST" : "PUT";
      const payload: any = { title, blocks, published };
      if (mode === "create") payload.slug = slug;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erro ${res.status}`);
      }

      if (mode === "create") {
        const data = await res.json();
        window.location.href = `/admin/pages/${data.slug}`;
        return;
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao guardar");
    } finally {
      setSaving(false);
    }
  };

  const blockLabel = (type: BlockType) =>
    BLOCK_TYPES.find((bt) => bt.type === type)?.label ?? type;

  return (
    <div className="grid gap-6">
      {/* Page settings */}
      <div className="rounded-3xl border border-ink-line bg-white p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="title">Titulo</label>
            <input
              id="title"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="field-input"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="slug">Slug (URL)</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-ink-muted">/</span>
              <input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="field-input"
                readOnly={mode === "edit"}
              />
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              className="h-4 w-4 rounded border-ink-line text-rosa-500 focus:ring-rosa-500"
            />
            Publicado
          </label>
        </div>
      </div>

      {/* Block list */}
      <div className="grid gap-4">
        {blocks.map((block, idx) => (
          <div
            key={block.id}
            className="rounded-3xl border border-ink-line bg-white"
          >
            {/* Block header */}
            <div
              className="flex cursor-pointer items-center justify-between px-6 py-4"
              onClick={() =>
                setExpandedBlock(expandedBlock === block.id ? null : block.id)
              }
            >
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-rosa-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-rosa-600">
                  {blockLabel(block.type)}
                </span>
                <span className="text-xs text-ink-muted">
                  {expandedBlock === block.id ? "▼" : "▶"}
                </span>
              </div>
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => moveBlock(block.id, "up")}
                  disabled={idx === 0}
                  className="rounded-lg p-1.5 text-ink-muted hover:bg-rosa-50 hover:text-rosa-500 disabled:opacity-30"
                  title="Mover para cima"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveBlock(block.id, "down")}
                  disabled={idx === blocks.length - 1}
                  className="rounded-lg p-1.5 text-ink-muted hover:bg-rosa-50 hover:text-rosa-500 disabled:opacity-30"
                  title="Mover para baixo"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeBlock(block.id)}
                  className="rounded-lg p-1.5 text-ink-muted hover:bg-red-50 hover:text-red-500"
                  title="Remover bloco"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Block form (expanded) */}
            {expandedBlock === block.id && (
              <div className="border-t border-ink-line px-6 py-5">
                <BlockForm block={block} onChange={(data) => updateBlock(block.id, data)} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add block button / picker */}
      {showPicker ? (
        <div className="rounded-3xl border border-dashed border-rosa-300 bg-rosa-50/60 p-6">
          <h4 className="mb-4 text-sm font-semibold text-ink">Adicionar bloco</h4>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {BLOCK_TYPES.map((bt) => (
              <button
                key={bt.type}
                type="button"
                onClick={() => addBlock(bt.type)}
                className="rounded-2xl border border-ink-line bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-rosa-300 hover:shadow"
              >
                <span className="text-sm font-semibold text-ink">{bt.label}</span>
                <p className="mt-1 text-[11px] text-ink-muted">{bt.description}</p>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowPicker(false)}
            className="mt-4 text-xs text-ink-muted hover:text-rosa-500"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="w-full rounded-3xl border border-dashed border-ink-line p-4 text-sm text-ink-muted transition hover:border-rosa-300 hover:text-rosa-500"
        >
          + Adicionar bloco
        </button>
      )}

      {/* Save bar */}
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
          {saving ? "A guardar..." : mode === "create" ? "Criar pagina" : "Guardar alteracoes"}
        </button>
      </div>
    </div>
  );
}

// --- Per-block-type forms ---

function BlockForm({ block, onChange }: { block: Block; onChange: (data: any) => void }) {
  switch (block.type) {
    case "hero":
      return <HeroForm data={block.data} onChange={onChange} />;
    case "text":
      return <TextForm data={block.data} onChange={onChange} />;
    case "product-grid":
      return <ProductGridForm data={block.data} onChange={onChange} />;
    case "category-grid":
      return <CategoryGridForm data={block.data} onChange={onChange} />;
    case "image-gallery":
      return <ImageGalleryForm data={block.data} onChange={onChange} />;
    case "cta-banner":
      return <CtaBannerForm data={block.data} onChange={onChange} />;
    case "faq":
      return <FaqForm data={block.data} onChange={onChange} />;
    case "contact-info":
      return <ContactInfoForm data={block.data} onChange={onChange} />;
    case "testimonials":
      return <TestimonialsForm data={block.data} onChange={onChange} />;
    case "newsletter":
      return <NewsletterForm data={block.data} onChange={onChange} />;
    case "image-text-split":
      return <ImageTextSplitForm data={block.data} onChange={onChange} />;
    case "video-embed":
      return <VideoEmbedForm data={block.data} onChange={onChange} />;
    case "divider":
      return <DividerForm data={block.data} onChange={onChange} />;
  }
}

function HeroForm({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  return (
    <div className="grid gap-4">
      <div>
        <label className="field-label">Titulo</label>
        <input value={data.title} onChange={(e) => onChange({ title: e.target.value })} className="field-input" />
      </div>
      <div>
        <label className="field-label">Subtitulo</label>
        <input value={data.subtitle} onChange={(e) => onChange({ subtitle: e.target.value })} className="field-input" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="field-label">Texto do botao</label>
          <input value={data.buttonText} onChange={(e) => onChange({ buttonText: e.target.value })} className="field-input" />
        </div>
        <div>
          <label className="field-label">URL do botao</label>
          <input value={data.buttonUrl} onChange={(e) => onChange({ buttonUrl: e.target.value })} className="field-input" />
        </div>
      </div>
      <div>
        <label className="field-label">URL da imagem</label>
        <input value={data.imageUrl} onChange={(e) => onChange({ imageUrl: e.target.value })} className="field-input" />
      </div>
    </div>
  );
}

function TextForm({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const html = marked.parse(data.markdown || "", { async: false }) as string;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <label className="field-label">Conteudo (Markdown)</label>
        <textarea
          value={data.markdown}
          onChange={(e) => onChange({ markdown: e.target.value })}
          rows={16}
          className="mt-2 w-full resize-y rounded-xl border border-ink-line bg-white p-4 font-mono text-xs leading-relaxed"
        />
      </div>
      <div>
        <span className="field-label">Preview</span>
        <article
          className="prose prose-sm mt-2 max-w-none text-ink-soft"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}

const CATEGORIES = [
  { value: "tote-bags", label: "Tote Bags" },
  { value: "t-shirts", label: "T-Shirts" },
  { value: "necessaire", label: "Bolsas Necessaire" },
  { value: "frascos-vidro", label: "Frascos de Vidro" },
  { value: "porta-chaves", label: "Porta-Chaves" },
  { value: "capas-telemovel", label: "Capas de Telemovel" },
  { value: "garrafas", label: "Garrafas de Agua" },
  { value: "porta-joias", label: "Porta-Joias" },
];

function ProductGridForm({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  return (
    <div className="grid gap-4">
      <div>
        <label className="field-label">Titulo</label>
        <input value={data.title} onChange={(e) => onChange({ title: e.target.value })} className="field-input" />
      </div>
      <div>
        <label className="field-label">Subtitulo</label>
        <input value={data.subtitle} onChange={(e) => onChange({ subtitle: e.target.value })} className="field-input" />
      </div>
      <div>
        <label className="field-label">Filtro</label>
        <select
          value={data.filter}
          onChange={(e) => onChange({ filter: e.target.value })}
          className="field-input"
        >
          <option value="bestsellers">Mais vendidos</option>
          <option value="all">Todos</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={`category:${c.value}`}>
              Categoria: {c.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function CategoryGridForm({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const toggleCategory = (slug: string) => {
    const current: string[] = data.categories ?? [];
    const next = current.includes(slug)
      ? current.filter((c: string) => c !== slug)
      : [...current, slug];
    onChange({ categories: next });
  };

  return (
    <div className="grid gap-4">
      <div>
        <label className="field-label">Titulo</label>
        <input value={data.title} onChange={(e) => onChange({ title: e.target.value })} className="field-input" />
      </div>
      <div>
        <label className="field-label">Subtitulo</label>
        <input value={data.subtitle} onChange={(e) => onChange({ subtitle: e.target.value })} className="field-input" />
      </div>
      <div>
        <label className="field-label">Categorias</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <label
              key={c.value}
              className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                (data.categories ?? []).includes(c.value)
                  ? "border-rosa-300 bg-rosa-100 text-rosa-600"
                  : "border-ink-line bg-white text-ink-muted hover:border-rosa-200"
              }`}
            >
              <input
                type="checkbox"
                checked={(data.categories ?? []).includes(c.value)}
                onChange={() => toggleCategory(c.value)}
                className="sr-only"
              />
              {c.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function ImageGalleryForm({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const images: Array<{ url: string; alt: string }> = data.images ?? [];
  const [newUrl, setNewUrl] = useState("");

  const addImage = () => {
    if (!newUrl.trim()) return;
    onChange({ images: [...images, { url: newUrl.trim(), alt: "" }] });
    setNewUrl("");
  };

  const removeImage = (idx: number) => {
    onChange({ images: images.filter((_: any, i: number) => i !== idx) });
  };

  const updateAlt = (idx: number, alt: string) => {
    onChange({ images: images.map((img: any, i: number) => (i === idx ? { ...img, alt } : img)) });
  };

  const moveImage = (idx: number, direction: "up" | "down") => {
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= images.length) return;
    const copy = [...images];
    [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
    onChange({ images: copy });
  };

  const handleUpload = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
    if (!res.ok) return;
    const { url } = await res.json();
    onChange({ images: [...images, { url, alt: "" }] });
  };

  return (
    <div className="grid gap-4">
      <label className="field-label">Imagens</label>
      {images.map((img: any, idx: number) => (
        <div key={idx} className="flex items-center gap-3 rounded-xl border border-ink-line bg-white p-3">
          <img src={img.url} alt={img.alt} className="h-16 w-16 rounded-lg object-cover" />
          <input
            value={img.alt}
            onChange={(e) => updateAlt(idx, e.target.value)}
            placeholder="Texto alternativo"
            className="field-input flex-1"
          />
          <button type="button" onClick={() => moveImage(idx, "up")} disabled={idx === 0} className="text-ink-muted hover:text-rosa-500 disabled:opacity-30">↑</button>
          <button type="button" onClick={() => moveImage(idx, "down")} disabled={idx === images.length - 1} className="text-ink-muted hover:text-rosa-500 disabled:opacity-30">↓</button>
          <button type="button" onClick={() => removeImage(idx)} className="text-ink-muted hover:text-red-500">✕</button>
        </div>
      ))}
      <div className="flex gap-2">
        <input
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          placeholder="URL da imagem"
          className="field-input flex-1"
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addImage())}
        />
        <button type="button" onClick={addImage} className="btn-secondary">Adicionar URL</button>
        <label className="btn-secondary cursor-pointer">
          Upload
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
          />
        </label>
      </div>
    </div>
  );
}

function CtaBannerForm({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  return (
    <div className="grid gap-4">
      <div>
        <label className="field-label">Titulo</label>
        <input value={data.title} onChange={(e) => onChange({ title: e.target.value })} className="field-input" />
      </div>
      <div>
        <label className="field-label">Subtitulo</label>
        <textarea value={data.subtitle} onChange={(e) => onChange({ subtitle: e.target.value })} rows={3} className="field-input" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="field-label">Texto do botao</label>
          <input value={data.buttonText} onChange={(e) => onChange({ buttonText: e.target.value })} className="field-input" />
        </div>
        <div>
          <label className="field-label">URL do botao</label>
          <input value={data.buttonUrl} onChange={(e) => onChange({ buttonUrl: e.target.value })} className="field-input" />
        </div>
      </div>
      <div>
        <label className="field-label">Cor de fundo</label>
        <div className="mt-2 flex gap-3">
          {(["ink", "rosa"] as const).map((color) => (
            <label
              key={color}
              className={`flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition ${
                data.bgColor === color
                  ? "border-rosa-300 bg-rosa-100 text-rosa-600"
                  : "border-ink-line bg-white text-ink-muted"
              }`}
            >
              <input
                type="radio"
                name="bgColor"
                value={color}
                checked={data.bgColor === color}
                onChange={() => onChange({ bgColor: color })}
                className="sr-only"
              />
              <span className={`h-4 w-4 rounded-full ${color === "ink" ? "bg-ink" : "bg-rosa-400"}`} />
              {color === "ink" ? "Escuro" : "Rosa"}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function FaqForm({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const items: Array<{ question: string; answer: string }> = data.items ?? [];

  const addItem = () => {
    onChange({ items: [...items, { question: "", answer: "" }] });
  };

  const removeItem = (idx: number) => {
    onChange({ items: items.filter((_: any, i: number) => i !== idx) });
  };

  const updateItem = (idx: number, field: "question" | "answer", value: string) => {
    onChange({ items: items.map((item: any, i: number) => (i === idx ? { ...item, [field]: value } : item)) });
  };

  return (
    <div className="grid gap-4">
      <div>
        <label className="field-label">Titulo</label>
        <input value={data.title} onChange={(e) => onChange({ title: e.target.value })} className="field-input" />
      </div>
      <label className="field-label">Perguntas & Respostas</label>
      {items.map((item: any, idx: number) => (
        <div key={idx} className="grid gap-2 rounded-xl border border-ink-line bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">#{idx + 1}</span>
            <button type="button" onClick={() => removeItem(idx)} className="text-xs text-ink-muted hover:text-red-500">Remover</button>
          </div>
          <input
            value={item.question}
            onChange={(e) => updateItem(idx, "question", e.target.value)}
            placeholder="Pergunta"
            className="field-input"
          />
          <textarea
            value={item.answer}
            onChange={(e) => updateItem(idx, "answer", e.target.value)}
            placeholder="Resposta"
            rows={3}
            className="field-input"
          />
        </div>
      ))}
      <button type="button" onClick={addItem} className="btn-secondary w-fit">
        + Adicionar pergunta
      </button>
    </div>
  );
}

function ContactInfoForm({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <label className="field-label">Email</label>
        <input value={data.email} onChange={(e) => onChange({ email: e.target.value })} className="field-input" />
      </div>
      <div>
        <label className="field-label">WhatsApp</label>
        <input value={data.whatsapp} onChange={(e) => onChange({ whatsapp: e.target.value })} className="field-input" />
      </div>
      <div>
        <label className="field-label">Instagram</label>
        <input value={data.instagram} onChange={(e) => onChange({ instagram: e.target.value })} className="field-input" />
      </div>
      <div>
        <label className="field-label">Morada</label>
        <input value={data.address} onChange={(e) => onChange({ address: e.target.value })} className="field-input" />
      </div>
    </div>
  );
}

function TestimonialsForm({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const items: Array<{ name: string; quote: string; avatarUrl: string }> = data.items ?? [];

  const addItem = () => {
    onChange({ items: [...items, { name: "", quote: "", avatarUrl: "" }] });
  };

  const removeItem = (idx: number) => {
    onChange({ items: items.filter((_: any, i: number) => i !== idx) });
  };

  const updateItem = (idx: number, field: "name" | "quote" | "avatarUrl", value: string) => {
    onChange({ items: items.map((item: any, i: number) => (i === idx ? { ...item, [field]: value } : item)) });
  };

  return (
    <div className="grid gap-4">
      <div>
        <label className="field-label">Titulo</label>
        <input value={data.title} onChange={(e) => onChange({ title: e.target.value })} className="field-input" />
      </div>
      <label className="field-label">Testemunhos</label>
      {items.map((item: any, idx: number) => (
        <div key={idx} className="grid gap-2 rounded-xl border border-ink-line bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">#{idx + 1}</span>
            <button type="button" onClick={() => removeItem(idx)} className="text-xs text-ink-muted hover:text-red-500">Remover</button>
          </div>
          <input
            value={item.name}
            onChange={(e) => updateItem(idx, "name", e.target.value)}
            placeholder="Nome"
            className="field-input"
          />
          <textarea
            value={item.quote}
            onChange={(e) => updateItem(idx, "quote", e.target.value)}
            placeholder="Citação"
            rows={3}
            className="field-input"
          />
          <input
            value={item.avatarUrl}
            onChange={(e) => updateItem(idx, "avatarUrl", e.target.value)}
            placeholder="URL do avatar (opcional)"
            className="field-input"
          />
        </div>
      ))}
      <button type="button" onClick={addItem} className="btn-secondary w-fit">
        + Adicionar testemunho
      </button>
    </div>
  );
}

function NewsletterForm({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  return (
    <div className="grid gap-4">
      <div>
        <label className="field-label">Titulo</label>
        <input value={data.title} onChange={(e) => onChange({ title: e.target.value })} className="field-input" />
      </div>
      <div>
        <label className="field-label">Descrição</label>
        <textarea value={data.description} onChange={(e) => onChange({ description: e.target.value })} rows={3} className="field-input" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="field-label">Texto do botão</label>
          <input value={data.buttonText} onChange={(e) => onChange({ buttonText: e.target.value })} className="field-input" />
        </div>
        <div>
          <label className="field-label">URL de destino</label>
          <input value={data.actionUrl} onChange={(e) => onChange({ actionUrl: e.target.value })} placeholder="https:// ou mailto:" className="field-input" />
        </div>
      </div>
    </div>
  );
}

function ImageTextSplitForm({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const html = marked.parse(data.markdown || "", { async: false }) as string;
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="field-label">URL da imagem</label>
          <input value={data.imageUrl} onChange={(e) => onChange({ imageUrl: e.target.value })} className="field-input" />
        </div>
        <div>
          <label className="field-label">Texto alternativo da imagem</label>
          <input value={data.imageAlt} onChange={(e) => onChange({ imageAlt: e.target.value })} className="field-input" />
        </div>
      </div>
      <div>
        <label className="field-label">Titulo</label>
        <input value={data.title} onChange={(e) => onChange({ title: e.target.value })} className="field-input" />
      </div>
      <div>
        <label className="field-label">Disposição</label>
        <div className="mt-2 flex gap-3">
          {(["image-left", "image-right"] as const).map((layout) => (
            <label
              key={layout}
              className={`flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition ${
                data.layout === layout
                  ? "border-rosa-300 bg-rosa-100 text-rosa-600"
                  : "border-ink-line bg-white text-ink-muted"
              }`}
            >
              <input
                type="radio"
                name="layout"
                value={layout}
                checked={data.layout === layout}
                onChange={() => onChange({ layout })}
                className="sr-only"
              />
              {layout === "image-left" ? "Imagem à esquerda" : "Imagem à direita"}
            </label>
          ))}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <label className="field-label">Conteudo (Markdown)</label>
          <textarea
            value={data.markdown}
            onChange={(e) => onChange({ markdown: e.target.value })}
            rows={12}
            className="mt-2 w-full resize-y rounded-xl border border-ink-line bg-white p-4 font-mono text-xs leading-relaxed"
          />
        </div>
        <div>
          <span className="field-label">Preview</span>
          <article
            className="prose prose-sm mt-2 max-w-none text-ink-soft"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </div>
  );
}

function VideoEmbedForm({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  return (
    <div className="grid gap-4">
      <div>
        <label className="field-label">URL do vídeo</label>
        <input value={data.url} onChange={(e) => onChange({ url: e.target.value })} placeholder="youtube.com/watch?v=... ou youtu.be/..." className="field-input" />
      </div>
      <div>
        <label className="field-label">Titulo</label>
        <input value={data.title} onChange={(e) => onChange({ title: e.target.value })} className="field-input" />
      </div>
      <div>
        <label className="field-label">Legenda</label>
        <textarea value={data.caption} onChange={(e) => onChange({ caption: e.target.value })} rows={2} className="field-input" />
      </div>
    </div>
  );
}

function DividerForm({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <label className="field-label">Estilo</label>
        <div className="mt-2 flex flex-col gap-2">
          {([
            { value: "line", label: "Linha" },
            { value: "dots", label: "Pontos" },
            { value: "wave", label: "Onda" },
          ] as const).map(({ value, label }) => (
            <label
              key={value}
              className={`flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition ${
                data.style === value
                  ? "border-rosa-300 bg-rosa-100 text-rosa-600"
                  : "border-ink-line bg-white text-ink-muted"
              }`}
            >
              <input
                type="radio"
                name="divider-style"
                value={value}
                checked={data.style === value}
                onChange={() => onChange({ style: value })}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="field-label">Espaçamento</label>
        <div className="mt-2 flex flex-col gap-2">
          {([
            { value: "small", label: "Pequeno" },
            { value: "medium", label: "Médio" },
            { value: "large", label: "Grande" },
          ] as const).map(({ value, label }) => (
            <label
              key={value}
              className={`flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition ${
                data.spacing === value
                  ? "border-rosa-300 bg-rosa-100 text-rosa-600"
                  : "border-ink-line bg-white text-ink-muted"
              }`}
            >
              <input
                type="radio"
                name="divider-spacing"
                value={value}
                checked={data.spacing === value}
                onChange={() => onChange({ spacing: value })}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
