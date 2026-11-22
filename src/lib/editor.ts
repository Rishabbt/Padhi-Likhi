import { esc } from './colors';

/* Helpers around the contenteditable editor. The editor's content is owned by the
   browser (execCommand); React only mounts it and reads its HTML when saving. */

let saved: Range | null = null;
export const getSaved = () => saved;
export const clearSaved = () => { saved = null; };

/** Remembers the last selection inside the editor so toolbar clicks can restore it. */
export function trackSelection(ed: HTMLElement) {
  const h = () => {
    const s = getSelection();
    if (s && s.rangeCount && ed.contains(s.anchorNode)) saved = s.getRangeAt(0).cloneRange();
  };
  document.addEventListener('selectionchange', h);
  return () => document.removeEventListener('selectionchange', h);
}

export function restore(ed: HTMLElement) {
  ed.focus();
  if (saved) {
    const s = getSelection()!;
    s.removeAllRanges();
    s.addRange(saved);
  }
}

export function cmd(ed: HTMLElement, c: string, v?: string) {
  restore(ed);
  document.execCommand(c, false, v ?? undefined);
}
/**
 * Highlights the current selection (or clears it with 'transparent') and leaves the caret
 * AFTER it. Chrome always types inside the style the caret sits in, so without this anything
 * typed right after a highlight would be highlighted too. An invisible zero-width space after
 * the highlight gives the caret somewhere outside it; it is stripped when saving or exporting.
 */
export function applyHighlight(color: string) {
  document.execCommand('hiliteColor', false, color);
  const s = getSelection();
  if (!s || !s.rangeCount) return;
  if (color === 'transparent') { s.collapseToEnd(); return; }
  const r = s.getRangeAt(0), n = r.endContainer;
  const el = n.nodeType === 1 ? (n as Element) : n.parentElement;
  const sp = el && el.closest('span[style*="background"]');
  if (sp) {
    const rest = document.createRange(); // is the selection's end the very end of the highlight?
    rest.selectNodeContents(sp);
    rest.setStart(r.endContainer, r.endOffset);
    if (rest.toString() === '') {
      const z = document.createTextNode(ZWSP);
      sp.after(z);
      const c = document.createRange();
      c.setStart(z, 1);
      c.collapse(true);
      s.removeAllRanges();
      s.addRange(c);
      return;
    }
  }
  s.collapseToEnd();
}

/** The zero-width space used by applyHighlight; remove it from text that is saved or exported. */
export const ZWSP = '\u200b';
export const stripZw = (t: string) => t.replace(/\u200b/g, '');

export function setSize(ed: HTMLElement, px: number | string) {
  restore(ed);
  document.execCommand('fontSize', false, '7');
  ed.querySelectorAll('font[size="7"]').forEach((f) => {
    const s = document.createElement('span');
    s.style.fontSize = px + 'px';
    s.innerHTML = f.innerHTML;
    f.replaceWith(s);
  });
}

export function textGrad(ed: HTMLElement, a: string, b: string) {
  const t = saved ? saved.toString() : '';
  if (!t) return false;
  restore(ed);
  document.execCommand(
    'insertHTML', false,
    `<span style="background:linear-gradient(90deg,${a},${b});-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent">${esc(t).replace(/&quot;/g, '"')}</span>`,
  );
  return true;
}

export function insTable(ed: HTMLElement, spec: string) {
  const [c, r] = spec.split('x').map(Number);
  let h = '<table><tbody>';
  for (let i = 0; i < r; i++) {
    const g = i ? 'td' : 'th';
    h += '<tr>' + ('<' + g + '><br></' + g + '>').repeat(c) + '</tr>';
  }
  restore(ed);
  document.execCommand('insertHTML', false, h + '</tbody></table><p><br></p>');
}

export function curCell(ed: HTMLElement): HTMLTableCellElement | null {
  let c: Node | null = saved && ed.contains(saved.startContainer) ? saved.startContainer : null;
  if (!c) return null;
  const el = c.nodeType === 1 ? (c as Element) : c.parentElement;
  return (el && (el.closest('td,th') as HTMLTableCellElement)) || null;
}

export type TableOp = 'tadd' | 'tdelr' | 'tdelc' | 'tdel';

export function tblOp(ed: HTMLElement, a: TableOp, v = '') {
  const c = curCell(ed);
  if (!c) return;
  const tr = c.closest('tr')!, t = c.closest('table')!, i = c.cellIndex;
  if (a === 'tadd' && v === 'row') {
    const r = document.createElement('tr');
    [...tr.cells].forEach(() => {
      const d = document.createElement('td');
      d.innerHTML = '<br>';
      r.appendChild(d);
    });
    tr.after(r);
  } else if (a === 'tadd') {
    [...t.rows].forEach((r) => {
      const x = r.cells[i];
      if (!x) return;
      const d = document.createElement(x.tagName);
      d.innerHTML = '<br>';
      x.after(d);
    });
  } else if (a === 'tdelr') {
    if (t.rows.length > 1) tr.remove();
    else t.remove();
  } else if (a === 'tdelc') {
    [...t.rows].forEach((r) => r.cells[i] && r.cells[i].remove());
    if (!t.rows[0] || !t.rows[0].cells.length) t.remove();
  } else if (a === 'tdel') t.remove();
  if (a !== 'tadd') saved = null;
}
