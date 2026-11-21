// The color system of tomasmuller.dev: twelve hues, two bands.
//
// Twelve hues sit 30° apart on the OKLCH wheel, anchored at ruby (step 0, hue 30°).
// Each hue has a light swatch and a deep swatch, as saturated as sRGB allows.
// A pair is any light swatch with any deep one: 144 combinations.
// Legibility comes from the lightness gap, so every pair passes by the same rule.
//
//   node _tools/swatches.mjs      prints the tables that index.html embeds
//   node --test                   checks that index.html still matches them
//
// The underscore keeps this folder out of the published site (Jekyll skips it).

export const HUE_ANCHOR = 30; // ruby
export const BANDS = {
  // [lightness, chroma cap]
  normal: { light: [0.88, 0.15], deep: [0.33, 0.16] },
  // used when the visitor asks for more contrast
  more: { light: [0.9, 0.15], deep: [0.3, 0.16] },
};

export function oklchToLinear(L, C, h) {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (rgb) => rgb.every((c) => c >= -1e-4 && c <= 1 + 1e-4);

export function maxChroma(L, h, cap) {
  let lo = 0;
  let hi = cap;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklchToLinear(L, mid, h))) lo = mid;
    else hi = mid;
  }
  return lo;
}

const clamp01 = (c) => Math.min(1, Math.max(0, c));
const encode = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const decode = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

export function hexOf(rgb) {
  return '#' + rgb.map((c) => Math.round(encode(clamp01(c)) * 255).toString(16).padStart(2, '0')).join('');
}

// WCAG 2 relative luminance of a hex color, measured on the rounded value the page really paints.
export function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => decode(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(hexA, hexB) {
  const [hi, lo] = [luminance(hexA), luminance(hexB)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function swatch(L, cap, step) {
  const h = (HUE_ANCHOR + 30 * step) % 360;
  const C = maxChroma(L, h, cap);
  return { step, h, L, C, hex: hexOf(oklchToLinear(L, C, h)) };
}

export function band(name, which) {
  const [L, cap] = BANDS[name][which];
  return Array.from({ length: 12 }, (_, step) => swatch(L, cap, step));
}

export function worstContrast(lights, deeps) {
  let worst = Infinity;
  for (const l of lights) for (const d of deeps) worst = Math.min(worst, contrast(l, d));
  return worst;
}

// The compact form embedded in index.html: twelve hex colors without the '#'.
export const pack = (swatches) => swatches.map((s) => s.hex.slice(1)).join('');

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const name of Object.keys(BANDS)) {
    const light = band(name, 'light');
    const deep = band(name, 'deep');
    console.log(`\n${name}`);
    console.log('step  hue  light                         deep');
    for (let i = 0; i < 12; i++) {
      const f = (s) => `${s.hex}  oklch(${s.L} ${s.C.toFixed(3)} ${s.h})`.padEnd(30);
      console.log(`${String(i).padStart(4)}  ${String(light[i].h).padStart(3)}  ${f(light[i])}${f(deep[i])}`);
    }
    const worst = worstContrast(light.map((s) => s.hex), deep.map((s) => s.hex));
    console.log(`worst of 144 pairs: ${worst.toFixed(2)}:1`);
    console.log(`light  '${pack(light)}'`);
    console.log(`deep   '${pack(deep)}'`);
  }
}
