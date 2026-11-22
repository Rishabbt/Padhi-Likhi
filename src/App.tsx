import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { BoxShape, LineShape, Shape, Stroke } from './types';
import { DEFAULT_SIZE } from './lib/boxes';
import { hx, rnd, sid, tint } from './lib/colors';
import { PAGE_W } from './lib/pageGeometry';
import { applyHighlight, cmd, curCell, getSaved, insTable, restore, setSize, stripZw, tblOp, textGrad, type TableOp } from './lib/editor';
import { exportHTML, exportTxt, readImports } from './lib/exportImport';
import { exportPDF } from './lib/pdf';
import type { Recognized } from './lib/geometry';
import { useDocStore } from './hooks/useDocStore';
import type { Tool } from './components/Layer';
import Page from './components/Page';
import Popover from './components/Popover';
import Sidebar from './components/Sidebar';
import Toolbar from './components/Toolbar';
import TopBar from './components/TopBar';
import { HlMenu, CMDS, ColorMenu, DocMenu, FmtMenu, FolderMenu, SaveMenu, ShapeMenu, SlashMenu, TableMenu, type SlashCmd } from './components/Menus';

type Menu =
  | { k: 'slash'; items: SlashCmd[]; idx: number; len: number }
  | { k: 'color' | 'fmt' | 'shape' | 'table' | 'save'| 'hl'  }
  | { k: 'doc' | 'folder'; id: string };
type UndoEntry = { k: 'p'; id: string } | { k: 's'; id: string; stroke: Stroke };

const HEX = /^#[0-9a-f]{6}$/i;

