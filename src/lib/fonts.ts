export type FontFamily = {
  name: string;          // Google Fonts family name, exact
  fallback: string;      // CSS fallback stack suffix
  category: "sans" | "serif" | "display" | "handwriting";
  weights: number[];     // weights we request via the CSS2 link
};

export const FONT_FAMILIES: FontFamily[] = [
  { name: "Inter", fallback: "system-ui, sans-serif", category: "sans", weights: [400, 500, 600, 700] },
  { name: "Manrope", fallback: "system-ui, sans-serif", category: "sans", weights: [400, 500, 600, 700] },
  { name: "DM Sans", fallback: "system-ui, sans-serif", category: "sans", weights: [400, 500, 700] },
  { name: "Work Sans", fallback: "system-ui, sans-serif", category: "sans", weights: [400, 500, 600, 700] },
  { name: "Nunito", fallback: "system-ui, sans-serif", category: "sans", weights: [400, 600, 700] },
  { name: "Playfair Display", fallback: "Georgia, serif", category: "serif", weights: [400, 600, 700] },
  { name: "Cormorant Garamond", fallback: "Georgia, serif", category: "serif", weights: [400, 500, 700] },
  { name: "Lora", fallback: "Georgia, serif", category: "serif", weights: [400, 500, 700] },
  { name: "Fraunces", fallback: "Georgia, serif", category: "serif", weights: [400, 500, 700] },
  { name: "Space Grotesk", fallback: "system-ui, sans-serif", category: "display", weights: [400, 500, 700] },
  { name: "Archivo", fallback: "system-ui, sans-serif", category: "display", weights: [400, 500, 700] },
  { name: "Caveat", fallback: "cursive", category: "handwriting", weights: [400, 600, 700] },
];

export const FONT_NAMES: string[] = FONT_FAMILIES.map((f) => f.name);

export function getFont(name: string): FontFamily | undefined {
  return FONT_FAMILIES.find((f) => f.name === name);
}

export function isValidFontName(name: string): boolean {
  return FONT_NAMES.includes(name);
}
