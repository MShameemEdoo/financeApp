// ─────────────────────────────────────────────────────────────────────────────
// Colour palettes. Every colour the UI draws comes from here — nothing is
// hard-coded in screens — so a theme switch recolours the whole app.
//
// Contrast (WCAG): every text colour is ≥ 4.5:1 on bg / surface / card / card2 in
// BOTH palettes, and `bg` text on accent / income / expense / blue fills is ≥ 4.5:1.
// In light mode the brand lime is too pale to read as text on white, so `accent`
// becomes a deep green there; fills still use it with `bg`-coloured text.
// ─────────────────────────────────────────────────────────────────────────────

const dark = {
  bg: '#09090F',
  surface: '#13141F',
  card: '#191A2E',
  card2: '#1E2040',
  accent: '#B5FF4D',
  accentDim: 'rgba(181,255,77,0.10)',
  income: '#4FE3A0',
  incomeDim: 'rgba(79,227,160,0.10)',
  expense: '#FF5C5C',
  expenseDim: 'rgba(255,92,92,0.10)',
  purple: '#A58CEB',
  purpleDim: 'rgba(165,140,235,0.12)',
  orange: '#FFA500',
  orangeDim: 'rgba(255,165,0,0.10)',
  blue: '#5B8DEF',
  blueDim: 'rgba(91,141,239,0.12)',
  pink: '#FF69B4',
  pinkDim: 'rgba(255,105,180,0.10)',
  text: '#EDF0F8',
  textSecondary: '#A9B0CE',
  muted: '#868EB0',
  disabled: '#4A5070',          // decorative only, never for text that must be read
  overlay: 'rgba(0,0,0,0.65)',  // dim behind sheets and dialogs
  border: 'rgba(255,255,255,0.07)',
  borderHover: 'rgba(255,255,255,0.12)',
  subtle: 'rgba(255,255,255,0.04)',   // faint inset tiles
  track: 'rgba(255,255,255,0.08)',    // empty part of progress bars
  handle: 'rgba(255,255,255,0.18)',   // grab handle on sheets
  toast: '#262945', toastText: '#EDF0F8', toastAction: '#B5FF4D', toastBorder: 'rgba(255,255,255,0.12)',
  incomeSurface: '#152220',           // budget overview card
  success: '#4FE3A0',
  warning: '#FFA500',
  danger: '#FF5C5C',
};

const light = {
  bg: '#EEF1F8',
  surface: '#F8F9FD',
  card: '#FFFFFF',
  card2: '#E8ECF6',
  accent: '#366B08',
  accentDim: 'rgba(54,107,8,0.10)',
  income: '#087548',
  incomeDim: 'rgba(8,117,72,0.10)',
  expense: '#C42626',
  expenseDim: 'rgba(196,38,38,0.09)',
  purple: '#6742C4',
  purpleDim: 'rgba(103,66,196,0.10)',
  orange: '#8F5200',
  orangeDim: 'rgba(143,82,0,0.10)',
  blue: '#2859D0',
  blueDim: 'rgba(40,89,208,0.10)',
  pink: '#AD1556',
  pinkDim: 'rgba(173,21,86,0.09)',
  text: '#12142B',
  textSecondary: '#454C6B',
  muted: '#586080',
  disabled: '#B7BDD3',
  overlay: 'rgba(14,18,40,0.50)',
  border: 'rgba(18,20,43,0.10)',
  borderHover: 'rgba(18,20,43,0.20)',
  subtle: 'rgba(18,20,43,0.04)',
  track: 'rgba(18,20,43,0.08)',
  handle: 'rgba(18,20,43,0.20)',
  toast: '#1B1E3A', toastText: '#F4F6FB', toastAction: '#B5FF4D', toastBorder: 'rgba(255,255,255,0.12)',   // toast stays dark in light mode (inverse)
  incomeSurface: '#E3F3EA',
  success: '#087548',
  warning: '#8F5200',
  danger: '#C42626',
};

export const palettes = { dark, light };

// Text styles depend on the palette (they carry a colour), so they are built from it.
const typographyCache = new WeakMap();
export function typographyFor(colors) {
  let t = typographyCache.get(colors);
  if (!t) {
    t = {
      h1: { fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
      h2: { fontSize: 22, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
      h3: { fontSize: 18, fontWeight: '700', color: colors.text },
      h4: { fontSize: 15, fontWeight: '700', color: colors.text },
      body: { fontSize: 15, fontWeight: '400', color: colors.text },
      bodyMed: { fontSize: 15, fontWeight: '500', color: colors.text },
      caption: { fontSize: 12.5, fontWeight: '400', color: colors.muted },
      captionMed: { fontSize: 12.5, fontWeight: '600', color: colors.muted },
      tiny: { fontSize: 11, fontWeight: '600', color: colors.muted },
      label: { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
      number: { fontSize: 36, fontWeight: '700', color: colors.text, letterSpacing: -1.5 },
    };
    typographyCache.set(colors, t);
  }
  return t;
}

// ── Readable shade of a user-chosen colour ───────────────────────────────────
// Category / account colours are the user's choice (lime, yellow, grey…). As a bar or a dot
// that's fine, but as TEXT or an icon they can be unreadable on the current card colour.
// This nudges a colour toward black (light theme) or white (dark theme) until it reaches 4.5:1.
const toRgb = hex => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return null;
  return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16));
};
const relLum = ([r, g, b]) => {
  const f = c => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => { const [hi, lo] = [relLum(a), relLum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const toHex = rgb => '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');

export function readableOn(color, background, isDark, min = 4.5) {
  const c = toRgb(color), bg = toRgb(background);
  if (!c || !bg) return color;                       // not a plain #rrggbb → leave as is
  if (ratio(c, bg) >= min) return color;
  const target = isDark ? [255, 255, 255] : [0, 0, 0];
  for (let t = 0.08; t <= 1.0001; t += 0.08) {
    const mixed = c.map((v, i) => v + (target[i] - v) * t);
    if (ratio(mixed, bg) >= min) return toHex(mixed);
  }
  return toHex(target);
}
