import type { BoxKind, BoxShape } from '../types';

export const BOX_DEF: Record<BoxKind, { tag: 'rect' | 'ellipse' | 'polygon'; attrs: Record<string, string | number> }> = {
  rect: { tag: 'rect', attrs: { x: 0, y: 0, width: 100, height: 100 } },
  round: { tag: 'rect', attrs: { x: 0, y: 0, width: 100, height: 100, rx: 14 } },
  ellipse: { tag: 'ellipse', attrs: { cx: 50, cy: 50, rx: 50, ry: 50 } },
  diamond: { tag: 'polygon', attrs: { points: '50,0 100,50 50,100 0,50' } },
  triangle: { tag: 'polygon', attrs: { points: '50,0 100,100 0,100' } },
  text: { tag: 'rect', attrs: { x: 0, y: 0, width: 100, height: 100 } },
};

export const DEFAULT_SIZE: Record<BoxKind, [number, number]> = {
  rect: [150, 100], round: [150, 100], ellipse: [150, 100], diamond: [150, 100], triangle: [150, 100], text: [180, 50],
};

export const gradId = (s: BoxShape) => 'g-' + s.id;
/** Value for the --f CSS variable that the shape's SVG fills from. */
export const fillVar = (s: BoxShape) => (s.grad ? 'url(#' + gradId(s) + ')' : s.fill);
