import { useRef } from 'react';
import type { Docs, Folders } from '../types';

interface Props {
  docs: Docs;
  folders: Folders;
  cur: string;
  query: string;
  openF: Record<string, boolean>;
  onQuery: (q: string) => void;
  onNewDoc: () => void;
  onNewFolder: () => void;
  onImport: (files: File[]) => void;
  onOpen: (id: string) => void;
  onDocMore: (id: string, el: HTMLElement) => void;
  onToggle: (fid: string) => void;
  onFolderMore: (fid: string, el: HTMLElement) => void;
  onFolderDoc: (fid: string) => void;
  onFolderSub: (fid: string) => void;
}

const plain = (h: string) => h.replace(/<[^>]*>/g, ' ');

export default function Sidebar(p: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const q = p.query.trim().toLowerCase();
  const text = (id: string) => {
    const d = p.docs[id];
    return (d.name + ' ' + plain(d.e) + ' ' + d.shapes.map((s) => (s.type === 'box' ? s.label : '')).join(' ')).toLowerCase();
  };
  const ids = Object.keys(p.docs).sort((a, b) => p.docs[a].name.localeCompare(p.docs[b].name)).filter((id) => !q || text(id).includes(q));
  const par = (k: string) => (p.folders[p.folders[k].p] ? p.folders[k].p : '');
  const kids = (f: string) => Object.keys(p.folders).filter((k) => par(k) === f).sort((a, b) => p.folders[a].n.localeCompare(p.folders[b].n));
  const inF = (f: string) => ids.filter((id) => p.docs[id].f === f);
  const cnt = (f: string): number => inF(f).length + kids(f).reduce((s, k) => s + cnt(k), 0);

  const row = (id: string) => (
    <div key={id} className={'dr' + (id === p.cur ? ' on' : '')}>
      <button className="dl" onClick={() => p.onOpen(id)}>{p.docs[id].name}</button>
      <button className="mo" data-t="more" title="Move or delete" onClick={(e) => p.onDocMore(id, e.currentTarget)}>⋯</button>
    </div>
  );
  const fol = (fid: string): React.ReactNode => {
    if (q && !cnt(fid)) return null;
    const open = !!q || p.openF[fid] !== false;
    return (
      <div key={fid}>
        <div className="fr">
          <button className="fl" onClick={() => p.onToggle(fid)}>{open ? '▾' : '▸'} {p.folders[fid].n}<small>{cnt(fid)}</small></button>
          <button className="mo" title="New document in this folder" onClick={() => p.onFolderDoc(fid)}>＋</button>
          <button className="mo" title="New folder" onClick={() => p.onFolderSub(fid)}>▤</button>
          <button className="mo" data-t="fmore" data-id={fid} title="Folder options" onClick={(e) => p.onFolderMore(fid, e.currentTarget)}>⋯</button>
        </div>
        {open && <div className="ind">{kids(fid).map(fol)}{inF(fid).map(row)}</div>}
      </div>
    );
  };
  const root = ids.filter((id) => !p.folders[p.docs[id].f]);
  const top = kids('').filter((f) => !q || cnt(f) > 0);

  return (
    <aside id="side" aria-label="Documents" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); p.onImport([...e.dataTransfer.files]); }}>
      <div className="sh"><input id="q" type="search" placeholder="Search documents" aria-label="Search documents" value={p.query} onChange={(e) => p.onQuery(e.target.value)} /></div>
      <div className="sb">
        <button id="sdoc" onClick={p.onNewDoc}>+ Doc</button>
        <button id="sfold" onClick={p.onNewFolder}>+ Folder</button>
        <button id="simp" title="Add documents from this device (.txt, .md, .html, .pdf)" onClick={() => fileRef.current?.click()}>Import</button>
        <input id="file" ref={fileRef} type="file" accept=".txt,.md,.markdown,.html,.htm,.json,.pdf" multiple hidden onChange={(e) => { p.onImport([...(e.target.files || [])]); e.target.value = ''; }} />
      </div>
      <div id="tree">
        {top.map(fol)}
        {top.length > 0 && root.length > 0 && <div className="lb2">No folder</div>}
        {root.map(row)}
        {!top.length && !root.length && <p className="empty">{q ? 'No documents match.' : 'No documents yet.'}</p>}
      </div>
    </aside>
  );
}
