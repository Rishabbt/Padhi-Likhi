import type { Shape, Stroke } from '../types';
import { BOX_DEF } from './boxes';
import { cssToRgb } from './colors';
import { GAP, PITCH } from './pageGeometry';
import { scaleOf } from './scale';

/* A dependency-free PDF 1.4 writer: real text (standard fonts), highlights, lists, tables,
   shapes with gradients, arrows and ink, paginated at Letter size. */

const WIN: Record<number, number> = { 8217: 146, 8216: 145, 8220: 147, 8221: 148, 8211: 150, 8212: 151, 8226: 149, 8230: 133, 8364: 128, 8482: 153 };
const NL = String.fromCharCode(10), BS = String.fromCharCode(92);
const penc = (s: string) => {
  let o = '';
  for (const ch of s) {
    let c = ch.codePointAt(0)!;
    if (WIN[c]) c = WIN[c];
    else if (c > 255 || (c >= 128 && c < 160)) c = 63;
    o += c === 40 || c === 41 || c === 92 ? BS + String.fromCharCode(c) : String.fromCharCode(c);
  }
  return o;
};
const FN = ['Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique', 'Times-Roman', 'Times-Bold', 'Times-Italic', 'Times-BoldItalic', 'Courier', 'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique'];

type RGB = number[];
type Op = (string | number)[];
interface Box { x: number; y: number; w: number; h: number }
interface Pattern { c: Box; g: [RGB, RGB] }

export interface PdfInput {
  page: HTMLElement;
  editor: HTMLElement;
  layer: HTMLElement;
  shapes: Shape[];
  strokes: Stroke[];
  name: string;
}

export function exportPDF(inp: PdfInput): Uint8Array {
  // Render with the light palette so text and fills match the printed page.
  const rt = document.documentElement, prev = rt.dataset.theme;
  rt.dataset.theme = 'light';
  try {
    return buildPDF(inp);
  } finally {
    if (prev === undefined) delete rt.dataset.theme;
    else rt.dataset.theme = prev;
  }
}

