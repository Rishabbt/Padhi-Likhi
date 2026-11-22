import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SZ, FT } from '../lib/colors';
import type { BoxKind } from '../types';
import type { Tool } from './Layer';

const Icon = ({ children }: { children: React.ReactNode }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

interface Props {
  hasSel: boolean;
  sfValue: string;
  tool: Tool;
  penColor: string;
  penWidth: number;
  onCmd: (c: string) => void;
  onFont: (f: string) => void;
  onSize: (n: string) => void;
  onFg: (c: string) => void;
  onHighlight: (c: string) => void;
  onTool: (t: 'pen' | 'eraser') => void;
  onPenColor: (c: string) => void;
  onPenWidth: (n: number) => void;
  onShape: (k: BoxKind | 'arrow') => void;
  onShapeFill: (c: string) => void;
  onFront: () => void;
  onDelete: () => void;
  onTable: (el: HTMLElement) => void;
  onColors: (el: HTMLElement) => void;
  onRandom: () => void;
}

const SHAPES: [BoxKind | 'arrow', string, string][] = [
  ['rect', '▭', 'Rectangle'], ['round', '▢', 'Rounded box'], ['ellipse', '◯', 'Ellipse'], ['diamond', '◇', 'Diamond'],
  ['triangle', '△', 'Triangle'], ['arrow', '→', 'Arrow'], ['text', 'T', 'Text box'],
];

type Tab = 'text' | 'insert' | 'draw' | 'shape';
const TABS: [Tab, string][] = [['text', 'Text'], ['insert', 'Insert'], ['draw', 'Draw'], ['shape', 'Shape']];

/**
 * On wide screens every tool is visible. On tablets and phones the tools are split into four
 * tabs (see the max-width:900px rules in styles.css) so the bar stays one short row.
 */
export default function Toolbar(p: Props) {
  const [hc, setHc] = useState('#fff3a3');
  const [tab, setTab] = useState<Tab>('text');
  const ref = useRef<HTMLDivElement>(null);

  // selecting a shape jumps to its tab; deselecting leaves it
  useEffect(() => {
    if (p.hasSel) setTab('shape');
    else setTab((t) => (t === 'shape' ? 'insert' : t));
  }, [p.hasSel]);

  // publish the bar's height so the page, sidebar and menus can stay clear of it
  useLayoutEffect(() => {
    const el = ref.current!;
    const set = () => document.documentElement.style.setProperty('--barH', el.getBoundingClientRect().height + 'px');
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const c = (cmd: string, title: string, label: React.ReactNode) => <button data-c={cmd} title={title} onClick={() => p.onCmd(cmd)}>{label}</button>;
  return (
    <div className={'bar tab-' + tab} id="tb" ref={ref} onMouseDown={(e) => { if ((e.target as Element).closest('button')) e.preventDefault(); }}>
      <div className="tabs" role="tablist" aria-label="Tool groups">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      <div className="tg tg-text">
        {c('undo', 'Undo', '↶')}{c('redo', 'Redo', '↷')}
        <span className="sep" />
        <select id="fam" title="Font" defaultValue="Georgia" onChange={(e) => p.onFont(e.target.value)}>{FT.map((f) => <option key={f}>{f}</option>)}</select>
        <select id="siz" title="Font size" defaultValue="16" onChange={(e) => p.onSize(e.target.value)}>{SZ.map((s) => <option key={s}>{s}</option>)}</select>
        <span className="sep" />
        {c('bold', 'Bold', <b>B</b>)}{c('italic', 'Italic', <i>I</i>)}{c('underline', 'Underline', <u>U</u>)}
        <label className="c" title="Text color">Text<input type="color" id="fc" defaultValue="#1b1b1b" onChange={(e) => p.onFg(e.target.value)} /></label>
        <span className="c" title="Highlighter: click the marker to highlight, or pick a color">
          <button id="hlbtn" aria-label="Highlight selected text" onClick={() => p.onHighlight(hc)}>
            <Icon><path d="m9 11-6 6v3h9l3-3" /><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" /></Icon>
          </button>
          <input type="color" id="hc" value={hc} aria-label="Highlight color" onChange={(e) => { setHc(e.target.value); p.onHighlight(e.target.value); }} />
        </span>
        <span className="sep" />
        {c('justifyLeft', 'Align left', '⇤')}{c('justifyCenter', 'Center', '↔')}{c('justifyRight', 'Align right', '⇥')}
        {c('insertUnorderedList', 'Bullets', '• List')}{c('insertOrderedList', 'Numbers', '1. List')}
      </div>

      <span className="sep gsep" />
      <div className="tg tg-draw">
        <button id="penbtn" className={'ib' + (p.tool === 'pen' ? ' on' : '')} aria-pressed={p.tool === 'pen'} aria-label="Pen" onClick={() => p.onTool('pen')}
          title="Pen: draw freehand. Pause at the end of a stroke to turn it into a clean shape or arrow. Esc stops, Ctrl+Z undoes.">
          <Icon><path d="M12 20h9" /><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" /></Icon>
        </button>
        <button id="erbtn" className={'ib' + (p.tool === 'eraser' ? ' on' : '')} aria-pressed={p.tool === 'eraser'} aria-label="Eraser" title="Eraser: drag over a stroke to remove it" onClick={() => p.onTool('eraser')}>
          <Icon><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" /><path d="M22 21H7" /><path d="m5 11 9 9" /></Icon>
        </button>
        <input type="color" id="pc" value={p.penColor} title="Pen color" aria-label="Pen color" onChange={(e) => p.onPenColor(e.target.value)} />
        <select id="pw" title="Pen thickness" aria-label="Pen thickness" value={p.penWidth} onChange={(e) => p.onPenWidth(+e.target.value)}>
          <option value="2">Thin</option><option value="4">Medium</option><option value="8">Thick</option>
        </select>
      </div>

      <span className="br" />
      <div className="tg tg-insert">
        {SHAPES.map(([k, t, title]) => <button key={k} data-s={k} title={title} onClick={() => p.onShape(k)}>{t}</button>)}
        <span className="sep" />
        <button id="tblbtn" title="Insert or edit a table" onClick={(e) => p.onTable(e.currentTarget)}>Table</button>
        <button id="colbtn" title="Color and gradient menu (Alt+C)" onClick={(e) => p.onColors(e.currentTarget)}>Colors</button>
      </div>

      <span className="sep gsep" />
      <div className="tg tg-shape">
        <label className="c" title="Shape color">Shape<input type="color" id="sf" value={p.sfValue} disabled={!p.hasSel} onChange={(e) => p.onShapeFill(e.target.value)} /></label>
        <button id="front" title="Bring to front" disabled={!p.hasSel} onClick={p.onFront}>Front</button>
        <button id="del" title="Delete shape" disabled={!p.hasSel} onClick={p.onDelete}>Delete</button>
        <button id="rand" title="Random color for the selected shape" disabled={!p.hasSel} onClick={p.onRandom}>Random</button>
        {!p.hasSel && <span className="hint2">Tap a shape on the page to edit it</span>}
      </div>
    </div>
  );
}
