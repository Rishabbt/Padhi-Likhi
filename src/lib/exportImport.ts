import type { Docs, Folders, Shape, Stroke } from '../types';
import { esc, fid, uid } from './colors';
import { layerToHTML } from './layerHtml';
import { clean, normScene, parseLayer } from './legacy';

export function txt2html(t: string) {
  let o = '';
  let buf: string[] = [];
  const fl = () => {
    if (buf.length) o += '<p>' + buf.map(esc).join('<br>') + '</p>';
    buf = [];
  };
  t.replace(/\r/g, '').split('\n').forEach((l) => {
    const m = l.match(/^(#{1,3})\s+(.*)/);
    if (m) {
      fl();
      o += `<h${m[1].length}>${esc(m[2])}</h${m[1].length}>`;
    } else if (!l.trim()) fl();
    else buf.push(l);
  });
  fl();
  return o || '<p><br></p>';
}

export function exportHTML(name: string, e: string, shapes: Shape[], strokes: Stroke[]) {
  const l = layerToHTML(shapes, strokes);
  const data = JSON.stringify({ draftboard: 3, name, e, shapes, strokes }).replace(/</g, '\\u003c');
  return (
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(name) +
    '</title><style>body{margin:0;background:#e9ece8;font:16px/1.6 Georgia,serif}#page{position:relative;width:816px;max-width:100%;min-height:1056px;margin:20px auto;background:#fff;color:#1b1b1b;box-shadow:0 1px 3px rgba(0,0,0,.25)}#editor{padding:96px;position:relative;min-height:1056px;box-sizing:border-box}#layer{position:absolute;inset:0;pointer-events:none}.shape{position:absolute}.shape svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}.shape svg *{fill:var(--f);stroke:none}.shape.line svg line,.shape.line svg path{stroke:var(--f);fill:none;stroke-linecap:round}.shape.line svg .hit{stroke:transparent}.lbl{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:6px;font:14px Segoe UI,sans-serif;white-space:pre-wrap;color:var(--t,#1b1b1b)}table{border-collapse:collapse;width:100%;margin:12px 0;table-layout:fixed}td,th{border:1px solid #999;padding:6px 8px}th{background:#eee;text-align:left}</style></head><body><div id="page"><div id="editor">' +
    e + '</div><div id="layer">' + l + '</div></div><script type="application/json" id="draftboard-data">' + data + '<\/script></body></html>'
  );
}

export function exportTxt(editorText: string, shapes: Shape[]) {
  const lb = shapes.flatMap((s) => (s.type === 'box' && s.label.trim() ? [s.label.trim()] : []));
  return editorText.trim() + (lb.length ? '\n\nShape labels:\n- ' + lb.join('\n- ') : '') + '\n';
}

export interface ImportResult {
  docs: Docs;
  folders: Folders;
  last: string | null;
}

/** Reads .txt, .md, .html and .json (backup) files into new documents and folders. */
export async function readImports(files: File[]): Promise<ImportResult> {
  const docs: Docs = {};
  const folders: Folders = {};
  let last: string | null = null;
  for (const f of files) {
    try {
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      let nm = f.name.replace(/\.[^.]+$/, '') || 'Imported';
      let e = '<p><br></p>';
      let scene = { shapes: [] as Shape[], strokes: [] as Stroke[] };

      if (ext === 'pdf') {
        try {
          const { pdfToHtml } = await import('./pdfImport'); // loaded only when a PDF is imported
          e = await pdfToHtml(await f.arrayBuffer());
        } catch {
          e = '<p>This PDF could not be read. It may be encrypted or damaged.</p>';
        }
        const id = uid();
        docs[id] = { name: nm, e, ...scene, t: Date.now(), f: '' };
        last = id;
        continue;
      }
      const t = await f.text();

      if (ext === 'json') {
        let j: any = null;
        try {
          j = JSON.parse(t);
        } catch {
          /* fall through to text */
        }
        if (j && j.docs && typeof j.docs === 'object') {
          const fm: Record<string, string> = {};
          Object.keys(j.folders || {}).forEach((k) => (fm[k] = fid()));
          Object.keys(fm).forEach((k) => {
            const fo = j.folders[k];
            folders[fm[k]] = { n: String(typeof fo === 'string' ? fo : (fo && fo.n) || 'Folder').slice(0, 80), p: (fo && fm[fo.p]) || '' };
          });
          Object.keys(j.docs).forEach((k) => {
            const d = j.docs[k];
            const sc = Array.isArray(d.shapes) ? normScene(d.shapes, d.strokes) : parseLayer(clean(d.l || ''));
            const id = uid();
            docs[id] = { name: String(d.name || 'Imported').slice(0, 80), e: clean(d.e || '') || '<p><br></p>', ...sc, t: Date.now(), f: fm[d.f] || '' };
            last = id;
          });
          continue;
        }
        e = txt2html(t);
      } else if (ext === 'html' || ext === 'htm') {
        const dd = new DOMParser().parseFromString(t, 'text/html');
        const m = dd.getElementById('draftboard-data');
        let ok = false;
        if (m) {
          try {
            const x = JSON.parse(m.textContent || '');
            if (x && x.draftboard) {
              e = clean(x.e || '') || e;
              scene = Array.isArray(x.shapes) ? normScene(x.shapes, x.strokes) : parseLayer(clean(x.l || ''));
              if (x.name) nm = String(x.name).slice(0, 80);
              ok = true;
            }
          } catch {
            /* not a Draftboard file */
          }
        }
        if (!ok) e = clean(dd.body ? dd.body.innerHTML : '') || e;
      } else e = txt2html(t);

      const id = uid();
      docs[id] = { name: nm, e, ...scene, t: Date.now(), f: '' };
      last = id;
    } catch {
      /* skip unreadable file */
    }
  }
  return { docs, folders, last };
}
