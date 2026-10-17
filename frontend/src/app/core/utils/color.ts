// Accent colour maths: turns one picked colour into all the accent design tokens, and keeps
// text readable (WCAG contrast ≥ 4.6) whatever colour is picked. Ported from the design's theme engine.

type Rgb = [number, number, number];

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];
const INK_LIGHT: Rgb = [15, 23, 42];    // --ink in the light theme
const INK_DARK: Rgb = [248, 250, 252];  // --ink in the dark theme
// What accent-coloured text sits on: the page and the glass cards, per theme.
const BACKGROUNDS: Record<'light' | 'dark', Rgb[]> = {
  light: [[238, 242, 250], [241, 243, 253], [255, 255, 255]],
  dark: [[10, 15, 36], [24, 30, 58], [22, 28, 46]],
};
const MIN_CONTRAST = 4.6;

export function hexToRgb(hex: string): Rgb {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0) as Rgb;
}

export const rgbToHex = (c: Rgb) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();

const mix = (a: Rgb, b: Rgb, t: number): Rgb => a.map((v, i) => v * (1 - t) + b[i] * t) as Rgb;
const rgba = (c: Rgb, a: number) => `rgba(${c.map(Math.round).join(', ')}, ${a})`;

function luminance(c: Rgb) {
  const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: Rgb, b: Rgb) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const minContrast = (c: Rgb, list: Rgb[]) => Math.min(...list.map((b) => contrast(c, b)));

/** All `--accent…` CSS variables for one picked colour in one theme. */
export function accentTokens(hex: string, mode: 'light' | 'dark'): Record<string, string> {
  let acc = hexToRgb(hex);
  const grad = () => [mix(acc, WHITE, 0.08), mix(acc, BLACK, 0.14)];
  // Text on accent buttons: white or ink, whichever reads better; nudge the accent until it passes.
  let [g1, g2] = grad();
  const onAcc = minContrast(WHITE, [g1, g2]) >= minContrast(INK_LIGHT, [g1, g2]) ? WHITE : INK_LIGHT;
  for (let k = 0; k < 30 && minContrast(onAcc, [g1, g2]) < MIN_CONTRAST; k++) {
    acc = mix(acc, onAcc === WHITE ? BLACK : WHITE, 0.05);
    [g1, g2] = grad();
  }
  // Accent-coloured text (links, active menu item) must read on the page and on cards.
  const bgs = BACKGROUNDS[mode];
  const ink = mode === 'dark' ? INK_DARK : INK_LIGHT;
  let accInk = acc;
  for (let k = 0; k < 40 && minContrast(accInk, bgs) < MIN_CONTRAST; k++) accInk = mix(accInk, ink, 0.1);

  return {
    '--accent': rgbToHex(acc),
    '--accent-grad': `linear-gradient(180deg, ${rgbToHex(g1)}, ${rgbToHex(g2)})`,
    '--accent-shadow': `0 8px 20px -8px ${rgba(acc, 0.6)}, inset 0 1px 0 rgba(255, 255, 255, .3)`,
    '--accent-ring': rgba(acc, 0.28),
    '--accent-ink': rgbToHex(accInk),
    '--accent-glow': rgba(acc, mode === 'dark' ? 0.32 : 0.26),
    '--on-accent': rgbToHex(onAcc),
    '--on-accent-2': rgbToHex(mix(onAcc, g2, 0.22)),
  };
}
