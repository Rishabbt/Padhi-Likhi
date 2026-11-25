export const FG =  ['#A78BFA',
  '#4ADE80', 
  '#F472B6', 
  '#60A5FA', 
  '#FBBF24' ];
export const BG = ['#fff3a3', '#ffd6d6', '#ffe0b3', '#d6f5e0', '#cfe8ff', '#ead6ff', '#e0e0e0', 'transparent'];
export const SOL = ['#dbeafe', '#fecaca', '#fde68a', '#bbf7d0', '#e9d5ff', '#fbcfe8', '#ffffff', '#1d4ed8', '#1b1b1b'];
export const GR: [string, string][] = [
  ['#ff9a8b', '#ff6a88'], ['#f6d365', '#fda085'], ['#43e97b', '#38f9d7'], ['#4facfe', '#00f2fe'],
  ['#a18cd1', '#fbc2eb'], ['#30cfd0', '#330867'], ['#ff758c', '#ff7eb3'], ['#cfd9df', '#e2ebf0'],
];
export const SZ = [12, 14, 16, 18, 24, 32, 48];
export const FT = ['Georgia', 'Segoe UI', 'Arial', 'Courier New', 'Trebuchet MS'];

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
export const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ESC[c]);

export const uid = () => 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const sid = () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const fid = () => 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function hx(h: number, s: number, l: number) {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
      .toString(16)
      .padStart(2, '0');
  };
  return '#' + f(0) + f(8) + f(4);
}
export const rnd = () => hx(Math.random() * 360, 65 + Math.random() * 20, 60 + Math.random() * 12);

/** Lighten a #rrggbb color toward white (used for shapes created by the pen). */
export function tint(c: string) {
  const n = parseInt(c.slice(1), 16);
  const f = (v: number) => Math.round(255 - (255 - v) * 0.25).toString(16).padStart(2, '0');
  return '#' + f((n >> 16) & 255) + f((n >> 8) & 255) + f(n & 255);
}

/** Accepts only plain CSS color values so imported data can't smuggle other CSS into styles. */
export function safeColor(c: unknown, fallback = '#cccccc'): string {
  if (typeof c !== 'string') return fallback;
  const s = c.trim();
  return /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%/]+\)|transparent|[a-z]{3,20})$/i.test(s) ? s : fallback;
}

export function cssToRgb(c: string): [number, number, number] {
  let m = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})/i);
  if (m) {
    let h = m[1];
    if (h.length === 3) h = h.replace(/./g, '$&$&');
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
  }
  m = c.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  if (m) return [+m[1], +m[2], +m[3]];
  return [0, 0, 0];
}
