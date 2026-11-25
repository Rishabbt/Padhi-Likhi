import { useState, type ReactNode } from 'react';
import type { Docs, Folders, Head, LineShape, Shape } from '../types';
import { BG, FG, FT, GR, SOL, SZ } from '../lib/colors';
import type { TableOp } from '../lib/editor';

export interface SlashCmd { k: string; t: string; f: string }
export const CMDS: SlashCmd[] = [
  { k: 'p', t: 'Paragraph', f: 'P' }, { k: 'h1', t: 'Heading 1', f: 'H1' },
  { k: 'h2', t: 'Heading 2', f: 'H2' }, { k: 'h3', t: 'Heading 3', f: 'H3' },
];

const Row = ({ children }: { children: ReactNode }) => <div className="row">{children}</div>;
const Lb = ({ children }: { children: ReactNode }) => <div className="lb">{children}</div>;
const Swatches = ({ list, onPick }: { list: string[]; onPick: (c: string) => void }) => (
  <>{list.map((c) => <button key={c} className="sw" style={{ background: c }} title={c} onClick={() => onPick(c)} />)}</>
);
const GradSwatches = ({ onPick }: { onPick: (a: string, b: string) => void }) => (
  <>{GR.map((g) => (
    <button key={g[0]} className="sw" style={{ background: `linear-gradient(135deg,${g[0]},${g[1]})` }} title={`${g[0]} to ${g[1]}`} onClick={() => onPick(g[0], g[1])} />
  ))}</>
);

export function SlashMenu({ items, idx, onPick }: { items: SlashCmd[]; idx: number; onPick: (i: number) => void }) {
  return <>{items.map((c, i) => (
    <button key={c.k} className={'pi' + (i === idx ? ' on' : '')} onClick={() => onPick(i)}>{c.t}<small>/{c.k}</small></button>
  ))}</>;
}

export function ColorMenu(p: { onFg: (c: string) => void; onBg: (c: string) => void; onGrad: (a: string, b: string) => void }) {
  return (
    <>
      <Lb>Text color</Lb><Row><Swatches list={FG} onPick={p.onFg} /></Row>
      <Lb>Highlight</Lb><Row><Swatches list={BG} onPick={p.onBg} /></Row>
      <Lb>Custom</Lb>
      <Row>Text <input type="color" defaultValue="#c0392b" onChange={(e) => p.onFg(e.target.value)} /> Highlight <input type="color" defaultValue="#fff3a3" onChange={(e) => p.onBg(e.target.value)} /></Row>
      <Lb>Gradient text</Lb><Row><GradSwatches onPick={p.onGrad} /></Row>
    </>
  );
}

export const HL_COLORS: [string, string][] = [
  ['#A78BFA', 'Purple'],
  ['#4ADE80', 'Green'],
  ['#F472B6', 'Pink'],
  ['#60A5FA', 'Blue'],
  ['#FF0000', 'Red'],
  ['#FBBF24', 'Yellow'],
];
export function HlMenu({ color, onPick }: { color: string; onPick: (c: string) => void }) {
  return (
    <>
      <Lb>Highlighter color</Lb>
      <Row>
        {HL_COLORS.map(([c, n]) => (
          <button key={c} className={'sw' + (c.toLowerCase() === color.toLowerCase() ? ' cur' : '')} style={{ background: c }} title={n} aria-label={n} onClick={() => onPick(c)} />
        ))}
      </Row>
      <Lb>Custom color</Lb>
      <Row><input type="color" defaultValue={color} aria-label="Custom highlighter color" onChange={(e) => onPick(e.target.value)} /></Row>
      <Lb>Pick a color, then drag over text to highlight it.</Lb>
    </>
  );
}

