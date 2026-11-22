import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { esc } from './colors';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

interface Line { text: string; y: number; size: number; page: number }

/**
 * Extracts the text of a PDF as editor HTML: headings (by font size), paragraphs and bullet lists.
 * Shapes, images and exact formatting are not recovered.
 */
export async function pdfToHtml(data: ArrayBuffer): Promise<string> {
  const pdf = await pdfjs.getDocument({ data }).promise;
  const lines: Line[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const content = await (await pdf.getPage(p)).getTextContent();
    const rows: { y: number; size: number; items: { x: number; w: number; s: string }[] }[] = [];
    for (const it of content.items as any[]) {
      if (typeof it.str !== 'string' || !it.str.trim()) continue;
      const y = it.transform[5], size = Math.hypot(it.transform[0], it.transform[1]) || it.height || 10;
      let row = rows.find((r) => Math.abs(r.y - y) < Math.max(2, size * 0.3));
      if (!row) rows.push((row = { y, size, items: [] }));
      row.size = Math.max(row.size, size);
      row.items.push({ x: it.transform[4], w: it.width || 0, s: it.str });
    }
    rows.sort((a, b) => b.y - a.y); // top of the page first
    for (const r of rows) {
      r.items.sort((a, b) => a.x - b.x);
      let text = '', end = -1e9;
      for (const it of r.items) {
        if (text && it.x - end > r.size * 0.15 && !text.endsWith(' ') && !it.s.startsWith(' ')) text += ' ';
        text += it.s;
        end = it.x + it.w;
      }
      text = text.replace(/\s+/g, ' ').trim();
      if (text) lines.push({ text, y: r.y, size: r.size, page: p });
    }
  }
  if (!lines.length) return '<p>No selectable text was found in this PDF. It may be a scanned image.</p>';

  // the most common font size is body text
  const freq = new Map<number, number>();
  lines.forEach((l) => { const k = Math.round(l.size); freq.set(k, (freq.get(k) || 0) + l.text.length); });
  const body = [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const BUL = /^[•●▪◦·-]\s*/;

  let html = '', para: string[] = [], list: string[] = [], prev: Line | null = null;
  const flushPara = () => { if (para.length) html += '<p>' + esc(para.join(' ')) + '</p>'; para = []; };
  const flushList = () => { if (list.length) html += '<ul>' + list.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>'; list = []; };

  for (const l of lines) {
    const gap = prev && prev.page === l.page ? prev.y - l.y : 0;
    const newBlock = !prev || prev.page !== l.page || gap > l.size * 1.7;
    const ratio = l.size / body;
    if (ratio >= 1.15 && l.text.length < 140) {
      flushPara(); flushList();
      const h = ratio >= 1.6 ? 1 : ratio >= 1.3 ? 2 : 3;
      html += `<h${h}>${esc(l.text)}</h${h}>`;
    } else if (BUL.test(l.text) && l.text.replace(BUL, '')) {
      flushPara();
      list.push(l.text.replace(BUL, ''));
    } else {
      // a wrapped bullet continues the last item; a page-top line continues text that stopped mid-sentence
      if (list.length && !newBlock && l.text[0] === l.text[0].toLowerCase()) { list[list.length - 1] += ' ' + l.text; prev = l; continue; }
      flushList();
      const cont = prev && prev.page !== l.page && para.length && !/[.!?:]$/.test(para[para.length - 1]) && /^[a-z]/.test(l.text);
      if (newBlock && !cont) flushPara();
      para.push(l.text);
    }
    prev = l;
  }
  flushPara(); flushList();
  return html;
}
