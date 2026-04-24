import { z } from "zod";
import { FONT_NAMES } from "./fonts";
import { deriveScale, isValidHex, SHADE_KEYS } from "./theme-colors";

// This module is pure: no DB, no server-only imports. Safe to import from
// React islands and client-side bundles. Server-only helpers (DB loader,
// cache) live in `./config-server.ts`.

// ---------- Zod schemas ----------

const hexSchema = z.string().refine(isValidHex, "Hex inválido (ex: #F691B4)");

export const themeSchema = z.object({
  colors: z.object({
    primary: hexSchema,
    neutral: hexSchema,
    accent: hexSchema.nullable(),
  }),
  fonts: z.object({
    body: z.string().refine((n) => FONT_NAMES.includes(n), "Fonte não suportada"),
    display: z.string().refine((n) => FONT_NAMES.includes(n), "Fonte não suportada"),
  }),
  logo: z.object({
    url: z.string().url().nullable(),
    alt: z.string().min(1).max(200),
  }),
  radius: z.enum(["none", "soft", "rounded", "pill"]),
});

const linkSchema = z.object({
  href: z.string().refine(
    (s) => s.startsWith("/") || s.startsWith("http://") || s.startsWith("https://") || s.startsWith("mailto:"),
    "URL deve começar por /, http(s):// ou mailto:",
  ),
  label: z.string().min(1).max(100),
});

export const globalsSchema = z.object({
  identity: z.object({
    name: z.string().min(1).max(100),
    tagline: z.string().min(1).max(200),
    description: z.string().min(1).max(500),
    email: z.string().email(),
    whatsapp: z.string().min(1).max(30),
    instagram: z.string().min(1).max(100),
    shippingProvider: z.string().min(1).max(50),
    preparationDays: z.string().min(1).max(50),
  }),
  nav: z.array(linkSchema).min(1).max(10),
  footer: z.object({
    columns: z.array(
      z.object({
        heading: z.string().min(1).max(50),
        links: z.array(linkSchema).min(1).max(10),
      }),
    ).max(5),
    bottomText: z.string().min(1).max(200),
  }),
  banner: z.object({
    enabled: z.boolean(),
    text: z.string().max(200),
    linkUrl: z.string().nullable(),
    bgColor: z.enum(["rosa", "ink"]),
    dismissible: z.boolean(),
  }),
  payments: z.array(
    z.object({
      id: z.enum(["mbway", "transferencia", "paypal"]),
      label: z.string().min(1).max(50),
      instructions: z.string().min(1).max(500),
    }),
  ).min(1).max(3),
});

export const siteConfigSchema = z.object({
  theme: themeSchema,
  globals: globalsSchema,
});

export type Theme = z.infer<typeof themeSchema>;
export type Globals = z.infer<typeof globalsSchema>;
export type SiteConfig = z.infer<typeof siteConfigSchema>;

// ---------- Default (used as fallback + seed source) ----------

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  theme: {
    colors: { primary: "#F691B4", neutral: "#111111", accent: null },
    fonts: { body: "Inter", display: "Inter" },
    logo: { url: null, alt: "Drisclub" },
    radius: "rounded",
  },
  globals: {
    identity: {
      name: "Drisclub",
      tagline: "Peças personalizadas com carinho",
      description:
        "Loja portuguesa de t-shirts, tote bags, bolsas necessaire e muito mais. Cada peça é personalizada à mão, com a tua frase ou ideia.",
      email: "drisclub.shop@gmail.com",
      whatsapp: "+351 912 345 678",
      instagram: "@adrianas.store",
      shippingProvider: "CTT",
      preparationDays: "3 a 5 dias úteis",
    },
    nav: [
      { href: "/", label: "Início" },
      { href: "/catalogo", label: "Catálogo" },
      { href: "/sobre-nos", label: "Sobre Nós" },
      { href: "/como-encomendar", label: "Como Encomendar" },
    ],
    footer: {
      columns: [
        {
          heading: "Navegação",
          links: [
            { href: "/catalogo", label: "Catálogo" },
            { href: "/sobre-nos", label: "Sobre Nós" },
            { href: "/como-encomendar", label: "Como Encomendar" },
            { href: "/termos-condicoes", label: "Termos & Condições" },
          ],
        },
      ],
      bottomText: "Todos os direitos reservados.",
    },
    banner: {
      enabled: false,
      text: "",
      linkUrl: null,
      bgColor: "rosa",
      dismissible: true,
    },
    payments: [
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
          "IBAN: PT50 0000 0000 0000 0000 0000 0\nTitular: Drisclub\nEnvia o comprovativo por email indicando o teu nome e número de encomenda.",
      },
      {
        id: "paypal",
        label: "PayPal",
        instructions:
          "Envia o pagamento para drisclub.shop@gmail.com (opção 'Family & Friends') indicando o teu nome e número de encomenda.",
      },
    ],
  },
};

// ---------- CSS + fonts renderers (pure) ----------

/**
 * Generates a CSS string that overrides the Tailwind @theme variables
 * for rosa-* and ink-* shades based on the theme colors.
 * Also sets radius tokens.
 */
export function renderThemeCSS(theme: Theme): string {
  const rosa = deriveScale(theme.colors.primary);
  const neutral = deriveNeutralShades(theme.colors.neutral);
  const radiusValue = RADIUS_MAP[theme.radius];

  const lines: string[] = [":root {"];
  for (const k of SHADE_KEYS) {
    lines.push(`  --color-rosa-${k}: ${rosa[k]};`);
  }
  lines.push(`  --color-ink: ${neutral.base};`);
  lines.push(`  --color-ink-soft: ${neutral.soft};`);
  lines.push(`  --color-ink-muted: ${neutral.muted};`);
  lines.push(`  --color-ink-line: ${neutral.line};`);
  lines.push(`  --font-sans: "${theme.fonts.body}", ui-sans-serif, system-ui, sans-serif;`);
  lines.push(`  --font-display: "${theme.fonts.display}", ui-sans-serif, system-ui, sans-serif;`);
  lines.push(`  --radius-site: ${radiusValue};`);
  lines.push("}");
  return lines.join("\n");
}

const RADIUS_MAP = {
  none: "0px",
  soft: "6px",
  rounded: "16px",
  pill: "9999px",
} as const;

function deriveNeutralShades(baseHex: string): {
  base: string; soft: string; muted: string; line: string;
} {
  // For neutrals we keep hue/saturation but shift lightness away from the base.
  const scale = deriveScale(baseHex);
  return {
    base: baseHex,
    soft: scale["600"],
    muted: scale["400"],
    line: scale["100"],
  };
}

export function renderGoogleFontsHref(fonts: Theme["fonts"]): string {
  const needed = new Set([fonts.body, fonts.display]);
  const params: string[] = [];
  for (const name of needed) {
    const encoded = name.replace(/ /g, "+");
    // We request 400, 500, 600, 700 for every font; Google dedupes at delivery.
    params.push(`family=${encoded}:wght@400;500;600;700`);
  }
  return `https://fonts.googleapis.com/css2?${params.join("&")}&display=swap`;
}
