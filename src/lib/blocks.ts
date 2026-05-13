import { z } from "zod";
import { nanoid } from "nanoid";

// --- Shared validators ---

const safeUrl = z
  .string()
  .refine(
    (s) => s === "" || !/['")\\]/.test(s),
    "URL contém caracteres inválidos",
  )
  .default("");

// --- Block data schemas ---

const focalSchema = z
  .object({
    x: z.number().min(0).max(100).default(50),
    y: z.number().min(0).max(100).default(50),
  })
  .default({ x: 50, y: 50 });

const heroSlideSchema = z.object({
  url: z.string().min(1).refine((s) => !/['")\\]/.test(s), "URL inválido"),
  alt: z.string().default(""),
  focal: focalSchema,
  // Optional mobile-only variant — when set, replaces `url` at viewports <768px.
  urlMobile: z.string().refine((s) => s === "" || !/['")\\]/.test(s), "URL inválido").default(""),
  focalMobile: focalSchema,
});

const heroDataSchema = z.object({
  title: z.string().default(""),
  titleAccent: z.string().default(""),
  subtitle: z.string().default(""),
  buttonText: z.string().default(""),
  buttonUrl: z.string().default(""),
  imageUrl: safeUrl,
  imageFocal: focalSchema,
  imageUrlMobile: safeUrl,
  imageFocalMobile: focalSchema,
  slides: z.array(heroSlideSchema).default([]),
  layout: z.enum(["image-right", "image-left", "background-image", "centered", "carousel"]).default("image-right"),
});

const textDataSchema = z.object({
  html: z.string().default(""),
  markdown: z.string().optional(),
});

const productGridDataSchema = z.object({
  title: z.string().default(""),
  subtitle: z.string().default(""),
  filter: z.union([
    z.literal("bestsellers"),
    z.literal("all"),
    z.string().regex(/^category:[a-z0-9-]+$/, "Filtro inválido"),
  ]).default("bestsellers"),
  columns: z.enum(["2", "3", "4"]).default("4"),
  layout: z.enum(["grid", "carousel"]).default("grid"),
});

const categoryGridDataSchema = z.object({
  title: z.string().default(""),
  subtitle: z.string().default(""),
  categories: z.array(z.string()).default([]),
});

const imageGalleryDataSchema = z.object({
  images: z.array(z.object({
    url: z.string().min(1).refine((s) => !/['")\\]/.test(s), "URL inválido"),
    alt: z.string().default(""),
    focal: focalSchema,
  })).default([]),
});

const imageCarouselDataSchema = z.object({
  images: z.array(z.object({
    url: z.string().min(1).refine((s) => !/['")\\]/.test(s), "URL inválido"),
    alt: z.string().default(""),
    focal: focalSchema,
  })).default([]),
  aspectRatio: z.enum(["square", "landscape", "wide"]).default("landscape"),
  autoplay: z.boolean().default(true),
});

const introHeroDataSchema = z.object({
  title: z.string().default(""),
  titleAccent: z.string().default(""),
  subtitle: z.string().default(""),
  buttonText: z.string().default(""),
  buttonUrl: z.string().default(""),
  imageUrl: safeUrl,
  overlayOpacity: z.number().int().min(0).max(80).default(40),
  height: z.enum(["medium", "tall", "full"]).default("full"),
});

const couponPopupDataSchema = z.object({
  title: z.string().default(""),
  subtitle: z.string().default(""),
  couponCode: z.string().default(""),
  buttonText: z.string().default("Ir às compras"),
  buttonUrl: z.string().default("/catalogo"),
  imageUrl: safeUrl,
  delaySeconds: z.number().int().min(0).max(120).default(10),
  dismissDays: z.number().int().min(0).max(365).default(7),
});

const ctaBannerDataSchema = z.object({
  title: z.string().default(""),
  subtitle: z.string().default(""),
  buttonText: z.string().default(""),
  buttonUrl: z.string().default(""),
  bgColor: z.enum(["rosa", "ink"]).default("ink"),
  backgroundImage: safeUrl,
  align: z.enum(["left", "center"]).default("left"),
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
  imageUrl: safeUrl,
  imageAlt: z.string().default(""),
  imageFocal: focalSchema,
  title: z.string().default(""),
  html: z.string().default(""),
  markdown: z.string().optional(),
  layout: z.enum(["image-left", "image-right", "image-top", "image-bottom"]).default("image-left"),
  imageAspect: z.enum(["square", "landscape", "portrait"]).default("landscape"),
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

const productGalleryDataSchema = z.object({
  showThumbs: z.boolean().default(true),
  showBadges: z.boolean().default(true),
});

const productInfoDataSchema = z.object({
  showBreadcrumbs: z.boolean().default(true),
  shippingInfo: z.string().default(
    "• Preparação: 3 a 5 dias úteis\n• Envios via CTT para Portugal Continental e Ilhas\n• Pagamento via MB Way, transferência bancária ou PayPal",
  ),
});

const productLongDescriptionDataSchema = z.object({
  title: z.string().default(""),
});

const productRelatedDataSchema = z.object({
  title: z.string().default("Talvez também gostes"),
  limit: z.number().int().min(1).max(12).default(4),
});

const catalogGridBoundDataSchema = z.object({
  title: z.string().default(""),
  subtitle: z.string().default(""),
  showCategoryFilter: z.boolean().default(true),
  columns: z.enum(["2", "3", "4"]).default("4"),
});

const iconSchema = z.enum(["truck", "lock", "return", "flag", "heart", "star", "shield", "sparkle"]);
export type Icon = z.infer<typeof iconSchema>;

const statsDataSchema = z.object({
  title: z.string().default(""),
  items: z.array(z.object({
    value: z.string().default(""),
    label: z.string().default(""),
  })).max(4).default([]),
});

const shippingStripDataSchema = z.object({
  items: z.array(z.object({
    icon: iconSchema.default("truck"),
    title: z.string().default(""),
    subtitle: z.string().default(""),
  })).max(4).default([]),
});

const featureListDataSchema = z.object({
  title: z.string().default(""),
  subtitle: z.string().default(""),
  items: z.array(z.object({
    icon: iconSchema.default("star"),
    title: z.string().default(""),
    description: z.string().default(""),
  })).max(6).default([]),
});

const socialIconSchema = z.enum([
  "instagram",
  "facebook",
  "tiktok",
  "youtube",
  "pinterest",
  "whatsapp",
  "email",
]);
export type SocialIcon = z.infer<typeof socialIconSchema>;

const socialLinksDataSchema = z.object({
  title: z.string().default("Segue-nos"),
  subtitle: z.string().default(""),
  items: z.array(z.object({
    icon: socialIconSchema.default("instagram"),
    label: z.string().default(""),
    url: safeUrl,
  })).max(7).default([]),
});

const statsBlockSchema = z.object({ id: z.string(), type: z.literal("stats"), data: statsDataSchema });
const shippingStripBlockSchema = z.object({ id: z.string(), type: z.literal("shipping-strip"), data: shippingStripDataSchema });
const featureListBlockSchema = z.object({ id: z.string(), type: z.literal("feature-list"), data: featureListDataSchema });
const socialLinksBlockSchema = z.object({ id: z.string(), type: z.literal("social-links"), data: socialLinksDataSchema });

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

const imageCarouselBlockSchema = z.object({
  id: z.string(),
  type: z.literal("image-carousel"),
  data: imageCarouselDataSchema,
});

const introHeroBlockSchema = z.object({
  id: z.string(),
  type: z.literal("intro-hero"),
  data: introHeroDataSchema,
});

const couponPopupBlockSchema = z.object({
  id: z.string(),
  type: z.literal("coupon-popup"),
  data: couponPopupDataSchema,
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

const productGalleryBlockSchema = z.object({ id: z.string(), type: z.literal("product-gallery"), data: productGalleryDataSchema });
const productInfoBlockSchema = z.object({ id: z.string(), type: z.literal("product-info"), data: productInfoDataSchema });
const productLongDescriptionBlockSchema = z.object({ id: z.string(), type: z.literal("product-long-description"), data: productLongDescriptionDataSchema });
const productRelatedBlockSchema = z.object({ id: z.string(), type: z.literal("product-related"), data: productRelatedDataSchema });
const catalogGridBoundBlockSchema = z.object({ id: z.string(), type: z.literal("catalog-grid-bound"), data: catalogGridBoundDataSchema });

export const blockSchema = z.discriminatedUnion("type", [
  heroBlockSchema,
  textBlockSchema,
  productGridBlockSchema,
  categoryGridBlockSchema,
  imageGalleryBlockSchema,
  imageCarouselBlockSchema,
  introHeroBlockSchema,
  couponPopupBlockSchema,
  ctaBannerBlockSchema,
  faqBlockSchema,
  contactInfoBlockSchema,
  testimonialsBlockSchema,
  newsletterBlockSchema,
  imageTextSplitBlockSchema,
  videoEmbedBlockSchema,
  dividerBlockSchema,
  statsBlockSchema,
  shippingStripBlockSchema,
  featureListBlockSchema,
  socialLinksBlockSchema,
  productGalleryBlockSchema,
  productInfoBlockSchema,
  productLongDescriptionBlockSchema,
  productRelatedBlockSchema,
  catalogGridBoundBlockSchema,
]);

export const blocksArraySchema = z.array(blockSchema);

export type Block = z.infer<typeof blockSchema>;
export type BlockType = Block["type"];

export type HeroData = z.infer<typeof heroDataSchema>;
export type TextData = z.infer<typeof textDataSchema>;
export type ProductGridData = z.infer<typeof productGridDataSchema>;
export type CategoryGridData = z.infer<typeof categoryGridDataSchema>;
export type ImageGalleryData = z.infer<typeof imageGalleryDataSchema>;
export type ImageCarouselData = z.infer<typeof imageCarouselDataSchema>;
export type IntroHeroData = z.infer<typeof introHeroDataSchema>;
export type CouponPopupData = z.infer<typeof couponPopupDataSchema>;
export type CtaBannerData = z.infer<typeof ctaBannerDataSchema>;
export type FaqData = z.infer<typeof faqDataSchema>;
export type ContactInfoData = z.infer<typeof contactInfoDataSchema>;
export type TestimonialsData = z.infer<typeof testimonialsDataSchema>;
export type NewsletterData = z.infer<typeof newsletterDataSchema>;
export type ImageTextSplitData = z.infer<typeof imageTextSplitDataSchema>;
export type VideoEmbedData = z.infer<typeof videoEmbedDataSchema>;
export type DividerData = z.infer<typeof dividerDataSchema>;
export type ProductGalleryData = z.infer<typeof productGalleryDataSchema>;
export type ProductInfoData = z.infer<typeof productInfoDataSchema>;
export type ProductLongDescriptionData = z.infer<typeof productLongDescriptionDataSchema>;
export type ProductRelatedData = z.infer<typeof productRelatedDataSchema>;
export type CatalogGridBoundData = z.infer<typeof catalogGridBoundDataSchema>;
export type StatsData = z.infer<typeof statsDataSchema>;
export type ShippingStripData = z.infer<typeof shippingStripDataSchema>;
export type FeatureListData = z.infer<typeof featureListDataSchema>;
export type SocialLinksData = z.infer<typeof socialLinksDataSchema>;

// --- Block metadata for the admin picker ---

export const BLOCK_TYPES: Array<{
  type: BlockType;
  label: string;
  description: string;
  allowedIn?: Array<"page" | "template-catalog" | "template-product-detail">;
}> = [
  { type: "hero", label: "Hero", description: "Banner com titulo, subtitulo, botao e imagem" },
  { type: "text", label: "Texto", description: "Bloco de texto com formatação (negrito, cor, listas, etc.)" },
  { type: "product-grid", label: "Grelha de Produtos", description: "Mostra produtos (mais vendidos, por categoria, ou todos)" },
  { type: "category-grid", label: "Grelha de Categorias", description: "Mostra cartoes de categorias" },
  { type: "image-gallery", label: "Galeria de Imagens", description: "Grelha de imagens" },
  { type: "image-carousel", label: "Carrossel de Imagens", description: "Slideshow de imagens com setas e swipe" },
  { type: "intro-hero", label: "Cabeçalho Inicial", description: "Cabeçalho de ecrã inteiro que desaparece ao fazer scroll" },
  { type: "coupon-popup", label: "Popup de Cupão", description: "Janela automática com código de desconto. Aparece N segundos depois de chegar à página." },
  { type: "cta-banner", label: "Banner CTA", description: "Seccao colorida com texto e botao" },
  { type: "faq", label: "FAQ", description: "Perguntas e respostas em acordeao" },
  { type: "contact-info", label: "Contacto", description: "Email, WhatsApp, Instagram, morada" },
  { type: "testimonials", label: "Testemunhos", description: "Citações de clientes com nome e avatar" },
  { type: "newsletter", label: "Newsletter", description: "Call-to-action para subscrição" },
  { type: "image-text-split", label: "Imagem + Texto", description: "Imagem ao lado de texto formatado" },
  { type: "video-embed", label: "Vídeo", description: "Embed de YouTube ou Vimeo" },
  { type: "divider", label: "Separador", description: "Linha visual entre secções" },
  { type: "stats", label: "Estatísticas", description: "Fila de números grandes com legendas" },
  { type: "shipping-strip", label: "Garantias", description: "Icones com texto curto (envios, pagamentos, etc.)" },
  { type: "feature-list", label: "Destaques", description: "Grelha de 3 colunas com icone, título e descrição" },
  { type: "social-links", label: "Redes Sociais", description: "Tiles com ícones das redes sociais da loja" },
  { type: "product-gallery", label: "Galeria do Produto", description: "Imagens do produto com thumbs", allowedIn: ["template-product-detail"] },
  { type: "product-info", label: "Info do Produto", description: "Nome, preço, descrição, botões", allowedIn: ["template-product-detail"] },
  { type: "product-long-description", label: "Descrição Longa", description: "Descrição detalhada do produto com formatação", allowedIn: ["template-product-detail"] },
  { type: "product-related", label: "Produtos Relacionados", description: "Grelha de produtos da mesma categoria", allowedIn: ["template-product-detail"] },
  { type: "catalog-grid-bound", label: "Grelha do Catálogo", description: "Produtos filtrados por categoria do URL", allowedIn: ["template-catalog"] },
];

export function blocksAllowedIn(
  context: "page" | "template-catalog" | "template-product-detail",
): typeof BLOCK_TYPES {
  return BLOCK_TYPES.filter((bt) => !bt.allowedIn || bt.allowedIn.includes(context));
}

// --- Preset instantiation helper ---

export function instantiatePreset(preset: Omit<Block, "id">): Block {
  return {
    id: nanoid(10),
    type: preset.type,
    data: structuredClone(preset.data),
  } as Block;
}

// --- Default data factories ---

export function createBlock(type: BlockType): Block {
  const id = nanoid(10);
  switch (type) {
    case "hero":
      return { id, type, data: { title: "", titleAccent: "", subtitle: "", buttonText: "", buttonUrl: "", imageUrl: "", imageFocal: { x: 50, y: 50 }, imageUrlMobile: "", imageFocalMobile: { x: 50, y: 50 }, slides: [], layout: "image-right" } };
    case "text":
      return { id, type, data: { html: "" } };
    case "product-grid":
      return { id, type, data: { title: "", subtitle: "", filter: "bestsellers", columns: "4", layout: "grid" } };
    case "category-grid":
      return { id, type, data: { title: "", subtitle: "", categories: [] } };
    case "image-gallery":
      return { id, type, data: { images: [] } };
    case "image-carousel":
      return { id, type, data: { images: [], aspectRatio: "landscape", autoplay: true } };
    case "intro-hero":
      return { id, type, data: { title: "", titleAccent: "", subtitle: "", buttonText: "", buttonUrl: "", imageUrl: "", overlayOpacity: 40, height: "full" } };
    case "coupon-popup":
      return { id, type, data: { title: "", subtitle: "", couponCode: "", buttonText: "Ir às compras", buttonUrl: "/catalogo", imageUrl: "", delaySeconds: 10, dismissDays: 7 } };
    case "cta-banner":
      return { id, type, data: { title: "", subtitle: "", buttonText: "", buttonUrl: "", bgColor: "ink", backgroundImage: "", align: "left" } };
    case "faq":
      return { id, type, data: { title: "", items: [] } };
    case "contact-info":
      return { id, type, data: { email: "", whatsapp: "", instagram: "", address: "" } };
    case "testimonials":
      return { id, type, data: { title: "", items: [] } };
    case "newsletter":
      return { id, type, data: { title: "", description: "", buttonText: "Subscrever", actionUrl: "" } };
    case "image-text-split":
      return { id, type, data: { imageUrl: "", imageAlt: "", imageFocal: { x: 50, y: 50 }, title: "", html: "", layout: "image-left", imageAspect: "landscape" } };
    case "video-embed":
      return { id, type, data: { url: "", title: "", caption: "" } };
    case "divider":
      return { id, type, data: { style: "line", spacing: "medium" } };
    case "stats":
      return { id, type, data: { title: "", items: [] } };
    case "shipping-strip":
      return { id, type, data: { items: [] } };
    case "feature-list":
      return { id, type, data: { title: "", subtitle: "", items: [] } };
    case "social-links":
      return { id, type, data: { title: "Segue-nos", subtitle: "", items: [] } };
    case "product-gallery":
      return { id, type, data: { showThumbs: true, showBadges: true } };
    case "product-info":
      return { id, type, data: {
        showBreadcrumbs: true,
        shippingInfo: "• Preparação: 3 a 5 dias úteis\n• Envios via CTT para Portugal Continental e Ilhas\n• Pagamento via MB Way, transferência bancária ou PayPal",
      } };
    case "product-long-description":
      return { id, type, data: { title: "" } };
    case "product-related":
      return { id, type, data: { title: "Talvez também gostes", limit: 4 } };
    case "catalog-grid-bound":
      return { id, type, data: { title: "", subtitle: "", showCategoryFilter: true, columns: "4" } };
  }
}
