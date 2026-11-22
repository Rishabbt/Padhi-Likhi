import type { BoxKind, LineShape, Pt } from '../types';

export const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const pathLen = (p: Pt[]) => {
  let L = 0;
  for (let i = 1; i < p.length; i++) L += dist(p[i - 1], p[i]);
  return L;
};

export function resample(p: Pt[], n: number): Pt[] {
  const I = pathLen(p) / (n - 1);
  let D = 0;
  const o: Pt[] = [p[0]];
  p = p.slice();
  for (let i = 1; i < p.length; i++) {
    const d = dist(p[i - 1], p[i]);
    if (d > 0 && D + d >= I) {
      const t = (I - D) / d;
      const q: Pt = [p[i - 1][0] + t * (p[i][0] - p[i - 1][0]), p[i - 1][1] + t * (p[i][1] - p[i - 1][1])];
      o.push(q);
      p.splice(i, 0, q);
      D = 0;
    } else D += d;
  }
  while (o.length < n) o.push(p[p.length - 1]);
  return o.slice(0, n);
}

function segD(q: Pt, a: Pt, b: Pt) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / L2));
  return Math.hypot(q[0] - a[0] - t * dx, q[1] - a[1] - t * dy);
}

export type Recognized =
  | { line?: false; type: BoxKind; x: number; y: number; w: number; h: number }
  | { line: true; x1: number; y1: number; x2: number; y2: number; cx?: number; cy?: number };

/** Turns a freehand stroke into a clean shape, straight line, or curved arrow. */
export function recognize(raw: Pt[]): Recognized | null {
  if (raw.length < 6) return null;
  const L = pathLen(raw);
  if (L < 50) return null;
  const P = resample(raw, 64);
  const xs = P.map((q) => q[0]), ys = P.map((q) => q[1]);
  const l = Math.min(...xs), r = Math.max(...xs), t = Math.min(...ys), b = Math.max(...ys);
  const W = r - l, H = b - t, A = raw[0], B = raw[raw.length - 1], chord = dist(A, B);

  if (chord < 0.22 * L) {
    if (W < 24 || H < 24) return null;
    const m = Math.min(W, H), tol = Math.max(7, 0.09 * m);
    const cx = (l + r) / 2, cy = (t + b) / 2, a = W / 2, bb = H / 2;
    const fr = (f: (q: Pt) => number) => P.filter((q) => f(q) <= tol).length / P.length;
    const sc: Record<string, number> = {
      rect: fr((q) => Math.min(Math.abs(q[0] - l), Math.abs(q[0] - r), Math.abs(q[1] - t), Math.abs(q[1] - b))),
      ellipse: fr((q) => (Math.abs(Math.hypot((q[0] - cx) / a, (q[1] - cy) / bb) - 1) * m) / 2),
      diamond: fr((q) => Math.abs(Math.abs(q[0] - cx) / a + Math.abs(q[1] - cy) / bb - 1) * m * 0.35),
      triangle: fr((q) =>
        Math.min(segD(q, [cx, t], [r, b]), segD(q, [r, b], [l, b]), segD(q, [l, b], [cx, t])),
      ),
    };
    let best: string | null = null;
    for (const k in sc) if (sc[k] >= 0.8 && (!best || sc[k] > sc[best])) best = k;
    return best ? { type: best as BoxKind, x: l, y: t, w: W, h: H } : null;
  }

  if (chord < 40) return null;
  const ux = (B[0] - A[0]) / chord, uy = (B[1] - A[1]) / chord;
  let mx = 0, mn = 0;
  P.forEach((q) => {
    const d = (q[0] - A[0]) * -uy + (q[1] - A[1]) * ux;
    mx = Math.max(mx, d);
    mn = Math.min(mn, d);
  });
  if (Math.min(mx, -mn) > 0.06 * chord) return null;
  const dev = mx > -mn ? mx : mn;
  if (Math.abs(dev) > 0.7 * chord) return null;
  if (Math.abs(dev) < 0.07 * chord) {
    let x2 = B[0], y2 = B[1];
    if (Math.abs(y2 - A[1]) < 0.07 * chord) y2 = A[1];
    else if (Math.abs(x2 - A[0]) < 0.07 * chord) x2 = A[0];
    return { line: true, x1: A[0], y1: A[1], x2, y2 };
  }
  const mid = P[32];
  return {
    line: true, x1: A[0], y1: A[1], x2: B[0], y2: B[1],
    cx: 2 * mid[0] - (A[0] + B[0]) / 2, cy: 2 * mid[1] - (A[1] + B[1]) / 2,
  };
}

/** Smooth SVG path (quadratic midpoints) through freehand points. */
export function pathD(p: Pt[]) {
  const f = (v: number) => v.toFixed(1);
  if (p.length < 2) return 'M' + f(p[0][0]) + ' ' + f(p[0][1]) + 'L' + f(p[0][0] + 0.1) + ' ' + f(p[0][1]);
  let d = 'M' + f(p[0][0]) + ' ' + f(p[0][1]);
  for (let i = 1; i < p.length - 1; i++)
    d += 'Q' + f(p[i][0]) + ' ' + f(p[i][1]) + ' ' + f((p[i][0] + p[i + 1][0]) / 2) + ' ' + f((p[i][1] + p[i + 1][1]) / 2);
  const l = p[p.length - 1];
  return d + 'L' + f(l[0]) + ' ' + f(l[1]);
}

/* ---------- arrows / lines ---------- */

