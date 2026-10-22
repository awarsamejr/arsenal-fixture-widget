// Turns a club's colours as football-data.org writes them ("Royal Blue / White")
// into an accent colour for the theme.

const NAMED: Record<string, string> = {
  red: "#e30613",
  "dark red": "#9b1b30",
  claret: "#7a1e3a",
  maroon: "#7a1f2b",
  burgundy: "#800020",
  wine: "#722f37",
  crimson: "#c8102e",
  scarlet: "#ff2400",
  blue: "#1d4ed8",
  "royal blue": "#034694",
  "sky blue": "#6cabdd",
  "light blue": "#5fa8d3",
  "navy blue": "#132257",
  navy: "#132257",
  "dark blue": "#1b2a6b",
  azure: "#0072ce",
  green: "#16a34a",
  "dark green": "#0b6623",
  "bottle green": "#006a4e",
  yellow: "#facc15",
  gold: "#c9a227",
  amber: "#f59e0b",
  orange: "#f97316",
  purple: "#6d28d9",
  violet: "#7c3aed",
  white: "#ffffff",
  black: "#111111",
  grey: "#9ca3af",
  gray: "#9ca3af",
  silver: "#c0c0c0",
  brown: "#7c4a1e",
  pink: "#ec4899",
};

const FALLBACK = "#4f46e5"; // neutral indigo

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio against white text. */
export function contrastWithWhite(hex: string): number {
  return 1.05 / (luminance(hex) + 0.05);
}

function mix(hex: string, other: string, amount: number): string {
  const a = hexToRgb(hex);
  const b = hexToRgb(other);
  return rgbToHex([0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * amount) as [number, number, number]);
}

/** Darkens a colour step by step until white text on it is readable (3:1). */
function readable(hex: string): string {
  let out = hex;
  for (let i = 0; i < 10 && contrastWithWhite(out) < 3; i++) out = mix(out, "#000000", 0.12);
  return out;
}

/** True if the colour would vanish on the near-black background, or is plain white. */
function unusable(hex: string): boolean {
  const l = luminance(hex);
  return l < 0.02 || l > 0.85;
}

/** The theme accent for "Red / White", "Navy Blue / White", "White / Black"... */
export function accentFromClubColors(colors: string | null | undefined): string {
  const names = (colors ?? "")
    .split(/[\/,&]| and /i)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  for (const name of names) {
    const hex = NAMED[name];
    if (hex && !unusable(hex)) return readable(hex);
  }
  // Navy and similar are too dark as an accent on a dark theme; lighten instead
  for (const name of names) {
    const hex = NAMED[name];
    if (hex && name !== "black" && luminance(hex) < 0.02) return readable(mix(hex, "#ffffff", 0.35));
  }
  return FALLBACK;
}

/** A darker shade for hover states. */
export function darker(hex: string): string {
  return mix(hex, "#000000", 0.3);
}

/** Applies the team colour to the whole app. */
export function applyAccent(colors: string | null | undefined): void {
  const accent = accentFromClubColors(colors);
  const root = document.documentElement.style;
  root.setProperty("--color-accent", accent);
  root.setProperty("--color-accent-dark", darker(accent));
}
