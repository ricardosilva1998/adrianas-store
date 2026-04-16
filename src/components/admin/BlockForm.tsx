import { marked } from "marked";
import type { Block } from "../../lib/blocks";
import ImagePicker from "./ImagePicker";

export default function BlockForm({ block, onChange }: { block: Block; onChange: (data: any) => void }) {
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
    case "product-gallery":
      return <ProductGalleryForm data={block.data} onChange={onChange} />;
    case "product-info":
      return <ProductInfoForm data={block.data} onChange={onChange} />;
    case "product-long-description":
      return <ProductLongDescriptionForm data={block.data} onChange={onChange} />;
    case "product-related":
      return <ProductRelatedForm data={block.data} onChange={onChange} />;
    case "catalog-grid-bound":
      return <CatalogGridBoundForm data={block.data} onChange={onChange} />;
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
        <label className="field-label">Destaque (em rosa, na linha seguinte)</label>
        <input
          value={data.titleAccent ?? ""}
          onChange={(e) => onChange({ titleAccent: e.target.value })}
          className="field-input"
          placeholder="ex: feitas para ti"
        />
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
      <ImagePicker
        label="Imagem"
        value={data.imageUrl}
        onChange={(imageUrl) => onChange({ imageUrl })}
      />
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
          className="mt-2 w-full resize-y rounded-xl border border-ink-line bg-surface p-4 font-mono text-xs leading-relaxed"
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
                  ? "border-rosa-300 bg-rosa-100 text-rosa-700 dark:bg-rosa-500/15 dark:text-rosa-200"
                  : "border-ink-line bg-surface text-ink-muted hover:border-rosa-200"
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

  const addImage = () => {
    onChange({ images: [...images, { url: "", alt: "" }] });
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

  return (
    <div className="grid gap-4">
      <label className="field-label">Imagens</label>
      {images.map((img: any, i: number) => (
        <div key={i} className="rounded-xl border border-ink-line bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">#{i + 1}</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => moveImage(i, "up")} disabled={i === 0} className="text-ink-muted hover:text-rosa-500 disabled:opacity-30">↑</button>
              <button type="button" onClick={() => moveImage(i, "down")} disabled={i === images.length - 1} className="text-ink-muted hover:text-rosa-500 disabled:opacity-30">↓</button>
              <button type="button" onClick={() => removeImage(i)} className="text-ink-muted hover:text-red-500">✕</button>
            </div>
          </div>
          <ImagePicker
            value={img.url}
            onChange={(url) => {
              const next = [...images];
              next[i] = { ...next[i], url };
              onChange({ images: next });
            }}
          />
          <div className="mt-3">
            <input
              value={img.alt}
              onChange={(e) => updateAlt(i, e.target.value)}
              placeholder="Texto alternativo"
              className="field-input"
            />
          </div>
        </div>
      ))}
      <button type="button" onClick={addImage} className="btn-secondary w-fit">
        + Adicionar imagem
      </button>
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
                  ? "border-rosa-300 bg-rosa-100 text-rosa-700 dark:bg-rosa-500/15 dark:text-rosa-200"
                  : "border-ink-line bg-surface text-ink-muted"
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
        <div key={idx} className="grid gap-2 rounded-xl border border-ink-line bg-surface p-4">
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
        <div key={idx} className="grid gap-2 rounded-xl border border-ink-line bg-surface p-4">
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
      <ImagePicker
        label="Imagem"
        value={data.imageUrl}
        onChange={(imageUrl) => onChange({ imageUrl })}
      />
      <div>
        <label className="field-label">Texto alternativo da imagem</label>
        <input value={data.imageAlt} onChange={(e) => onChange({ imageAlt: e.target.value })} className="field-input" />
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
                  ? "border-rosa-300 bg-rosa-100 text-rosa-700 dark:bg-rosa-500/15 dark:text-rosa-200"
                  : "border-ink-line bg-surface text-ink-muted"
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
            className="mt-2 w-full resize-y rounded-xl border border-ink-line bg-surface p-4 font-mono text-xs leading-relaxed"
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
                  ? "border-rosa-300 bg-rosa-100 text-rosa-700 dark:bg-rosa-500/15 dark:text-rosa-200"
                  : "border-ink-line bg-surface text-ink-muted"
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
                  ? "border-rosa-300 bg-rosa-100 text-rosa-700 dark:bg-rosa-500/15 dark:text-rosa-200"
                  : "border-ink-line bg-surface text-ink-muted"
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

function ProductGalleryForm({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  return (
    <div className="grid gap-4">
      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          checked={data.showThumbs}
          onChange={(e) => onChange({ showThumbs: e.target.checked })}
        />
        Mostrar thumbnails
      </label>
      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          checked={data.showBadges}
          onChange={(e) => onChange({ showBadges: e.target.checked })}
        />
        Mostrar badges (mais vendido, esgotado)
      </label>
    </div>
  );
}

function ProductInfoForm({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  return (
    <div className="grid gap-4">
      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          checked={data.showBreadcrumbs}
          onChange={(e) => onChange({ showBreadcrumbs: e.target.checked })}
        />
        Mostrar breadcrumbs
      </label>
      <div>
        <label className="field-label">Info de envio (uma linha por item)</label>
        <textarea
          value={data.shippingInfo}
          onChange={(e) => onChange({ shippingInfo: e.target.value })}
          rows={4}
          className="field-input resize-y"
        />
      </div>
    </div>
  );
}

function ProductLongDescriptionForm({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  return (
    <div>
      <label className="field-label">Título (opcional)</label>
      <input
        value={data.title}
        onChange={(e) => onChange({ title: e.target.value })}
        className="field-input"
      />
    </div>
  );
}

function ProductRelatedForm({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  return (
    <div className="grid gap-4">
      <div>
        <label className="field-label">Título da secção</label>
        <input
          value={data.title}
          onChange={(e) => onChange({ title: e.target.value })}
          className="field-input"
        />
      </div>
      <div>
        <label className="field-label">Nº máximo de produtos</label>
        <input
          type="number"
          min={1}
          max={12}
          value={data.limit}
          onChange={(e) => onChange({ limit: Number(e.target.value) })}
          className="field-input"
        />
      </div>
    </div>
  );
}

function CatalogGridBoundForm({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  return (
    <div className="grid gap-4">
      <div>
        <label className="field-label">Título</label>
        <input
          value={data.title}
          onChange={(e) => onChange({ title: e.target.value })}
          className="field-input"
        />
      </div>
      <div>
        <label className="field-label">Subtítulo</label>
        <input
          value={data.subtitle}
          onChange={(e) => onChange({ subtitle: e.target.value })}
          className="field-input"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          checked={data.showCategoryFilter}
          onChange={(e) => onChange({ showCategoryFilter: e.target.checked })}
        />
        Mostrar filtro de categorias
      </label>
      <div>
        <label className="field-label">Colunas</label>
        <div className="mt-1 flex gap-2">
          {(["2", "3", "4"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange({ columns: c })}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs ${
                data.columns === c ? "border-rosa-400 bg-rosa-50 text-rosa-700 dark:bg-rosa-500/15 dark:text-rosa-200" : "border-ink-line text-ink-soft"
              }`}
            >
              {c} col
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
