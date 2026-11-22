import type { Shape, Stroke } from '../types';
import { BOX_DEF, fillVar, gradId } from './boxes';
import { esc } from './colors';
import { lineGeom } from './geometry';

/**
 * Static markup for the drawing layer. It uses the same structure as the original
 * Draftboard, so exported pages render without React and older copies can import them.
 */
export function layerToHTML(shapes: Shape[], strokes: Stroke[]): string {
  let h = '';
  for (const s of shapes) {
    if (s.type === 'box') {
      const d = BOX_DEF[s.kind];
      const attrs = Object.entries(d.attrs).map(([k, v]) => k + '="' + v + '"').join(' ');
      const defs = s.grad
        ? '<defs><linearGradient id="' + gradId(s) + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + esc(s.grad[0]) + '"/><stop offset="1" stop-color="' + esc(s.grad[1]) + '"/></linearGradient></defs>'
        : '';
      h += '<div class="shape" style="left:' + s.x + 'px;top:' + s.y + 'px;width:' + s.w + 'px;height:' + s.h + 'px;--f:' + esc(fillVar(s)) + (s.labelColor ? ';--t:' + esc(s.labelColor) : '') +
        '"><svg viewBox="0 0 100 100" preserveAspectRatio="none">' + defs + '<' + d.tag + ' ' + attrs + '/></svg><div class="lbl">' + esc(s.label) + '</div></div>';
    } else {
      const g = lineGeom(s);
      h += '<div class="shape line" data-x1="' + s.x1 + '" data-y1="' + s.y1 + '" data-x2="' + s.x2 + '" data-y2="' + s.y2 + '"' +
        (s.cx != null ? ' data-cx="' + s.cx + '" data-cy="' + s.cy + '"' : '') + ' data-w="' + s.w + '" data-head="' + s.head + '"' + (s.dash ? ' data-dash="1"' : '') +
        ' style="--f:' + esc(s.color) + ';left:' + g.left + 'px;top:' + g.top + 'px;width:' + g.width + 'px;height:' + g.height + 'px"><svg>' +
        '<path class="hit" d="' + g.hitD + '"/><path class="ln" d="' + g.lnD + '" stroke-width="' + s.w + '"' + (g.dash ? ' stroke-dasharray="' + g.dash + '"' : '') + '/>' +
        g.tips.map((t) => '<polygon points="' + t + '"/>').join('') + '</svg></div>';
    }
  }
  if (strokes.length)
    h += '<svg class="ink" style="position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible">' +
      strokes.map((k) => '<path fill="none" stroke="' + esc(k.color) + '" stroke-width="' + k.width + '" stroke-linecap="round" stroke-linejoin="round" d="' + esc(k.d) + '"/>').join('') + '</svg>';
  return h;
}
