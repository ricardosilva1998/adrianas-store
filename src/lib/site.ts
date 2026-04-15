export const site = {
  name: "Adriana's Store",
  tagline: "Peças personalizadas com carinho",
  description:
    "Loja portuguesa de t-shirts, tote bags, bolsas necessaire e muito mais. Cada peça é personalizada à mão, com a tua frase ou ideia.",
  email: "ola@adrianastore.pt",
  whatsapp: "+351 912 345 678",
  instagram: "@adrianas.store",
  shippingProvider: "CTT",
  preparationDays: "3 a 5 dias úteis",
} as const;

export const navLinks = [
  { href: "/", label: "Início" },
  { href: "/catalogo", label: "Catálogo" },
  { href: "/sobre-nos", label: "Sobre Nós" },
  { href: "/como-encomendar", label: "Como Encomendar" },
] as const;

export const footerLinks = [
  { href: "/catalogo", label: "Catálogo" },
  { href: "/sobre-nos", label: "Sobre Nós" },
  { href: "/como-encomendar", label: "Como Encomendar" },
  { href: "/termos-condicoes", label: "Termos & Condições" },
] as const;

export const categories = [
  { slug: "tote-bags", label: "Tote Bags" },
  { slug: "t-shirts", label: "T-Shirts" },
  { slug: "necessaire", label: "Bolsas Necessaire" },
  { slug: "frascos-vidro", label: "Frascos de Vidro" },
  { slug: "porta-chaves", label: "Porta-Chaves" },
  { slug: "capas-telemovel", label: "Capas de Telemóvel" },
  { slug: "garrafas", label: "Garrafas de Água" },
  { slug: "porta-joias", label: "Porta-Joias" },
] as const;

export type CategorySlug = (typeof categories)[number]["slug"];

export const categoryLabel = (slug: CategorySlug): string =>
  categories.find((c) => c.slug === slug)?.label ?? slug;

export const paymentMethods = [
  {
    id: "mbway",
    label: "MB Way",
    instructions:
      "Envia o pagamento para o número 912 345 678 indicando o teu nome e número de encomenda.",
  },
  {
    id: "transferencia",
    label: "Transferência Bancária",
    instructions:
      "IBAN: PT50 0000 0000 0000 0000 0000 0\nTitular: Adriana's Store\nEnvia o comprovativo por email indicando o teu nome e número de encomenda.",
  },
  {
    id: "paypal",
    label: "PayPal",
    instructions:
      "Envia o pagamento para ola@adrianastore.pt (opção 'Family & Friends') indicando o teu nome e número de encomenda.",
  },
] as const;

export type PaymentMethodId = (typeof paymentMethods)[number]["id"];

export const formatEuro = (value: number): string =>
  new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(value);
