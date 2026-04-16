import { z } from "zod";
import { nanoid } from "nanoid";

// --- Block data schemas ---

const heroDataSchema = z.object({
  title: z.string().default(""),
  subtitle: z.string().default(""),
  buttonText: z.string().default(""),
  buttonUrl: z.string().default(""),
  imageUrl: z.string().default(""),
});

const textDataSchema = z.object({
  markdown: z.string().default(""),
});

const productGridDataSchema = z.object({
  title: z.string().default(""),
  subtitle: z.string().default(""),
  filter: z.string().default("bestsellers"),
});

const categoryGridDataSchema = z.object({
  title: z.string().default(""),
  subtitle: z.string().default(""),
  categories: z.array(z.string()).default([]),
});

const imageGalleryDataSchema = z.object({
  images: z.array(z.object({
    url: z.string(),
    alt: z.string().default(""),
  })).default([]),
});

const ctaBannerDataSchema = z.object({
  title: z.string().default(""),
  subtitle: z.string().default(""),
  buttonText: z.string().default(""),
  buttonUrl: z.string().default(""),
  bgColor: z.enum(["rosa", "ink"]).default("ink"),
});

const faqDataSchema = z.object({
  title: z.string().default(""),
  items: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })).default([]),
});

const contactInfoDataSchema = z.object({
  email: z.string().default(""),
  whatsapp: z.string().default(""),
  instagram: z.string().default(""),
  address: z.string().default(""),
});

const testimonialsDataSchema = z.object({
  title: z.string().default(""),
  items: z.array(z.object({
    name: z.string(),
    quote: z.string(),
    avatarUrl: z.string().default(""),
  })).default([]),
});

const newsletterDataSchema = z.object({
  title: z.string().default(""),
  description: z.string().default(""),
  buttonText: z.string().default("Subscrever"),
  actionUrl: z.string().default(""),
});

const imageTextSplitDataSchema = z.object({
  imageUrl: z.string().default(""),
  imageAlt: z.string().default(""),
  title: z.string().default(""),
  markdown: z.string().default(""),
  layout: z.enum(["image-left", "image-right"]).default("image-left"),
});

const videoEmbedDataSchema = z.object({
  url: z.string().default(""),
  title: z.string().default(""),
  caption: z.string().default(""),
});

const dividerDataSchema = z.object({
  style: z.enum(["line", "dots", "wave"]).default("line"),
  spacing: z.enum(["small", "medium", "large"]).default("medium"),
});

// --- Block schema (discriminated union) ---

const heroBlockSchema = z.object({
  id: z.string(),
  type: z.literal("hero"),
  data: heroDataSchema,
});

const textBlockSchema = z.object({
  id: z.string(),
  type: z.literal("text"),
  data: textDataSchema,
});

const productGridBlockSchema = z.object({
  id: z.string(),
  type: z.literal("product-grid"),
  data: productGridDataSchema,
});

const categoryGridBlockSchema = z.object({
  id: z.string(),
  type: z.literal("category-grid"),
  data: categoryGridDataSchema,
});

const imageGalleryBlockSchema = z.object({
  id: z.string(),
  type: z.literal("image-gallery"),
  data: imageGalleryDataSchema,
});

const ctaBannerBlockSchema = z.object({
  id: z.string(),
  type: z.literal("cta-banner"),
  data: ctaBannerDataSchema,
});

const faqBlockSchema = z.object({
  id: z.string(),
  type: z.literal("faq"),
  data: faqDataSchema,
});

const contactInfoBlockSchema = z.object({
  id: z.string(),
  type: z.literal("contact-info"),
  data: contactInfoDataSchema,
});

const testimonialsBlockSchema = z.object({
  id: z.string(),
  type: z.literal("testimonials"),
  data: testimonialsDataSchema,
});

const newsletterBlockSchema = z.object({
  id: z.string(),
  type: z.literal("newsletter"),
  data: newsletterDataSchema,
});

const imageTextSplitBlockSchema = z.object({
  id: z.string(),
  type: z.literal("image-text-split"),
  data: imageTextSplitDataSchema,
});

const videoEmbedBlockSchema = z.object({
  id: z.string(),
  type: z.literal("video-embed"),
  data: videoEmbedDataSchema,
});

const dividerBlockSchema = z.object({
  id: z.string(),
  type: z.literal("divider"),
  data: dividerDataSchema,
});