export function FmtMenu(p: { onCmd: (c: string) => void; onSize: (n: number) => void; onFont: (f: string) => void }) {
  const b = (t: ReactNode, fn: () => void, k: string) => <button key={k} onClick={fn}>{t}</button>;
  return (
    <>
      <Row>
        {b(<b>B</b>, () => p.onCmd('bold'), 'b')}{b(<i>I</i>, () => p.onCmd('italic'), 'i')}{b(<u>U</u>, () => p.onCmd('underline'), 'u')}
        {b('Left', () => p.onCmd('justifyLeft'), 'l')}{b('Center', () => p.onCmd('justifyCenter'), 'c')}{b('Right', () => p.onCmd('justifyRight'), 'r')}
      </Row>
      <Lb>Size</Lb><Row>{SZ.map((s) => b(s, () => p.onSize(s), 's' + s))}</Row>
      <Lb>Font</Lb><Row>{FT.map((f) => b(f, () => p.onFont(f), f))}</Row>
      <Lb>List</Lb><Row>{b('Bullets', () => p.onCmd('insertUnorderedList'), 'ul')}{b('Numbers', () => p.onCmd('insertOrderedList'), 'ol')}</Row>
    </>
  );
}

export function ShapeMenu(p: {
  shape: Shape;
  fillValue: string;
  onFill: (c: string) => void;
  onGrad: (a: string, b: string) => void;
  onRandom: () => void;
  onLabelColor: (c: string) => void;
  onLine: (patch: Partial<LineShape>) => void;
  onStraighten: () => void;
}) {
  const s = p.shape, ln = s.type === 'line';
  const tg = (on: boolean, t: ReactNode, fn: () => void, k: string) => <button key={k} className={on ? 'on' : ''} onClick={fn}>{t}</button>;
  const heads: [Head, string][] = [['end', '→'], ['start', '←'], ['both', '↔'], ['none', '—']];
  return (
    <>
      <Lb>{ln ? 'Arrow color' : 'Fill'}</Lb>
      <Row><Swatches list={ln ? FG : SOL} onPick={p.onFill} /></Row>
      {!ln && <><Lb>Gradient fill</Lb><Row><GradSwatches onPick={p.onGrad} /></Row></>}
      <Lb>Custom color</Lb>
      <Row><input type="color" defaultValue={p.fillValue} title="Pick any color" onChange={(e) => p.onFill(e.target.value)} /><button onClick={p.onRandom}>Random color</button></Row>
      {s.type === 'line' ? (
        <>
          <Lb>Arrowheads</Lb>
          <Row>{heads.map(([h, t]) => tg(s.head === h, t, () => p.onLine({ head: h }), h))}</Row>
          <Lb>Line</Lb>
          <Row>
            {tg(s.w === 2, 'Thin', () => p.onLine({ w: 2 }), 'w2')}{tg(s.w === 3, 'Medium', () => p.onLine({ w: 3 }), 'w3')}{tg(s.w === 6, 'Thick', () => p.onLine({ w: 6 }), 'w6')}
            {tg(!s.dash, 'Solid', () => p.onLine({ dash: false }), 'solid')}{tg(s.dash, 'Dashed', () => p.onLine({ dash: true }), 'dash')}
            {tg(false, 'Straighten', p.onStraighten, 'str')}
          </Row>
        </>
      ) : (
        <><Lb>Label text</Lb><Row><Swatches list={FG} onPick={p.onLabelColor} /></Row></>
      )}
    </>
  );
}

export function TableMenu(p: { hasCell: boolean; onInsert: (spec: string) => void; onOp: (op: TableOp, v?: string) => void }) {
  return (
    <>
      <Lb>Insert table (columns × rows)</Lb>
      <Row>{['2x2', '3x3', '4x3', '5x4', '6x4'].map((s) => <button key={s} onClick={() => p.onInsert(s)}>{s.replace('x', '×')}</button>)}</Row>
      {p.hasCell && (
        <>
          <Lb>This table</Lb>
          <Row>
            <button onClick={() => p.onOp('tadd', 'row')}>Add row</button><button onClick={() => p.onOp('tadd', 'col')}>Add column</button>
            <button onClick={() => p.onOp('tdelr')}>Delete row</button><button onClick={() => p.onOp('tdelc')}>Delete column</button>
            <button onClick={() => p.onOp('tdel')}>Delete table</button>
          </Row>
        </>
      )}
    </>
  );
}

