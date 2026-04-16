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

export const blockSchema = z.discriminatedUnion("type", [
  heroBlockSchema,
  textBlockSchema,
  productGridBlockSchema,
  categoryGridBlockSchema,
  imageGalleryBlockSchema,
  ctaBannerBlockSchema,
  faqBlockSchema,
  contactInfoBlockSchema,
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
  }
}
