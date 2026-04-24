import type { Block, Icon } from "../../lib/blocks";
import ImagePicker from "./ImagePicker";
import IconPreview from "./IconPreview";
import { SocialIconPreview } from "./SocialIconPreview";
import { SOCIAL_ICONS, type SocialIconName } from "../../lib/icons";
import { RichTextEditor } from "./RichTextEditor";

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
    case "stats":
      return <StatsForm data={block.data} onChange={onChange} />;
    case "shipping-strip":
      return <ShippingStripForm data={block.data} onChange={onChange} />;
    case "feature-list":
      return <FeatureListForm data={block.data} onChange={onChange} />;
    case "social-links":
      return <SocialLinksForm data={block.data} onChange={onChange} />;
  }
}

function HeroForm({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const isCarousel = data.layout === "carousel";
  const slides: Array<{ url: string; alt: string }> = data.slides ?? [];

  const addSlide = () => {
    onChange({ slides: [...slides, { url: "", alt: "" }] });
  };
  const removeSlide = (idx: number) => {
    onChange({ slides: slides.filter((_, i) => i !== idx) });
  };
  const updateSlideUrl = (idx: number, url: string) => {
    onChange({ slides: slides.map((s, i) => (i === idx ? { ...s, url } : s)) });
  };
  const updateSlideAlt = (idx: number, alt: string) => {
    onChange({ slides: slides.map((s, i) => (i === idx ? { ...s, alt } : s)) });
  };
  const moveSlide = (idx: number, direction: "up" | "down") => {
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= slides.length) return;
    const copy = [...slides];
    [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
    onChange({ slides: copy });
  };

  return (
    <div className="grid gap-4">
      <div>
        <label className="field-label">Layout</label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {([
            { value: "image-right", label: "Imagem à direita" },
            { value: "image-left", label: "Imagem à esquerda" },
            { value: "background-image", label: "Imagem de fundo" },
            { value: "centered", label: "Apenas texto" },
            { value: "carousel", label: "Carrossel" },
          ] as const).map(({ value, label }) => (
            <label
              key={value}
              className={`flex cursor-pointer items-center justify-center rounded-full border px-3 py-2 text-xs font-medium transition ${
                data.layout === value
                  ? "border-rosa-400 bg-rosa-500 text-white"
                  : "border-ink-line bg-surface text-ink-soft"
              }`}
            >
              <input type="radio" name="hero-layout" value={value} checked={data.layout === value} onChange={() => onChange({ layout: value })} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </div>
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
        <label className="field-label">Subtítulo</label>
        <div className="mt-2">
          <RichTextEditor
            value={data.subtitle ?? ""}
            onChange={(subtitle) => onChange({ subtitle })}
            minHeight={120}
          />
        </div>
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
      {isCarousel ? (
        <div className="grid gap-3">
          <div>
            <label className="field-label">Slides do carrossel</label>
            <p className="mt-1 text-xs text-ink-muted">Imagens e GIFs rodam automaticamente a cada 5s. Proporção fixa (≈2.8:1).</p>
          </div>
          {slides.map((slide, i) => (
            <div key={i} className="rounded-xl border border-ink-line bg-surface p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Slide #{i + 1}</span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => moveSlide(i, "up")} disabled={i === 0} className="text-ink-muted hover:text-rosa-500 disabled:opacity-30">↑</button>
                  <button type="button" onClick={() => moveSlide(i, "down")} disabled={i === slides.length - 1} className="text-ink-muted hover:text-rosa-500 disabled:opacity-30">↓</button>
                  <button type="button" onClick={() => removeSlide(i)} className="text-ink-muted hover:text-red-500">✕</button>
                </div>
              </div>
              <ImagePicker
                value={slide.url}
                onChange={(url) => updateSlideUrl(i, url)}
              />
              <div className="mt-3">
                <input
                  value={slide.alt}
                  onChange={(e) => updateSlideAlt(i, e.target.value)}
                  placeholder="Texto alternativo (acessibilidade)"
                  className="field-input"
                />
              </div>
            </div>
          ))}
          <button type="button" onClick={addSlide} className="btn-secondary w-fit">
            + Adicionar slide
          </button>
        </div>
      ) : (
        <ImagePicker
          label="Imagem"
          value={data.imageUrl}
          onChange={(imageUrl) => onChange({ imageUrl })}
        />
      )}
    </div>
  );
}

function TextForm({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const initialValue = data.html ?? data.markdown ?? "";
  return (
    <div>
      <label className="field-label">Conteúdo</label>
      <div className="mt-2">
        <RichTextEditor
          value={initialValue}
          onChange={(html) => onChange({ html, markdown: undefined })}
          minHeight={300}
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
      <div>
        <label className="field-label">Colunas</label>
        <div className="mt-2 flex gap-2">
          {(["2", "3", "4"] as const).map((c) => (
            <label
              key={c}
              className={`flex-1 cursor-pointer rounded-full border px-3 py-2 text-center text-xs font-medium transition ${
                data.columns === c
                  ? "border-rosa-400 bg-rosa-500 text-white"
                  : "border-ink-line bg-surface text-ink-soft"
              }`}
            >
              <input type="radio" name="pg-cols" value={c} checked={data.columns === c} onChange={() => onChange({ columns: c })} className="sr-only" />
              {c} colunas
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="field-label">Estilo</label>
        <div className="mt-2 flex gap-2">
          {(["grid", "carousel"] as const).map((v) => (
            <label
              key={v}
              className={`flex-1 cursor-pointer rounded-full border px-3 py-2 text-center text-xs font-medium transition ${
                data.layout === v
                  ? "border-rosa-400 bg-rosa-500 text-white"
                  : "border-ink-line bg-surface text-ink-soft"
              }`}
            >
              <input type="radio" name="pg-layout" value={v} checked={data.layout === v} onChange={() => onChange({ layout: v })} className="sr-only" />
              {v === "grid" ? "Grelha" : "Carrossel"}
            </label>
          ))}
        </div>
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
        <div className="mt-2">
          <RichTextEditor
            value={data.subtitle ?? ""}
            onChange={(subtitle) => onChange({ subtitle })}
            minHeight={120}
          />
        </div>
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
        label="Imagem de fundo (opcional — substitui a cor)"
        value={data.backgroundImage ?? ""}
        onChange={(backgroundImage) => onChange({ backgroundImage })}
      />
      <div>
        <label className="field-label">Alinhamento</label>
        <div className="mt-2 flex gap-3">
          {(["left", "center"] as const).map((align) => (
            <label
              key={align}
              className={`flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition ${
                data.align === align
                  ? "border-rosa-400 bg-rosa-500 text-white"
                  : "border-ink-line bg-surface text-ink-soft"
              }`}
            >
              <input type="radio" name="cta-align" value={align} checked={data.align === align} onChange={() => onChange({ align })} className="sr-only" />
              {align === "left" ? "Esquerda" : "Centrado"}
            </label>
          ))}
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
          <RichTextEditor
            value={item.answer ?? ""}
            onChange={(answer) => updateItem(idx, "answer", answer)}
            minHeight={120}
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
          <RichTextEditor
            value={item.quote ?? ""}
            onChange={(quote) => updateItem(idx, "quote", quote)}
            minHeight={120}
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
        <div className="mt-2">
          <RichTextEditor
            value={data.description ?? ""}
            onChange={(description) => onChange({ description })}
            minHeight={120}
          />
        </div>
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
  const initialValue = data.html ?? data.markdown ?? "";
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
        <div className="mt-2 grid grid-cols-2 gap-2">
          {([
            { value: "image-left", label: "Imagem à esquerda" },
            { value: "image-right", label: "Imagem à direita" },
            { value: "image-top", label: "Imagem em cima" },
            { value: "image-bottom", label: "Imagem em baixo" },
          ] as const).map(({ value, label }) => (
            <label
              key={value}
              className={`flex cursor-pointer items-center justify-center rounded-full border px-3 py-2 text-xs font-medium transition ${
                data.layout === value
                  ? "border-rosa-400 bg-rosa-500 text-white"
                  : "border-ink-line bg-surface text-ink-soft"
              }`}
            >
              <input type="radio" name="its-layout" value={value} checked={data.layout === value} onChange={() => onChange({ layout: value })} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="field-label">Proporção da imagem</label>
        <div className="mt-2 flex gap-2">
          {([
            { value: "square", label: "Quadrado" },
            { value: "landscape", label: "Paisagem" },
            { value: "portrait", label: "Retrato" },
          ] as const).map(({ value, label }) => (
            <label
              key={value}
              className={`flex-1 cursor-pointer rounded-full border px-3 py-2 text-center text-xs font-medium transition ${
                data.imageAspect === value
                  ? "border-rosa-400 bg-rosa-500 text-white"
                  : "border-ink-line bg-surface text-ink-soft"
              }`}
            >
              <input type="radio" name="its-aspect" value={value} checked={data.imageAspect === value} onChange={() => onChange({ imageAspect: value })} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="field-label">Conteúdo</label>
        <div className="mt-2">
          <RichTextEditor
            value={initialValue}
            onChange={(html) => onChange({ html, markdown: undefined })}
            minHeight={240}
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
        <div className="mt-2">
          <RichTextEditor
            value={data.caption ?? ""}
            onChange={(caption) => onChange({ caption })}
            minHeight={100}
          />
        </div>
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

// ── Icon picker helper ────────────────────────────────────────────────────────

const ICONS: Icon[] = ["truck", "lock", "return", "flag", "heart", "star", "shield", "sparkle"];

function IconPicker({ value, onChange }: { value: Icon; onChange: (next: Icon) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {ICONS.map((icon) => (
        <button
          key={icon}
          type="button"
          onClick={() => onChange(icon)}
          aria-label={icon}
          className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${
            value === icon ? "border-rosa-400 bg-rosa-500 text-white" : "border-ink-line bg-surface text-ink-soft hover:border-rosa-300"
          }`}
        >
          <IconPreview name={icon} className="h-5 w-5" />
        </button>
      ))}
    </div>
  );
}

// ── New block forms ───────────────────────────────────────────────────────────

function StatsForm({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const items: Array<{ value: string; label: string }> = data.items ?? [];
  const addItem = () => items.length < 4 && onChange({ items: [...items, { value: "", label: "" }] });
  const removeItem = (idx: number) => onChange({ items: items.filter((_, i) => i !== idx) });
  const updateItem = (idx: number, field: "value" | "label", v: string) =>
    onChange({ items: items.map((it, i) => (i === idx ? { ...it, [field]: v } : it)) });

  return (
    <div className="grid gap-4">
      <div>
        <label className="field-label">Título (opcional)</label>
        <input value={data.title ?? ""} onChange={(e) => onChange({ title: e.target.value })} className="field-input" />
      </div>
      <label className="field-label">Itens (até 4)</label>
      {items.map((it, i) => (
        <div key={i} className="grid grid-cols-[1fr,2fr,auto] gap-2 rounded-xl border border-ink-line bg-surface p-3">
          <input value={it.value} onChange={(e) => updateItem(i, "value", e.target.value)} placeholder="500+" className="field-input" />
          <input value={it.label} onChange={(e) => updateItem(i, "label", e.target.value)} placeholder="peças vendidas" className="field-input" />
          <button type="button" onClick={() => removeItem(i)} className="text-ink-muted hover:text-red-500">✕</button>
        </div>
      ))}
      {items.length < 4 && (
        <button type="button" onClick={addItem} className="btn-secondary w-fit">+ Adicionar item</button>
      )}
    </div>
  );
}

function ShippingStripForm({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const items: Array<{ icon: Icon; title: string; subtitle: string }> = data.items ?? [];
  const addItem = () =>
    items.length < 4 && onChange({ items: [...items, { icon: "truck" as Icon, title: "", subtitle: "" }] });
  const removeItem = (idx: number) => onChange({ items: items.filter((_, i) => i !== idx) });
  const updateItem = (idx: number, patch: Partial<{ icon: Icon; title: string; subtitle: string }>) =>
    onChange({ items: items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) });

  return (
    <div className="grid gap-4">
      <label className="field-label">Itens (até 4)</label>
      {items.map((it, i) => (
        <div key={i} className="grid gap-2 rounded-xl border border-ink-line bg-surface p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">#{i + 1}</span>
            <button type="button" onClick={() => removeItem(i)} className="text-xs text-ink-muted hover:text-red-500">Remover</button>
          </div>
          <IconPicker value={it.icon} onChange={(icon) => updateItem(i, { icon })} />
          <input value={it.title} onChange={(e) => updateItem(i, { title: e.target.value })} placeholder="Envios rápidos" className="field-input" />
          <input value={it.subtitle} onChange={(e) => updateItem(i, { subtitle: e.target.value })} placeholder="3-5 dias úteis (opcional)" className="field-input" />
        </div>
      ))}
      {items.length < 4 && (
        <button type="button" onClick={addItem} className="btn-secondary w-fit">+ Adicionar item</button>
      )}
    </div>
  );
}

function FeatureListForm({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const items: Array<{ icon: Icon; title: string; description: string }> = data.items ?? [];
  const addItem = () =>
    items.length < 6 && onChange({ items: [...items, { icon: "star" as Icon, title: "", description: "" }] });
  const removeItem = (idx: number) => onChange({ items: items.filter((_, i) => i !== idx) });
  const updateItem = (idx: number, patch: Partial<{ icon: Icon; title: string; description: string }>) =>
    onChange({ items: items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) });

  return (
    <div className="grid gap-4">
      <div>
        <label className="field-label">Título</label>
        <input value={data.title ?? ""} onChange={(e) => onChange({ title: e.target.value })} className="field-input" />
      </div>
      <div>
        <label className="field-label">Subtítulo</label>
        <input value={data.subtitle ?? ""} onChange={(e) => onChange({ subtitle: e.target.value })} className="field-input" />
      </div>
      <label className="field-label">Itens (até 6)</label>
      {items.map((it, i) => (
        <div key={i} className="grid gap-2 rounded-xl border border-ink-line bg-surface p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">#{i + 1}</span>
            <button type="button" onClick={() => removeItem(i)} className="text-xs text-ink-muted hover:text-red-500">Remover</button>
          </div>
          <IconPicker value={it.icon} onChange={(icon) => updateItem(i, { icon })} />
          <input value={it.title} onChange={(e) => updateItem(i, { title: e.target.value })} placeholder="Título" className="field-input" />
          <RichTextEditor
            value={it.description ?? ""}
            onChange={(description) => updateItem(i, { description })}
            minHeight={100}
          />
        </div>
      ))}
      {items.length < 6 && (
        <button type="button" onClick={addItem} className="btn-secondary w-fit">+ Adicionar item</button>
      )}
    </div>
  );
}

function SocialIconPicker({ value, onChange }: { value: SocialIconName; onChange: (next: SocialIconName) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {SOCIAL_ICONS.map((icon) => (
        <button
          key={icon}
          type="button"
          onClick={() => onChange(icon)}
          aria-label={icon}
          className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${
            value === icon ? "border-rosa-400 bg-rosa-500 text-white" : "border-ink-line bg-surface text-ink-soft hover:border-rosa-300"
          }`}
        >
          <SocialIconPreview name={icon} className="h-5 w-5" />
        </button>
      ))}
    </div>
  );
}

const SOCIAL_URL_PLACEHOLDERS: Record<SocialIconName, string> = {
  instagram: "https://instagram.com/drisclub",
  facebook: "https://facebook.com/drisclub",
  tiktok: "https://tiktok.com/@drisclub",
  youtube: "https://youtube.com/@drisclub",
  pinterest: "https://pinterest.com/drisclub",
  whatsapp: "351912345678 ou https://wa.me/351912345678",
  email: "ola@drisclub.com",
};

const SOCIAL_LABEL_PLACEHOLDERS: Record<SocialIconName, string> = {
  instagram: "@drisclub (opcional)",
  facebook: "Drisclub (opcional)",
  tiktok: "@drisclub (opcional)",
  youtube: "@drisclub (opcional)",
  pinterest: "Drisclub (opcional)",
  whatsapp: "+351 912 345 678 (opcional)",
  email: "ola@drisclub.com (opcional)",
};

function socialUrlPlaceholder(icon: SocialIconName): string {
  return SOCIAL_URL_PLACEHOLDERS[icon] ?? "https://exemplo.com";
}

function socialLabelPlaceholder(icon: SocialIconName): string {
  return SOCIAL_LABEL_PLACEHOLDERS[icon] ?? "(opcional)";
}

function SocialLinksForm({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const items: Array<{ icon: SocialIconName; label: string; url: string }> = data.items ?? [];
  const addItem = () =>
    items.length < 7 &&
    onChange({ items: [...items, { icon: "instagram" as SocialIconName, label: "", url: "" }] });
  const removeItem = (idx: number) =>
    onChange({ items: items.filter((_, i) => i !== idx) });
  const updateItem = (
    idx: number,
    patch: Partial<{ icon: SocialIconName; label: string; url: string }>,
  ) => onChange({ items: items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) });

  return (
    <div className="grid gap-4">
      <div>
        <label className="field-label">Título</label>
        <input
          value={data.title ?? ""}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Segue-nos"
          className="field-input"
        />
      </div>
      <div>
        <label className="field-label">Subtítulo (opcional)</label>
        <input
          value={data.subtitle ?? ""}
          onChange={(e) => onChange({ subtitle: e.target.value })}
          className="field-input"
        />
      </div>
      <label className="field-label">Redes (até 7)</label>
      {items.map((it, i) => (
        <div key={i} className="grid gap-2 rounded-xl border border-ink-line bg-surface p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">#{i + 1}</span>
            <button
              type="button"
              onClick={() => removeItem(i)}
              className="text-xs text-ink-muted hover:text-red-500"
            >
              Remover
            </button>
          </div>
          <SocialIconPicker value={it.icon} onChange={(icon) => updateItem(i, { icon })} />
          <input
            value={it.label}
            onChange={(e) => updateItem(i, { label: e.target.value })}
            placeholder={socialLabelPlaceholder(it.icon)}
            className="field-input"
          />
          <input
            value={it.url}
            onChange={(e) => updateItem(i, { url: e.target.value })}
            placeholder={socialUrlPlaceholder(it.icon)}
            type={it.icon === "email" ? "email" : "text"}
            inputMode={it.icon === "email" ? "email" : it.icon === "whatsapp" ? "tel" : "url"}
            className="field-input"
          />
        </div>
      ))}
      {items.length < 7 && (
        <button type="button" onClick={addItem} className="btn-secondary w-fit">
          + Adicionar rede social
        </button>
      )}
    </div>
  );
}
