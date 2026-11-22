import type { BoxKind, BoxShape, Head, LineShape, Shape, Stroke } from '../types';
import { safeColor, sid } from './colors';

/** Strips active content from untrusted HTML. */
export function clean(h: string): string {
  const dd = new DOMParser().parseFromString('<body>' + h, 'text/html');
  dd.querySelectorAll('script,style,iframe,object,embed,link,meta,form,base,foreignObject').forEach((x) => x.remove());
  dd.querySelectorAll('*').forEach((x) => {
    [...x.attributes].forEach((at) => {
      if (/^on/i.test(at.name) || /^\s*javascript:/i.test(at.value)) x.removeAttribute(at.name);
    });
  });
  return dd.body.innerHTML;
}

const num = (v: unknown, fb = 0) => (Number.isFinite(+(v as number)) && v !== '' && v != null ? +(v as number) : fb);

/**
 * Reads the layer markup written by the original single-file Draftboard
 * (absolutely positioned .shape divs plus an svg.ink) into typed shapes and strokes.
 */
export function parseLayer(html: string): { shapes: Shape[]; strokes: Stroke[] } {
  const shapes: Shape[] = [];
  const strokes: Stroke[] = [];
  if (!html) return { shapes, strokes };
  const dd = new DOMParser().parseFromString('<body>' + html, 'text/html');

  dd.querySelectorAll<HTMLElement>('.shape').forEach((el) => {
    const f = el.style.getPropertyValue('--f').trim();
    if (el.classList.contains('line')) {
      const ds = el.dataset;
      const head = (['end', 'start', 'both', 'none'].includes(ds.head || '') ? ds.head : 'end') as Head;
      const l: LineShape = {
        type: 'line', id: sid(),
        x1: num(ds.x1), y1: num(ds.y1), x2: num(ds.x2), y2: num(ds.y2),
        w: num(ds.w, 3) || 3, head, dash: ds.dash === '1', color: safeColor(f, '#1b1b1b'),
      };
      if (ds.cx != null && ds.cx !== '') { l.cx = num(ds.cx); l.cy = num(ds.cy); }
      shapes.push(l);
      return;
    }
    const svg = el.querySelector('svg');
    const inner = svg && svg.querySelector('rect,ellipse,polygon');
    let kind: BoxKind = 'rect';
    if (inner) {
      const t = inner.tagName.toLowerCase();
      if (t === 'ellipse') kind = 'ellipse';
      else if (t === 'polygon') kind = (inner.getAttribute('points') || '').startsWith('50,0 100,50') ? 'diamond' : 'triangle';
      else if (inner.getAttribute('rx')) kind = 'round';
    }
    let fill = safeColor(f, '#dbeafe');
    let grad: [string, string] | undefined;
    if (f.startsWith('url')) {
      const stops = svg ? svg.querySelectorAll('linearGradient stop') : [];
      if (stops.length > 1) {
        grad = [safeColor(stops[0].getAttribute('stop-color'), '#ffffff'), safeColor(stops[1].getAttribute('stop-color'), '#cccccc')];
        fill = grad[0];
      }
    }
    if (kind === 'rect' && fill === 'transparent') kind = 'text';
    const t = el.style.getPropertyValue('--t').trim();
    const b: BoxShape = {
      type: 'box', id: sid(), kind,
      x: parseFloat(el.style.left) || 0, y: parseFloat(el.style.top) || 0,
      w: parseFloat(el.style.width) || 150, h: parseFloat(el.style.height) || 100,
      fill, label: (el.querySelector('.lbl')?.textContent || '').trim(),
    };
    if (grad) b.grad = grad;
    if (t) b.labelColor = safeColor(t, '#1b1b1b');
    shapes.push(b);
  });

  dd.querySelectorAll('svg.ink path').forEach((p) => {
    const d = p.getAttribute('d') || '';
    if (/^[MLQ0-9\s.,-]+$/.test(d))
      strokes.push({ id: sid(), d, color: safeColor(p.getAttribute('stroke'), '#2563eb'), width: num(p.getAttribute('stroke-width'), 4) || 4 });
  });
  return { shapes, strokes };
}

/** Validates shapes/strokes from an imported file. */
export function normScene(shapes: unknown, strokes: unknown): { shapes: Shape[]; strokes: Stroke[] } {
  const S: Shape[] = [];
  const K: Stroke[] = [];
  const kinds = ['rect', 'round', 'ellipse', 'diamond', 'triangle', 'text'];
  if (Array.isArray(shapes))
    shapes.forEach((x: any) => {
      if (!x || typeof x !== 'object') return;
      if (x.type === 'line')
        S.push({
          type: 'line', id: sid(), x1: num(x.x1), y1: num(x.y1), x2: num(x.x2), y2: num(x.y2),
          ...(x.cx != null && x.cy != null ? { cx: num(x.cx), cy: num(x.cy) } : {}),
          w: num(x.w, 3) || 3, head: ['end', 'start', 'both', 'none'].includes(x.head) ? x.head : 'end',
          dash: !!x.dash, color: safeColor(x.color, '#1b1b1b'),
        });
      else if (x.type === 'box' && kinds.includes(x.kind))
        S.push({
          type: 'box', id: sid(), kind: x.kind, x: num(x.x), y: num(x.y), w: Math.max(10, num(x.w, 150)), h: Math.max(10, num(x.h, 100)),
          fill: safeColor(x.fill, '#dbeafe'),
          ...(Array.isArray(x.grad) && x.grad.length === 2 ? { grad: [safeColor(x.grad[0]), safeColor(x.grad[1])] as [string, string] } : {}),
          label: String(x.label || '').slice(0, 2000),
          ...(x.labelColor ? { labelColor: safeColor(x.labelColor, '#1b1b1b') } : {}),
        });
    });
  if (Array.isArray(strokes))
    strokes.forEach((x: any) => {
      if (x && typeof x.d === 'string' && /^[MLQ0-9\s.,-]+$/.test(x.d))
        K.push({ id: sid(), d: x.d, color: safeColor(x.color, '#2563eb'), width: num(x.width, 4) || 4 });
    });
  return { shapes: S, strokes: K };
}
