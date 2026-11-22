import type { Doc, Docs, Folders } from '../types';
import { parseLayer } from './legacy';

export const DEF_HTML =
  '<h1>Untitled document</h1><p>Start typing here. Select text to change its size, color, or style, then add shapes from the toolbar to sketch a diagram on the page.</p>';

export const blankDoc = (name: string, f = '', e = DEF_HTML): Doc => ({ name, e, shapes: [], strokes: [], t: Date.now(), f });

export interface Persisted {
  docs: Docs;
  folders: Folders;
  cur: string;
}

/** Brings a stored doc (current or original-Draftboard format) up to the current shape. */
export function upgradeDoc(d: any): Doc {
  let shapes = d.shapes, strokes = d.strokes;
  if (!Array.isArray(shapes) || !Array.isArray(strokes)) {
    const p = parseLayer(typeof d.l === 'string' ? d.l : '');
    shapes = p.shapes;
    strokes = p.strokes;
  }
  return { name: String(d.name || 'Untitled'), e: typeof d.e === 'string' ? d.e : DEF_HTML, shapes, strokes, t: d.t || Date.now(), f: d.f || '' };
}

export function loadAll(): Persisted {
  let folders: Folders = {};
  let docs: Docs = {};
  let cur: string | null = null;
  try {
    folders = JSON.parse(localStorage.getItem('db-folders') || '{}');
  } catch {
    folders = {};
  }
  Object.keys(folders).forEach((k) => {
    const v = folders[k] as unknown;
    if (typeof v === 'string') folders[k] = { n: v, p: '' };
  });
  try {
    const raw = JSON.parse(localStorage.getItem('db-docs') || '{}');
    Object.keys(raw).forEach((k) => (docs[k] = upgradeDoc(raw[k])));
    cur = localStorage.getItem('db-cur');
  } catch {
    docs = {};
  }
  if (!Object.keys(docs).length) {
    let o: any = null;
    try {
      o = JSON.parse(localStorage.getItem('db-doc') || 'null');
    } catch {
      /* ignore */
    }
    docs.d0 = o ? upgradeDoc({ ...o, name: 'Untitled 1' }) : blankDoc('Untitled 1');
    cur = 'd0';
  }
  if (!cur || !docs[cur]) cur = Object.keys(docs)[0];
  return { docs, folders, cur };
}

export function persistDocs(docs: Docs, cur: string) {
  localStorage.setItem('db-docs', JSON.stringify(docs));
  localStorage.setItem('db-cur', cur);
}
export function persistFolders(folders: Folders) {
  try {
    localStorage.setItem('db-folders', JSON.stringify(folders));
  } catch {
    /* ignore */
  }
}