export default function App() {
  const editorRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
const store = useDocStore(() => (editorRef.current ? stripZw(editorRef.current.innerHTML) : null));
  const { doc, docs, folders, cur } = store;
  const [hlMode, setHlMode] = useState<'off' | 'mark' | 'clear'>('off');  const [hlColor, setHlColor] = useState('#fff3a3');
  const [sel, setSel] = useState<string | null>(null);
  const [snapId, setSnapId] = useState<string | null>(null);
  const [tool, setToolState] = useState<Tool>(null);
  const [penColor, setPenColor] = useState('#2563eb');
  const [penWidth, setPenWidth] = useState(4);
  const [menu, setMenu] = useState<{ m: Menu; anchor: Element | null } | null>(null);
  const [query, setQuery] = useState('');
  const [openF, setOpenF] = useState<Record<string, boolean>>({});
  const [sidebar, setSidebar] = useState(() => innerWidth > 900);
  const [zoom, setZoom] = useState<'fit' | number>('fit');
  const [avail, setAvail] = useState(0);
  const [folderMenuFor, setFolderMenuFor] = useState<string | null>(null);
  const undo = useRef<UndoEntry[]>([]);
  const count = useRef(0);

  /* ---- theme ---- */
  const [theme, setTheme] = useState<'light' | 'dark' | null>(() => {
    try { const t = localStorage.getItem('db-theme'); return t === 'light' || t === 'dark' ? t : null; } catch { return null; }
  });
  const [sysDark, setSysDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)'), h = () => setSysDark(mq.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  useLayoutEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
  }, [theme]);
  const dark = theme ? theme === 'dark' : sysDark;

  useLayoutEffect(() => { document.body.classList.toggle('sd', sidebar); }, [sidebar]);
  // width left for the page (screen minus the docked sidebar and side padding); drives "Fit" zoom
  useLayoutEffect(() => {
    const f = () => setAvail(document.documentElement.clientWidth - (sidebar && innerWidth > 900 ? 260 : 0) - 20);
    f();
    addEventListener('resize', f);
    return () => removeEventListener('resize', f);
  }, [sidebar]);
  const scale = zoom === 'fit' ? Math.max(0.25, Math.min(1, (avail || PAGE_W) / PAGE_W)) : zoom;
  useEffect(() => {
    document.body.classList.toggle('pen', tool !== null);
    document.body.classList.toggle('er', tool === 'eraser');
  }, [tool]);

  // switching documents resets per-document UI state
  useEffect(() => {
    setSel(null); setSnapId(null); setMenu(null);
    undo.current = [];
    count.current = store.scene().shapes.length;
  }, [cur]); // eslint-disable-line react-hooks/exhaustive-deps

    /* ---- highlighter pen ---- */
    /* ---- highlighter pen (mark) and highlight remover (clear) ---- */
  useLayoutEffect(() => {
    document.body.classList.toggle('hl', hlMode === 'mark');
    document.body.classList.toggle('hlc', hlMode === 'clear');
    document.body.style.setProperty('--hl', hlColor);
  }, [hlMode, hlColor]);
  // While a pen is on, apply it to whatever gets selected in the editor once the selection settles.
  useEffect(() => {
    if (hlMode === 'off') return;
    const color = hlMode === 'mark' ? hlColor : 'transparent';
    let down = false, timer = 0;
    const apply = () => {
      const ed = editorRef.current, s = getSelection();
      if (!ed || !s || !s.rangeCount || s.isCollapsed || !ed.contains(s.anchorNode) || !ed.contains(s.focusNode)) return;
      applyHighlight(color);
      store.markDirty();
    };
    const later = (ms: number) => { clearTimeout(timer); timer = window.setTimeout(() => { if (!down) apply(); }, ms); };
    const pd = (e: PointerEvent) => { if ((e.target as Element).closest('#editor')) down = true; };
    const pu = () => { down = false; later(40); };
    const sc = () => later(350); // touch selection handles and Shift+arrow selections
    document.addEventListener('pointerdown', pd);
    document.addEventListener('pointerup', pu);
    document.addEventListener('selectionchange', sc);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', pd);
      document.removeEventListener('pointerup', pu);
      document.removeEventListener('selectionchange', sc);
    };
  }, [hlMode, hlColor]); // eslint-disable-line react-hooks/exhaustive-deps
  const hasTextSelection = () => {
    const s = getSelection(), r = editorRef.current && s && s.rangeCount && editorRef.current.contains(s.anchorNode) ? s.getRangeAt(0) : getSaved();
    return !!r && !r.collapsed;
  };
  /** highlight (or clear) the text that is selected right now */
  const highlightSelection = (color: string) => { restore(ed()); applyHighlight(color); store.markDirty(); };
  const onHlButton = () => {
    if (hlMode === 'mark') { setHlMode('off'); return; }                    // on -> off
    if (hasTextSelection()) { highlightSelection(hlColor); setHlMode('off'); return; } // text selected -> highlight it now
    setHlMode('mark'); setToolState(null);                                  // nothing selected -> pen on
  };
  const onHlClear = () => {
    if (hlMode === 'clear') { setHlMode('off'); return; }
    if (hasTextSelection()) { highlightSelection('transparent'); setHlMode('off'); return; }
    setHlMode('clear'); setToolState(null);
  };
  const onHlColor = (c: string) => {
    setHlColor(c);
    if (hasTextSelection() && hlMode === 'off') highlightSelection(c);
    else setHlMode('mark');
  };
 
  const closeMenu = useCallback(() => setMenu(null), []);
  const openMenu = (m: Menu, anchor: Element | null = null) => setMenu({ m, anchor });
  const ed = () => editorRef.current!;

  /* ---- selection ---- */
  const select = (id: string | null) => {
    setSel(id);
    if (id && document.activeElement === editorRef.current) editorRef.current!.blur();
  };
  const selShape = sel ? doc.shapes.find((s) => s.id === sel) ?? null : null;
  const shapeEl = () => (sel ? document.querySelector('#layer [data-id="' + sel + '"]') : null);

  const updateShape = (id: string, fn: (s: Shape) => Shape) =>
    store.setScene((sc) => ({ ...sc, shapes: sc.shapes.map((s) => (s.id === id ? fn(s) : s)) }));
  const deleteShape = (id: string) => {
    store.setScene((sc) => ({ ...sc, shapes: sc.shapes.filter((s) => s.id !== id) }));
    setSel(null);
  };
  const fillShape = (v: string) => {
    if (!selShape) return;
    updateShape(selShape.id, (s) => (s.type === 'line' ? { ...s, color: v } : { ...s, fill: v, grad: undefined }));
  };
  const gradShape = (a: string, b: string) => {
    if (selShape?.type === 'box') updateShape(selShape.id, (s) => ({ ...(s as BoxShape), fill: a, grad: [a, b] }));
  };
  const sfValue = !selShape ? '#dbeafe' : selShape.type === 'line' ? (HEX.test(selShape.color) ? selShape.color : '#1b1b1b') : HEX.test(selShape.fill) ? selShape.fill : '#dbeafe';

  const addBox = (kind: BoxShape['kind']) => {
    const n = count.current++, [w, h] = DEFAULT_SIZE[kind];
    const s: BoxShape = { type: 'box', id: sid(), kind, x: 300 + (n % 6) * 24, y: 240 + (n % 6) * 24, w, h, fill: kind === 'text' ? 'transparent' : rnd(), label: '' };
    store.setScene((sc) => ({ ...sc, shapes: [...sc.shapes, s] }));
    select(s.id);
  };
  const addArrow = () => {
    const o = (count.current++ % 6) * 24;
    const l: LineShape = { type: 'line', id: sid(), x1: 300 + o, y1: 300 + o, x2: 480 + o, y2: 300 + o, w: 3, head: 'end', dash: false, color: hx(Math.random() * 360, 70, 42) };
    store.setScene((sc) => ({ ...sc, shapes: [...sc.shapes, l] }));
    select(l.id);
  };

  /* ---- pen ---- */
  const addStroke = (s: Stroke) => {
    undo.current.push({ k: 'p', id: s.id });
    store.setScene((sc) => ({ ...sc, strokes: [...sc.strokes, s] }));
  };
  const snap = (res: Recognized, stroke: Stroke) => {
    const id = sid();
    const shape: Shape = res.line
      ? { type: 'line', id, x1: res.x1, y1: res.y1, x2: res.x2, y2: res.y2, ...(res.cx != null ? { cx: res.cx, cy: res.cy } : {}), w: 3, head: 'end', dash: false, color: penColor }
      : { type: 'box', id, kind: res.type, x: res.x, y: res.y, w: res.w, h: res.h, fill: tint(penColor), label: '' };
    undo.current.push({ k: 's', id, stroke });
    store.setScene((sc) => ({ ...sc, shapes: [...sc.shapes, shape] }));
    setSnapId(id);
    setTimeout(() => setSnapId((x) => (x === id ? null : x)), 450);
  };
  const penUndo = () => {
    let u: UndoEntry | undefined;
    while ((u = undo.current.pop())) {
      const { shapes, strokes } = store.scene();
      if (u.k === 'p') {
        const id = u.id;
        if (strokes.some((k) => k.id === id)) { store.setScene((sc) => ({ ...sc, strokes: sc.strokes.filter((k) => k.id !== id) })); return; }
      } else {
        const { id, stroke } = u;
        if (shapes.some((s) => s.id === id)) { store.setScene((sc) => ({ shapes: sc.shapes.filter((s) => s.id !== id), strokes: [...sc.strokes, stroke] })); return; }
      }
    }
    const { strokes } = store.scene();
    if (strokes.length) store.setScene((sc) => ({ ...sc, strokes: sc.strokes.slice(0, -1) }));
  };

  /* ---- text commands ---- */
  const run = (fn: () => void) => { fn(); store.markDirty(); };
  const doCmd = (c: string, v?: string) => run(() => cmd(ed(), c, v));
  const doSize = (n: number | string) => run(() => setSize(ed(), n));
  const doGrad = (a: string, b: string) => run(() => textGrad(ed(), a, b));
  const doTable = (op: TableOp, v?: string) => { tblOp(ed(), op, v); store.markDirty(); };

  /* ---- slash menu ---- */
  const slashCheck = () => {
    const s = getSelection();
    if (!s || !s.rangeCount || !s.isCollapsed || !s.anchorNode || s.anchorNode.nodeType !== 3) { setMenu((m) => (m?.m.k === 'slash' ? null : m)); return; }
    const m = (s.anchorNode.textContent || '').slice(0, s.anchorOffset).match(/(?:^|[\s\u200b])\/(\w*)$/)
    if (!m) { setMenu((x) => (x?.m.k === 'slash' ? null : x)); return; }
    const items = CMDS.filter((c) => c.k.startsWith(m[1].toLowerCase()));
    if (!items.length) { setMenu(null); return; }
    openMenu({ k: 'slash', items, idx: 0, len: m[1].length + 1 });
  };
  const applySlash = (c: SlashCmd, len: number) => {
    const s = getSelection()!, n = s.anchorNode!, o = s.anchorOffset, t = n.textContent || '';
    n.textContent = t.slice(0, o - len) + t.slice(o);
    const r = document.createRange();
    r.setStart(n, o - len);
    r.collapse(true);
    s.removeAllRanges();
    s.addRange(r);
    document.execCommand('formatBlock', false, c.f);
    setMenu(null);
    store.markDirty();
  };

  /* ---- save / export ---- */
  const download = (name: string, data: Uint8Array | string, type: string) => {
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([data as BlobPart], { type }));
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
      store.setStatus('Downloaded ' + name);
    } catch {
      store.setStatus('Could not save the file', false);
    }
  };
  const doSave = (v: 'pdf' | 'html' | 'txt' | 'json') => {
    setMenu(null);
    const name = doc.name, nm = (name.replace(/[\\/:*?"<>|]+/g, '').trim() || 'document');
    const { shapes, strokes } = store.scene();
    if (v === 'pdf') {
      store.setStatus('Preparing PDF…');
      flushSync(() => setSel(null));
      try {
        download(nm + '.pdf', exportPDF({ page: pageRef.current!, editor: ed(), layer: document.getElementById('layer')!, shapes, strokes, name }), 'application/pdf');
      } catch {
        store.setStatus('Could not create the PDF', false);
      }
    } else if (v === 'html') download(nm + '.html', exportHTML(name, stripZw(ed().innerHTML), shapes, strokes), 'text/html');
    else if (v === 'txt') download(nm + '.txt', exportTxt(stripZw(ed().innerText), shapes), 'text/plain');
    else download('draftboard-backup.json', JSON.stringify({ draftboard: 3, ...store.snapshot() }), 'application/json');
  };

  /* ---- documents & folders ---- */
  const openDoc = (id: string) => {
    if (id !== cur) store.openDoc(id);
    if (innerWidth <= 900) setSidebar(false);
  };
  const importFiles = async (files: File[]) => store.mergeImport(await readImports(files));
  const newFolder = (parent = '') => {
    const id = store.newFolder(parent);
    if (parent) setOpenF((o) => ({ ...o, [parent]: true }));
    setOpenF((o) => ({ ...o, [id]: true }));
    setFolderMenuFor(id);
  };
  // after a folder is created, open its rename menu once its row has rendered
  useEffect(() => {
    if (!folderMenuFor) return;
    const b = document.querySelector('#tree [data-t=fmore][data-id="' + folderMenuFor + '"]');
    if (b) openMenu({ k: 'folder', id: folderMenuFor }, b);
    setFolderMenuFor(null);
  }, [folderMenuFor]);

  /* ---- global keyboard & pointer handling (always sees the latest state via a ref) ---- */
  const L = useRef({ sel, tool, menu, selShape, sidebar });
  L.current = { sel, tool, menu, selShape, sidebar };
  const fns = useRef({ deleteShape, penUndo, closeMenu, doSave, newFolder, openMenu, shapeEl });
  fns.current = { deleteShape, penUndo, closeMenu, doSave, newFolder, openMenu, shapeEl };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const F = fns.current, S = L.current, t = e.target as HTMLElement;
      if ((e.key === 'Delete' || e.key === 'Backspace') && S.sel && !t.isContentEditable && !/INPUT|SELECT/.test(t.tagName)) F.deleteShape(S.sel);
      if (S.tool && (e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); F.penUndo(); }
if (e.key === 'Escape') { F.closeMenu(); setHlMode('off'); if (S.tool) setToolState(null); }      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.code === 'KeyC' || e.code === 'KeyF')) {
        e.preventDefault();
        if (e.code === 'KeyC' && S.sel) { F.openMenu({ k: 'shape' }, F.shapeEl()); return; }
        if (!getSaved()) return;
        F.openMenu({ k: e.code === 'KeyC' ? 'color' : 'fmt' });
      }
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyN') {
        e.preventDefault();
        e.shiftKey ? F.newFolder('') : store.newDoc('');
      }
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.code === 'KeyS') { e.preventDefault(); F.doSave('html'); }
    };
    const down = (e: PointerEvent) => {
      const t = e.target as Element;
      if (!t.closest('.shape,.bar,#pop')) setSel(null);
      // on small screens the document list overlays the page: tapping elsewhere closes it
      if (innerWidth <= 900 && L.current.sidebar && !t.closest('#side,#docs,#pop')) setSidebar(false);
    };
    document.addEventListener('keydown', key);
    document.addEventListener('pointerdown', down);
    return () => {
      document.removeEventListener('keydown', key);
      document.removeEventListener('pointerdown', down);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- popover content ---- */
  const menuBody = () => {
    if (!menu) return null;
    const m = menu.m;
    switch (m.k) {
      case 'slash':
        return <SlashMenu items={m.items} idx={m.idx} onPick={(i) => applySlash(m.items[i], m.len)} />;
      case 'color':
        return <ColorMenu onFg={(c) => doCmd('foreColor', c)} onBg={(c) => doCmd('hiliteColor', c)} onGrad={(a, b) => { doGrad(a, b); setMenu(null); }} />;
              case 'hl':
        return <HlMenu color={hlColor} onPick={(c) => { onHlColor(c); setMenu(null); }} />;
      case 'fmt':
        return <FmtMenu onCmd={(c) => doCmd(c)} onSize={doSize} onFont={(f) => doCmd('fontName', f)} />;
      case 'shape':
        return selShape && (
          <ShapeMenu shape={selShape} fillValue={sfValue} onFill={fillShape} onGrad={(a, b) => { gradShape(a, b); setMenu(null); }}
            onRandom={() => { fillShape(rnd()); setMenu(null); }}
            onLabelColor={(c) => { if (selShape.type === 'box') updateShape(selShape.id, (s) => ({ ...(s as BoxShape), labelColor: c })); setMenu(null); }}
            onLine={(p) => { updateShape(selShape.id, (s) => ({ ...(s as LineShape), ...p })); setMenu(null); }}
            onStraighten={() => { updateShape(selShape.id, (s) => { const { cx: _x, cy: _y, ...r } = s as LineShape; return r; }); setMenu(null); }} />
        );
      case 'table':
        return <TableMenu hasCell={!!curCell(ed())} onInsert={(s) => { setMenu(null); run(() => insTable(ed(), s)); }} onOp={(o, v) => { setMenu(null); doTable(o, v); }} />;
      case 'save':
        return <SaveMenu onSave={doSave} />;
      case 'doc':
        return <DocMenu id={m.id} docs={docs} folders={folders} onMove={(f) => { store.moveDoc(m.id, f); setMenu(null); }} onDelete={() => { store.deleteDoc(m.id); setMenu(null); }} />;
      case 'folder':
        return folders[m.id] && (
          <FolderMenu id={m.id} folders={folders} onDone={() => setMenu(null)}
            onRename={(n) => store.setFolders((f) => ({ ...f, [m.id]: { ...f[m.id], n: n.trim() || 'Folder' } }))}
            onNewDoc={() => { setMenu(null); setOpenF((o) => ({ ...o, [m.id]: true })); store.newDoc(m.id); }}
            onNewSub={() => { setMenu(null); newFolder(m.id); }}
            onMove={(p) => { store.setFolders((f) => ({ ...f, [m.id]: { ...f[m.id], p } })); if (p) setOpenF((o) => ({ ...o, [p]: true })); setMenu(null); }}
            onDelete={() => { store.deleteFolder(m.id); setMenu(null); }} />
        );
    }
  };

  return (
    <>
      <TopBar docId={cur} name={doc.name} status={store.status} dark={dark} zoom={zoom} onZoom={setZoom}
        onToggleSidebar={() => setSidebar((s) => !s)} onName={store.setName}
        onSave={(el) => openMenu({ k: 'save' }, el)}
        onTheme={() => { const t = dark ? 'light' : 'dark'; setTheme(t); try { localStorage.setItem('db-theme', t); } catch { /* ignore */ } }}
        onPrint={() => { flushSync(() => setSel(null)); window.print(); }} />
      <Toolbar hasSel={!!selShape} sfValue={sfValue} tool={tool} penColor={penColor} penWidth={penWidth}
        onCmd={(c) => doCmd(c)} onFont={(f) => doCmd('fontName', f)} onSize={doSize} onFg={(c) => doCmd('foreColor', c)} hlMode={hlMode} hlColor={hlColor} onHlButton={onHlButton} onHlMenu={(el) => openMenu({ k: 'hl' }, el)} onHlClear={onHlClear}
        onTool={(t) => { const next = tool === t ? null : t; setToolState(next); if (next) { setSel(null); setMenu(null); setHlMode('off'); } }}
        onPenColor={setPenColor} onPenWidth={setPenWidth}
        onShape={(k) => (k === 'arrow' ? addArrow() : addBox(k))} onShapeFill={fillShape}
        onFront={() => selShape && store.setScene((sc) => ({ ...sc, shapes: [...sc.shapes.filter((s) => s.id !== selShape.id), selShape] }))}
        onDelete={() => selShape && deleteShape(selShape.id)}
        onTable={(el) => { openMenu({ k: 'table' }, el); }}
        onColors={() => { if (selShape) openMenu({ k: 'shape' }, shapeEl()); else if (getSaved()) openMenu({ k: 'color' }); }}
        onRandom={() => selShape && fillShape(rnd())} />
      <Sidebar docs={docs} folders={folders} cur={cur} query={query} openF={openF}
        onQuery={setQuery} onNewDoc={() => store.newDoc('')} onNewFolder={() => newFolder('')} onImport={importFiles}
        onOpen={openDoc} onDocMore={(id, el) => openMenu({ k: 'doc', id }, el)}
        onToggle={(f) => setOpenF((o) => ({ ...o, [f]: o[f] === false }))}
        onFolderMore={(id, el) => openMenu({ k: 'folder', id }, el)}
        onFolderDoc={(f) => { setOpenF((o) => ({ ...o, [f]: true })); store.newDoc(f); }}
        onFolderSub={(f) => newFolder(f)} />
      <Page key={cur} scale={scale} editorRef={editorRef} pageRef={pageRef} html={doc.e}
        onInput={() => { store.markDirty(); slashCheck(); }}
        onKeyDown={(e) => {
          const m = menu?.m;
          if (m?.k !== 'slash') return;
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const idx = (m.idx + (e.key === 'ArrowDown' ? 1 : m.items.length - 1)) % m.items.length;
            setMenu({ m: { ...m, idx }, anchor: null });
          } else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); applySlash(m.items[m.idx], m.len); }
        }}
        onTableChange={store.markDirty}
        layer={{
          shapes: doc.shapes, strokes: doc.strokes, sel, snapId, tool, penColor, penWidth,
          onSelect: select, onChange: updateShape, onDelete: deleteShape, onAddStroke: addStroke, onSnap: snap,
          onEraseStroke: (id) => store.setScene((sc) => ({ ...sc, strokes: sc.strokes.filter((k) => k.id !== id) })),
        }} />
      {menu && <Popover anchor={menu.anchor} editor={editorRef.current} onClose={closeMenu}>{menuBody()}</Popover>}
    </>
  );
}
