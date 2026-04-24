import type { BlockType } from "./blocks";
import type { ProductWithExtras } from "./queries";

export const SAMPLE_PRODUCT: ProductWithExtras = {
  id: 1,
  slug: "tote-exemplo",
  name: "Tote Bag Exemplo",
  description: "Tote em algodão natural com bordado personalizado.",
  longDescription: "# Sobre a peça\n\nBordada à mão com o teu nome ou frase favorita.",
  priceCents: 2200,
  category: "tote-bags",
  stock: 10,
  unlimitedStock: false,
  bestseller: true,
  personalizable: true,
  active: true,
  sortOrder: 0,
  variantColorTitle: "Cor do produto",
  images: [
    { url: "https://picsum.photos/seed/tote-1/800/800", alt: "Tote frente", position: 0, kind: "image" },
    { url: "https://picsum.photos/seed/tote-2/800/800", alt: "Tote verso", position: 1, kind: "image" },
  ],
  colors: [
    { name: "Rosa", hex: "#ED7396", position: 0 },
    { name: "Preto", hex: "#111111", position: 1 },
  ],
  variantColors: [],
};

export const SAMPLE_PRODUCTS: ProductWithExtras[] = [
  SAMPLE_PRODUCT,
  { ...SAMPLE_PRODUCT, id: 2, slug: "tshirt-a", name: "T-shirt A", category: "t-shirts", priceCents: 1800 },
  { ...SAMPLE_PRODUCT, id: 3, slug: "necessaire-a", name: "Necessaire A", category: "necessaire", priceCents: 1600 },
  { ...SAMPLE_PRODUCT, id: 4, slug: "frasco-a", name: "Frasco A", category: "frascos-vidro", priceCents: 900 },
];

export const SAMPLE_BLOCK_DATA: Record<BlockType, any> = {
  hero: {
    title: "Peças feitas à mão",
    titleAccent: "para ti",
    subtitle: "Totes, t-shirts e acessórios com bordado personalizado.",
    buttonText: "Ver catálogo",
    buttonUrl: "/catalogo",
    imageUrl: "https://picsum.photos/seed/hero/1200/600",
    layout: "image-right",
  },
  text: { html: "<h2>Sobre</h2><p>Peças <strong>feitas à mão</strong> em Portugal.</p>" },
  "product-grid": { title: "Mais vendidos", subtitle: "Os favoritos desta semana", filter: "bestsellers", columns: "4", layout: "grid" },
  "category-grid": { title: "Categorias", subtitle: "", categories: ["tote-bags", "t-shirts", "necessaire"] },
  "image-gallery": {
    images: [
      { url: "https://picsum.photos/seed/g1/600/600", alt: "" },
      { url: "https://picsum.photos/seed/g2/600/600", alt: "" },
      { url: "https://picsum.photos/seed/g3/600/600", alt: "" },
    ],
  },
  "cta-banner": { title: "Pronta para encomendar?", subtitle: "Envios para Portugal Continental e Ilhas.", buttonText: "Encomendar", buttonUrl: "/catalogo", bgColor: "ink", backgroundImage: "", align: "left" },
  faq: {
    title: "Perguntas frequentes",
    items: [
      { question: "Quanto tempo demora?", answer: "3 a 5 dias úteis." },
      { question: "Fazem envios para os Açores?", answer: "Sim, via CTT." },
    ],
  },
  "contact-info": { email: "ola@adrianas.pt", whatsapp: "+351 912 345 678", instagram: "@adrianas.store", address: "Lisboa, Portugal" },
  testimonials: {
    title: "O que dizem as clientes",
    items: [
      { name: "Mariana", quote: "Adoro a tote que pedi — o bordado está perfeito.", avatarUrl: "https://picsum.photos/seed/av1/80/80" },
      { name: "Sofia", quote: "Presente ideal, chegou super rápido.", avatarUrl: "https://picsum.photos/seed/av2/80/80" },
    ],
  },
  newsletter: { title: "Recebe novidades", description: "Sem spam, só lançamentos.", buttonText: "Subscrever", actionUrl: "mailto:ola@adrianas.pt" },
  "image-text-split": {
    imageUrl: "https://picsum.photos/seed/split/800/800",
    imageAlt: "Peça bordada",
    title: "Feito por mãos portuguesas",
    html: "<p>Cada peça é <strong>bordada à mão</strong> no nosso atelier.</p>",
    layout: "image-left",
    imageAspect: "landscape",
  },
  "video-embed": { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", title: "Bastidores", caption: "Como bordamos cada peça." },
  divider: { style: "line", spacing: "medium" },
  "product-gallery": { showThumbs: true, showBadges: true },
  "product-info": { showBreadcrumbs: true, shippingInfo: "• Preparação: 3 a 5 dias úteis\n• Envios via CTT para Portugal Continental e Ilhas\n• Pagamento via MB Way, transferência bancária ou PayPal" },
  "product-long-description": { title: "" },
  "product-related": { title: "Talvez também gostes", limit: 4 },
  "catalog-grid-bound": { title: "Catálogo", subtitle: "Todas as peças", showCategoryFilter: true, columns: "4" },
  stats: {
    title: "Peças feitas à mão",
    items: [
      { value: "500+", label: "peças vendidas" },
      { value: "1.2k", label: "clientes felizes" },
      { value: "5", label: "anos a bordar" },
      { value: "100%", label: "feitas em Portugal" },
    ],
  },
  "shipping-strip": {
    items: [
      { icon: "truck", title: "Envios rápidos", subtitle: "3-5 dias úteis" },
      { icon: "lock", title: "Pagamento seguro", subtitle: "MB Way, transferência, PayPal" },
      { icon: "return", title: "Devoluções", subtitle: "até 14 dias" },
      { icon: "flag", title: "Feito em Portugal", subtitle: "bordado à mão" },
    ],
  },
  "feature-list": {
    title: "Porquê escolher-nos",
    subtitle: "Cada peça é única, feita para durar.",
    items: [
      { icon: "heart", title: "Personalização", description: "Escolhe frase, cor e tipografia." },
      { icon: "sparkle", title: "Feito à mão", description: "Bordado artesanal em Portugal." },
      { icon: "shield", title: "Qualidade", description: "Materiais selecionados à mão." },
    ],
  },
};
