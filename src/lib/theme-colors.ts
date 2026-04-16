// HSL-based shade derivation.
// Given a single base hex, produce a full 50→700 scale.
// The lightness/saturation curve is tuned so the default primary (#F691B4)
// yields shades close to the current rosa-* palette.

const SHADE_LIGHTNESS: Record<string, number> = {
  "50": 0.97,
  "100": 0.92,
  "200": 0.85,
  "300": 0.75,
  "400": 0.65,
  "500": 0.55,
  "600": 0.42,
  "700": 0.32,
};

const SHADE_SATURATION_SCALE: Record<string, number> = {
  "50": 0.85,
  "100": 0.9,
  "200": 0.95,
  "300": 1.0,
  "400": 1.0,
  "500": 1.0,
  "600": 0.95,
  "700": 0.9,
};

export const SHADE_KEYS = ["50", "100", "200", "300", "400", "500", "600", "700"] as const;
export type Shade = (typeof SHADE_KEYS)[number];

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: h * 360, s, l };
}

export function hslToHex(h: number, s: number, l: number): string {
  const hue = h / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const toRgb = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  const r = Math.round(toRgb(hue + 1 / 3) * 255);
  const g = Math.round(toRgb(hue) * 255);
  const b = Math.round(toRgb(hue - 1 / 3) * 255);
  return (
    "#" +
    [r, g, b]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
  );
}

export function deriveScale(baseHex: string): Record<Shade, string> {
  const { h, s } = hexToHsl(baseHex);
  const out = {} as Record<Shade, string>;
  for (const key of SHADE_KEYS) {
    const targetL = SHADE_LIGHTNESS[key];
    const targetS = Math.min(1, s * SHADE_SATURATION_SCALE[key]);
    out[key] = hslToHex(h, targetS, targetL);
  }
  return out;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
export function isValidHex(value: string): boolean {
  return HEX_RE.test(value);
}