export function SaveMenu({ onSave }: { onSave: (fmt: 'pdf' | 'html' | 'txt' | 'json') => void }) {
  const b = (v: 'pdf' | 'html' | 'txt' | 'json', t: string, s: string) => <button className="pi" onClick={() => onSave(v)}>{t}<small>{s}</small></button>;
  return (
    <>
      <Lb>Save a copy to this device</Lb>
      {b('pdf', 'PDF (.pdf)', 'text and shapes')}{b('html', 'Web page (.html)', 'keeps shapes')}
      {b('txt', 'Plain text (.txt)', 'text only')}{b('json', 'Backup (.json)', 'all docs and folders')}
      <Lb>Open these again with Import in the sidebar. Ctrl+S saves the web page.</Lb>
    </>
  );
}

export const folderPath = (folders: Folders, k: string) => {
  const s: string[] = [];
  let x = k, g = 0;
  while (x && folders[x] && g++ < 30) { s.unshift(folders[x].n); x = folders[x].p; }
  return s.join(' / ');
};
const byPath = (folders: Folders) => (x: string, y: string) => folderPath(folders, x).localeCompare(folderPath(folders, y));

export function DocMenu(p: { id: string; docs: Docs; folders: Folders; onMove: (f: string) => void; onDelete: () => void }) {
  const [armed, setArmed] = useState(false);
  const cur = p.folders[p.docs[p.id].f] ? p.docs[p.id].f : '';
  return (
    <>
      <Lb>Move to folder</Lb>
      {['', ...Object.keys(p.folders).sort(byPath(p.folders))].map((f) => (
        <button key={f} className={'pi' + (cur === f ? ' on' : '')} onClick={() => p.onMove(f)}>{f ? folderPath(p.folders, f) : 'No folder'}</button>
      ))}
      <Row><button onClick={() => (armed ? p.onDelete() : setArmed(true))}>{armed ? 'Click again to delete' : 'Delete document'}</button></Row>
    </>
  );
}

export function FolderMenu(p: {
  id: string; folders: Folders; onRename: (n: string) => void; onDone: () => void;
  onNewDoc: () => void; onNewSub: () => void; onMove: (parent: string) => void; onDelete: () => void;
}) {
  const [armed, setArmed] = useState(false);
  const f = p.folders[p.id];
  // a folder can't move into itself or its own descendants
  const bad = new Set<string>();
  const ds = (x: string) => { bad.add(x); Object.keys(p.folders).forEach((k) => { if (p.folders[k].p === x && !bad.has(k)) ds(k); }); };
  ds(p.id);
  const pc = p.folders[f.p] ? f.p : '';
  return (
    <>
      <Lb>Rename folder</Lb>
      <Row>
        <input id="rn" type="text" defaultValue={f.n} aria-label="Folder name" autoFocus onFocus={(e) => e.target.select()}
          onChange={(e) => p.onRename(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); p.onDone(); } }} />
        <button onClick={p.onDone}>Save</button>
      </Row>
      <Row><button onClick={p.onNewDoc}>New document here</button><button onClick={p.onNewSub}>New folder</button></Row>
      <Lb>Move folder into</Lb>
      {['', ...Object.keys(p.folders).filter((k) => !bad.has(k)).sort(byPath(p.folders))].map((k) => (
        <button key={k} className={'pi' + (pc === k ? ' on' : '')} onClick={() => p.onMove(k)}>{k ? folderPath(p.folders, k) : 'Top level'}</button>
      ))}
      <Row><button onClick={() => (armed ? p.onDelete() : setArmed(true))}>{armed ? 'Click again to delete' : 'Delete folder'}</button></Row>
      <Lb>Deleting a folder keeps its documents and subfolders.</Lb>
    </>
  );
}
