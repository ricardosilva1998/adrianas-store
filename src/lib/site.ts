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

export const formatEuro = (value: number): string =>
  new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(value);