export const blockSchema = z.discriminatedUnion("type", [
  heroBlockSchema,
  textBlockSchema,
  productGridBlockSchema,
  categoryGridBlockSchema,
  imageGalleryBlockSchema,
  ctaBannerBlockSchema,
  faqBlockSchema,
  contactInfoBlockSchema,
  testimonialsBlockSchema,
  newsletterBlockSchema,
  imageTextSplitBlockSchema,
  videoEmbedBlockSchema,
  dividerBlockSchema,
]);

export const blocksArraySchema = z.array(blockSchema);

export type Block = z.infer<typeof blockSchema>;
export type BlockType = Block["type"];

export type HeroData = z.infer<typeof heroDataSchema>;
export type TextData = z.infer<typeof textDataSchema>;
export type ProductGridData = z.infer<typeof productGridDataSchema>;
export type CategoryGridData = z.infer<typeof categoryGridDataSchema>;
export type ImageGalleryData = z.infer<typeof imageGalleryDataSchema>;
export type CtaBannerData = z.infer<typeof ctaBannerDataSchema>;
export type FaqData = z.infer<typeof faqDataSchema>;
export type ContactInfoData = z.infer<typeof contactInfoDataSchema>;
export type TestimonialsData = z.infer<typeof testimonialsDataSchema>;
export type NewsletterData = z.infer<typeof newsletterDataSchema>;
export type ImageTextSplitData = z.infer<typeof imageTextSplitDataSchema>;
export type VideoEmbedData = z.infer<typeof videoEmbedDataSchema>;
export type DividerData = z.infer<typeof dividerDataSchema>;

// --- Block metadata for the admin picker ---

export const BLOCK_TYPES: Array<{ type: BlockType; label: string; description: string }> = [
  { type: "hero", label: "Hero", description: "Banner com titulo, subtitulo, botao e imagem" },
  { type: "text", label: "Texto", description: "Bloco de texto com suporte a Markdown" },
  { type: "product-grid", label: "Grelha de Produtos", description: "Mostra produtos (mais vendidos, por categoria, ou todos)" },
  { type: "category-grid", label: "Grelha de Categorias", description: "Mostra cartoes de categorias" },
  { type: "image-gallery", label: "Galeria de Imagens", description: "Grelha de imagens" },
  { type: "cta-banner", label: "Banner CTA", description: "Seccao colorida com texto e botao" },
  { type: "faq", label: "FAQ", description: "Perguntas e respostas em acordeao" },
  { type: "contact-info", label: "Contacto", description: "Email, WhatsApp, Instagram, morada" },
  { type: "testimonials", label: "Testemunhos", description: "Citações de clientes com nome e avatar" },
  { type: "newsletter", label: "Newsletter", description: "Call-to-action para subscrição" },
  { type: "image-text-split", label: "Imagem + Texto", description: "Imagem ao lado de texto em Markdown" },
  { type: "video-embed", label: "Vídeo", description: "Embed de YouTube ou Vimeo" },
  { type: "divider", label: "Separador", description: "Linha visual entre secções" },
];

// --- Default data factories ---

export function createBlock(type: BlockType): Block {
  const id = nanoid(10);
  switch (type) {
    case "hero":
      return { id, type, data: { title: "", subtitle: "", buttonText: "", buttonUrl: "", imageUrl: "" } };
    case "text":
      return { id, type, data: { markdown: "" } };
    case "product-grid":
      return { id, type, data: { title: "", subtitle: "", filter: "bestsellers" } };
    case "category-grid":
      return { id, type, data: { title: "", subtitle: "", categories: [] } };
    case "image-gallery":
      return { id, type, data: { images: [] } };
    case "cta-banner":
      return { id, type, data: { title: "", subtitle: "", buttonText: "", buttonUrl: "", bgColor: "ink" } };
    case "faq":
      return { id, type, data: { title: "", items: [] } };
    case "contact-info":
      return { id, type, data: { email: "", whatsapp: "", instagram: "", address: "" } };
    case "testimonials":
      return { id, type, data: { title: "", items: [] } };
    case "newsletter":
      return { id, type, data: { title: "", description: "", buttonText: "Subscrever", actionUrl: "" } };
    case "image-text-split":
      return { id, type, data: { imageUrl: "", imageAlt: "", title: "", markdown: "", layout: "image-left" } };
    case "video-embed":
      return { id, type, data: { url: "", title: "", caption: "" } };
    case "divider":
      return { id, type, data: { style: "line", spacing: "medium" } };
  }
}