export function snapAng(fx: number, fy: number, x: number, y: number): Pt {
  const L = Math.hypot(x - fx, y - fy);
  const an = Math.round(Math.atan2(y - fy, x - fx) / (Math.PI / 12)) * (Math.PI / 12);
  return [fx + L * Math.cos(an), fy + L * Math.sin(an)];
}

export const lineCtrl = (l: LineShape): Pt =>
  l.cx != null && l.cy != null ? [l.cx, l.cy] : [(l.x1 + l.x2) / 2, (l.y1 + l.y2) / 2];

export interface LineGeom {
  left: number;
  top: number;
  width: number;
  height: number;
  hitD: string;
  lnD: string;
  tips: string[];
  dash?: string;
  handles: { p1: Pt; p2: Pt; pc: Pt };
}

/** All coordinates for drawing a line/arrow, relative to its own bounding box. */
export function lineGeom(d: LineShape): LineGeom {
  const cc = lineCtrl(d), P = 18;
  const xs = [d.x1, d.x2, cc[0]], ys = [d.y1, d.y2, cc[1]];
  const mnx = Math.min(...xs), mny = Math.min(...ys), left = mnx - P, top = mny - P;
  const a: Pt = [d.x1 - left, d.y1 - top], b: Pt = [d.x2 - left, d.y2 - top], c: Pt = [cc[0] - left, cc[1] - top];
  const w = d.w || 3, hd = d.head, f = (v: number) => v.toFixed(1);
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), hl = Math.min(Math.max(10, w * 4.5), L / 2 || 10);
  const tg = (p: Pt, q: Pt, al: Pt): Pt => {
    let m = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (m < 1) {
      q = al;
      m = Math.hypot(p[0] - q[0], p[1] - q[1]);
    }
    m = m || 1;
    return [(p[0] - q[0]) / m, (p[1] - q[1]) / m];
  };
  const tb = tg(b, c, a), ta = tg(a, c, b);
  const s0 = hd === 'start' || hd === 'both' ? hl * 0.75 : 0, s1 = hd === 'end' || hd === 'both' ? hl * 0.75 : 0;
  const A: Pt = [a[0] - ta[0] * s0, a[1] - ta[1] * s0], B: Pt = [b[0] - tb[0] * s1, b[1] - tb[1] * s1];
  const tip = (p: Pt, r: number) => {
    const k = 0.42;
    const q = [[p[0], p[1]], [p[0] - hl * Math.cos(r - k), p[1] - hl * Math.sin(r - k)], [p[0] - hl * Math.cos(r + k), p[1] - hl * Math.sin(r + k)]];
    return q.map((z) => f(z[0]) + ',' + f(z[1])).join(' ');
  };
  const pd = (p: Pt, q: Pt) => 'M' + f(p[0]) + ' ' + f(p[1]) + 'Q' + f(c[0]) + ' ' + f(c[1]) + ' ' + f(q[0]) + ' ' + f(q[1]);
  const tips: string[] = [];
  if (hd === 'end' || hd === 'both') tips.push(tip(b, Math.atan2(tb[1], tb[0])));
  if (hd === 'start' || hd === 'both') tips.push(tip(a, Math.atan2(ta[1], ta[0])));
  return {
    left, top,
    width: Math.max(...xs) - mnx + 2 * P,
    height: Math.max(...ys) - mny + 2 * P,
    hitD: pd(a, b), lnD: pd(A, B), tips,
    dash: d.dash ? w * 3 + ' ' + w * 2 : undefined,
    handles: { p1: a, p2: b, pc: [0.25 * a[0] + 0.5 * c[0] + 0.25 * b[0], 0.25 * a[1] + 0.5 * c[1] + 0.25 * b[1]] },
  };
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Pure version of dragging an arrow handle (or the whole arrow) by dx/dy from its starting state. */
export function moveLine(o: LineShape, r: string | null, dx: number, dy: number, shift: boolean): LineShape {
  const cc = lineCtrl(o);
  let p = o.x1, q = o.y1, u = o.x2, v = o.y2, cx = cc[0], cy = cc[1], hc = o.cx != null;
  if (r === 'p1') {
    p += dx; q += dy;
    if (shift) [p, q] = snapAng(u, v, p, q);
  } else if (r === 'p2') {
    u += dx; v += dy;
    if (shift) [u, v] = snapAng(p, q, u, v);
  } else if (r === 'pc') {
    const mx = (p + u) / 2, my = (q + v) / 2;
    let Q: Pt = [0.25 * p + 0.5 * cx + 0.25 * u + dx, 0.25 * q + 0.5 * cy + 0.25 * v + dy];
    if (shift) {
      const L = Math.hypot(u - p, v - q) || 1, nx = -(v - q) / L, ny = (u - p) / L;
      const k = (Q[0] - mx) * nx + (Q[1] - my) * ny;
      Q = [mx + nx * k, my + ny * k];
    }
    if (Math.hypot(Q[0] - mx, Q[1] - my) < 6) {
      const { cx: _a, cy: _b, ...rest } = o;
      return rest;
    }
    cx = 2 * Q[0] - (p + u) / 2;
    cy = 2 * Q[1] - (q + v) / 2;
    hc = true;
  } else {
    p += dx; u += dx; q += dy; v += dy; cx += dx; cy += dy;
  }
  const out: LineShape = { ...o, x1: r1(p), y1: r1(q), x2: r1(u), y2: r1(v) };
  if (hc) { out.cx = r1(cx); out.cy = r1(cy); }
  return out;
}