function buildPDF({ page: pe, editor: ed, layer, shapes, strokes, name }: PdfInput): Uint8Array {
  // Sheets are PITCH px apart on screen (page + gap), so positions map straight onto PDF pages.
  const K = 0.75, PW = 612, PH = 792, PXH = PITCH, pr = pe.getBoundingClientRect();
  const total = Math.max(1, Math.round((pe.offsetHeight + GAP) / PITCH));
  const pg: string[][] = Array.from({ length: total }, () => []);
  const pats: Pattern[][] = Array.from({ length: total }, () => []);
  const pgOf = (y: number) => Math.min(total - 1, Math.max(0, Math.floor(y / PXH)));
  const cv = (x: number, y: number, i: number) => (x * K).toFixed(2) + ' ' + (PH - (y - i * PXH) * K).toFixed(2);
  const num = (s: string): RGB => (s.match(/[\d.]+/g) || [0, 0, 0]).map(Number);
  const f3 = (c: RGB) => c.slice(0, 3).map((v) => (v / 255).toFixed(3)).join(' ');
  const sc = scaleOf(pe); // the page may be shown scaled on small screens; measure in real page pixels
  const rel = (r: DOMRect): Box => ({ x: (r.left - pr.left) / sc, y: (r.top - pr.top) / sc, w: r.width / sc, h: r.height / sc });
  const rectOps = (x: number, y: number, w: number, h: number): Op[] => [['m', x, y], ['l', x + w, y], ['l', x + w, y + h], ['l', x, y + h], ['h']];
  const pth = (ops: Op[], i: number) =>
    ops.map((o) => (o[0] === 'h' ? 'h' : o[0] === 'c'
      ? cv(o[1] as number, o[2] as number, i) + ' ' + cv(o[3] as number, o[4] as number, i) + ' ' + cv(o[5] as number, o[6] as number, i) + ' c'
      : cv(o[1] as number, o[2] as number, i) + ' ' + o[0])).join(' ');
  const ell = (x: number, y: number, w: number, h: number): Op[] => {
    const a = w / 2, b = h / 2, cx0 = x + a, cy = y + b, k = 0.5523;
    return [['m', cx0 + a, cy], ['c', cx0 + a, cy + b * k, cx0 + a * k, cy + b, cx0, cy + b], ['c', cx0 - a * k, cy + b, cx0 - a, cy + b * k, cx0 - a, cy], ['c', cx0 - a, cy - b * k, cx0 - a * k, cy - b, cx0, cy - b], ['c', cx0 + a * k, cy - b, cx0 + a, cy - b * k, cx0 + a, cy], ['h']];
  };
  const rr = (x: number, y: number, w: number, h: number, rx: number, ry: number): Op[] => {
    const k = 0.5523, X1 = x + w, Y1 = y + h;
    return [['m', x + rx, y], ['l', X1 - rx, y], ['c', X1 - rx + rx * k, y, X1, y + ry - ry * k, X1, y + ry], ['l', X1, Y1 - ry], ['c', X1, Y1 - ry + ry * k, X1 - rx + rx * k, Y1, X1 - rx, Y1], ['l', x + rx, Y1], ['c', x + rx - rx * k, Y1, x, Y1 - ry + ry * k, x, Y1 - ry], ['l', x, y + ry], ['c', x, y + ry - ry * k, x + rx - rx * k, y, x + rx, y], ['h']];
  };
  const fillPath = (ops: Op[], i: number, fill: RGB | { g: [RGB, RGB] }, box: Box) => {
    if (Array.isArray(fill)) pg[i].push('q ' + f3(fill) + ' rg ' + pth(ops, i) + ' f Q');
    else {
      const n = pats[i].length + 1;
      pats[i].push({ c: box, g: fill.g });
      pg[i].push('q /Pattern cs /P' + n + ' scn ' + pth(ops, i) + ' f Q');
    }
  };

  const cx = document.createElement('canvas').getContext('2d')!;
  const fam = (f: string) => {
    f = f.toLowerCase();
    return /courier|mono/.test(f) ? 2 : /georgia|times|palatino/.test(f) ? 1 : /arial|helvetica|segoe|trebuchet|sans|system/.test(f) ? 0 : /serif/.test(f) ? 1 : 0;
  };
  const CF = ['Arial,Liberation Sans,Helvetica,sans-serif', 'Times New Roman,Liberation Serif,Times,serif', 'Courier New,Liberation Mono,Courier,monospace'];

  function words(root: Element) {
    const wk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), rg = document.createRange();
    let nd: Node | null;
    while ((nd = wk.nextNode())) {
      const el = nd.parentElement;
      if (!el || el.closest('.xd,.rh,script,style')) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      let col = num(cs.color);
      const ca = cs.color.match(/[\d.]+/g);
      if (ca && ca.length > 3 && +ca[3] === 0) {
        // gradient text: use its first color stop
        const bi = cs.backgroundImage.match(/rgba?\([^)]*\)/);
        col = bi ? num(bi[0]) : [0, 0, 0];
      }
      const fs = parseFloat(cs.fontSize), bold = cs.fontWeight === 'bold' || +cs.fontWeight >= 600, ital = /italic|oblique/.test(cs.fontStyle);
      const fm = fam(cs.fontFamily), fi = fm * 4 + (bold ? 1 : 0) + (ital ? 2 : 0);
      let ul = false, hl: RGB | null = null;
      for (let e: Element | null = el; e && e !== root.parentElement; e = e.parentElement) {
        const c2 = getComputedStyle(e);
        if (c2.textDecorationLine.includes('underline')) ul = true;
        if (!hl && c2.display === 'inline') {
          const al = c2.backgroundColor.match(/[\d.]+/g);
          if (al && (al.length < 4 || +al[3] > 0)) hl = num(c2.backgroundColor);
        }
      }
      cx.font = (ital ? 'italic ' : '') + (bold ? 'bold ' : '') + fs + 'px ' + CF[fm];
      const val = nd.nodeValue || '', re = /\S+/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(val))) {
        rg.setStart(nd, m.index);
        rg.setEnd(nd, m.index + m[0].length);
        const rc = rg.getClientRects()[0];
        if (!rc || !rc.width) continue;
        const r = rel(rc), i = pgOf(r.y), w = m[0];
        const pw = cx.measureText(w).width, tz = pw > 0 ? Math.max(60, Math.min(140, (r.w / pw) * 100)) : 100, base = r.y + r.h * 0.8;
        if (hl) pg[i].push('q ' + f3(hl) + ' rg ' + pth(rectOps(r.x, r.y, r.w, r.h), i) + ' f Q');
        pg[i].push('BT /F' + (fi + 1) + ' ' + (fs * K).toFixed(2) + ' Tf ' + tz.toFixed(1) + ' Tz ' + f3(col) + ' rg 1 0 0 1 ' + cv(r.x, base, i) + ' Tm (' + penc(w) + ') Tj ET');
        if (ul) pg[i].push('q ' + f3(col) + ' RG .6 w ' + cv(r.x, base + fs * 0.1, i) + ' m ' + cv(r.x + r.w, base + fs * 0.1, i) + ' l S Q');
      }
    }
  }

  // table cells
  ed.querySelectorAll('td,th').forEach((c) => {
    const r = rel(c.getBoundingClientRect()), i = pgOf(r.y);
    const bg = getComputedStyle(c).backgroundColor.match(/[\d.]+/g), ops = pth(rectOps(r.x, r.y, r.w, r.h), i);
    if (bg && bg.length > 3 && +bg[3] > 0) {
      const a = +bg[3], cc = [0, 1, 2].map((k) => 255 * (1 - a) + +bg[k] * a);
      pg[i].push('q ' + f3(cc) + ' rg ' + ops + ' f Q');
    }
    pg[i].push('q .6 .6 .6 RG .75 w ' + ops + ' S Q');
  });

  words(ed);

  // list markers
  ed.querySelectorAll('li').forEach((li) => {
    const wk = document.createTreeWalker(li, NodeFilter.SHOW_TEXT);
    let nd: Node | null;
    while ((nd = wk.nextNode()) && !(nd.nodeValue || '').trim());
    if (!nd) return;
    const v = nd.nodeValue || '', rg = document.createRange(), k0 = v.search(/\S/);
    rg.setStart(nd, k0);
    rg.setEnd(nd, k0 + 1);
    const rc = rg.getClientRects()[0];
    if (!rc) return;
    const r = rel(rc), cs = getComputedStyle(li), fs = parseFloat(cs.fontSize), fm = fam(cs.fontFamily), i = pgOf(r.y);
    const par = li.parentElement!;
    const tx = par.tagName === 'OL' ? [...par.children].indexOf(li) + 1 + '.' : String.fromCharCode(8226);
    cx.font = fs + 'px ' + CF[fm];
    const w = cx.measureText(tx).width;
    pg[i].push('BT /F' + (fm * 4 + 1) + ' ' + (fs * K).toFixed(2) + ' Tf 100 Tz ' + f3(num(cs.color)) + ' rg 1 0 0 1 ' + cv(r.x - 8 - w, r.y + r.h * 0.8, i) + ' Tm (' + penc(tx) + ') Tj ET');
  });

  // boxes
  for (const s of shapes) {
    if (s.type !== 'box') continue;
    const r: Box = { x: s.x, y: s.y, w: s.w, h: s.h }, i = pgOf(r.y), def = BOX_DEF[s.kind];
    let fill: RGB | { g: [RGB, RGB] } | null = null;
    if (s.grad) fill = { g: [cssToRgb(s.grad[0]), cssToRgb(s.grad[1])] };
    else if (s.fill !== 'transparent') fill = cssToRgb(s.fill);
    if (fill) {
      let ops: Op[];
      if (def.tag === 'ellipse') ops = ell(r.x, r.y, r.w, r.h);
      else if (def.tag === 'polygon')
        ops = String(def.attrs.points).trim().split(/\s+/).map((p, k): Op => {
          const q = p.split(',').map(Number);
          return [k ? 'l' : 'm', r.x + (q[0] * r.w) / 100, r.y + (q[1] * r.h) / 100];
        }).concat([['h']]);
      else {
        const rx = +(def.attrs.rx || 0);
        ops = rx ? rr(r.x, r.y, r.w, r.h, (r.w * rx) / 100, (r.h * rx) / 100) : rectOps(r.x, r.y, r.w, r.h);
      }
      fillPath(ops, i, fill, r);
    }
    const lbl = s.label ? layer.querySelector('[data-id="' + s.id + '"] .lbl') : null;
    if (lbl) words(lbl);
  }

  // lines & arrows
  for (const s of shapes) {
    if (s.type !== 'line') continue;
    const { x1, y1, x2, y2 } = s, w = s.w || 3, hd = s.head;
    const col = cssToRgb(s.color), hasC = s.cx != null;
    const cx0 = hasC ? s.cx! : (x1 + x2) / 2, cy0 = hasC ? s.cy! : (y1 + y2) / 2;
    const L = Math.hypot(x2 - x1, y2 - y1), hl = Math.min(Math.max(10, w * 4.5), L / 2 || 10);
    type V = [number, number];
    const tg = (p: V, q: V, al: V): V => {
      let m = Math.hypot(p[0] - q[0], p[1] - q[1]);
      if (m < 1) { q = al; m = Math.hypot(p[0] - q[0], p[1] - q[1]); }
      m = m || 1;
      return [(p[0] - q[0]) / m, (p[1] - q[1]) / m];
    };
    const a: V = [x1, y1], b: V = [x2, y2], c: V = [cx0, cy0], tb = tg(b, c, a), ta = tg(a, c, b);
    const s0 = hd === 'start' || hd === 'both' ? hl * 0.75 : 0, s1 = hd === 'end' || hd === 'both' ? hl * 0.75 : 0;
    const A: V = [x1 - ta[0] * s0, y1 - ta[1] * s0], B: V = [x2 - tb[0] * s1, y2 - tb[1] * s1], ys = [y1, y2, cy0];
    for (let i = pgOf(Math.min(...ys)); i <= pgOf(Math.max(...ys)); i++) {
      const k1: V = [A[0] + (2 / 3) * (c[0] - A[0]), A[1] + (2 / 3) * (c[1] - A[1])], k2: V = [B[0] + (2 / 3) * (c[0] - B[0]), B[1] + (2 / 3) * (c[1] - B[1])];
      let out = 'q ' + f3(col) + ' RG ' + f3(col) + ' rg 1 J ' + (w * K).toFixed(2) + ' w ' + (s.dash ? '[' + (w * 3 * K).toFixed(1) + ' ' + (w * 2 * K).toFixed(1) + '] 0 d ' : '') +
        cv(A[0], A[1], i) + ' m ' + cv(k1[0], k1[1], i) + ' ' + cv(k2[0], k2[1], i) + ' ' + cv(B[0], B[1], i) + ' c S [] 0 d ';
      const tip = (p: V, r: number) =>
        cv(p[0], p[1], i) + ' m ' + cv(p[0] - hl * Math.cos(r - 0.42), p[1] - hl * Math.sin(r - 0.42), i) + ' l ' + cv(p[0] - hl * Math.cos(r + 0.42), p[1] - hl * Math.sin(r + 0.42), i) + ' l h f ';
      if (hd === 'end' || hd === 'both') out += tip(b, Math.atan2(tb[1], tb[0]));
      if (hd === 'start' || hd === 'both') out += tip(a, Math.atan2(ta[1], ta[0]));
      pg[i].push(out + 'Q');
    }
  }

  // freehand ink
  for (const sk of strokes) {
    const t = sk.d.match(/[MLQ]|-?[\d.]+/g) || [], ops: Op[] = [];
    let k = 0, c: string | null = null, qx = 0, qy = 0, y0 = 1e9, y1 = -1e9;
    const yy = (v: number) => { y0 = Math.min(y0, v); y1 = Math.max(y1, v); };
    while (k < t.length) {
      if (/[MLQ]/.test(t[k])) { c = t[k++]; continue; }
      if (c === 'Q') {
        const a = +t[k], b = +t[k + 1], x = +t[k + 2], y = +t[k + 3];
        k += 4;
        ops.push(['c', qx + (2 / 3) * (a - qx), qy + (2 / 3) * (b - qy), x + (2 / 3) * (a - x), y + (2 / 3) * (b - y), x, y]);
        qx = x; qy = y; yy(b); yy(y);
      } else {
        const x = +t[k], y = +t[k + 1];
        k += 2;
        ops.push([c === 'M' ? 'm' : 'l', x, y]);
        qx = x; qy = y; yy(y);
      }
    }
    if (!ops.length) continue;
    const w = (sk.width || 2) * K;
    for (let i = pgOf(y0); i <= pgOf(y1); i++) pg[i].push('q 1 J 1 j ' + w.toFixed(2) + ' w ' + f3(cssToRgb(sk.color)) + ' RG ' + pth(ops, i) + ' S Q');
  }

  // assemble the file
  let id = 14, out = '%PDF-1.4' + NL + '%' + String.fromCharCode(226, 227, 207, 211) + NL;
  const off: number[] = [];
  const put = (n: number, b: string) => { off[n] = out.length; out += n + ' 0 obj' + NL + b + NL + 'endobj' + NL; };
  put(1, '<< /Type /Catalog /Pages 2 0 R >>');
  FN.forEach((n, k) => put(3 + k, '<< /Type /Font /Subtype /Type1 /BaseFont /' + n + ' /Encoding /WinAnsiEncoding >>'));
  const kids: string[] = [], fr = '/Font << ' + FN.map((_, k) => '/F' + (k + 1) + ' ' + (3 + k) + ' 0 R').join(' ') + ' >>';
  pg.forEach((ops, i) => {
    const s = ops.join(NL), cid = ++id, pid = ++id;
    put(cid, '<< /Length ' + s.length + ' >>' + NL + 'stream' + NL + s + NL + 'endstream');
    const pn = pats[i].map((p, k) => {
      const n = ++id, a = p.g[0], b = p.g[1];
      put(n, '<< /PatternType 2 /Shading << /ShadingType 2 /ColorSpace /DeviceRGB /Coords [' + cv(p.c.x, p.c.y, i) + ' ' + cv(p.c.x + p.c.w, p.c.y + p.c.h, i) + '] /Function << /FunctionType 2 /Domain [0 1] /C0 [' + f3(a) + '] /C1 [' + f3(b) + '] /N 1 >> /Extend [true true] >> >>');
      return '/P' + (k + 1) + ' ' + n + ' 0 R';
    });
    put(pid, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] /Contents ' + cid + ' 0 R /Resources << ' + fr + (pn.length ? ' /Pattern << ' + pn.join(' ') + ' >>' : '') + ' >> >>');
    kids.push(pid + ' 0 R');
  });
  put(2, '<< /Type /Pages /Count ' + total + ' /Kids [' + kids.join(' ') + '] >>');
  const info = ++id;
  put(info, '<< /Title (' + penc(name || 'Untitled') + ') /Producer (Draftboard) >>');
  const xr = out.length, N = id + 1;
  let x = 'xref' + NL + '0 ' + N + NL + '0000000000 65535 f ' + NL;
  for (let n = 1; n < N; n++) x += String(off[n]).padStart(10, '0') + ' 00000 n ' + NL;
  out += x + 'trailer' + NL + '<< /Size ' + N + ' /Root 1 0 R /Info ' + info + ' 0 R >>' + NL + 'startxref' + NL + xr + NL + '%%EOF';
  return Uint8Array.from(out, (c) => c.charCodeAt(0));
}
