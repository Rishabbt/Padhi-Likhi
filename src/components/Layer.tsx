import { createElement, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react';
import type { BoxShape, LineShape, Pt, Shape, Stroke } from '../types';
import { BOX_DEF, fillVar, gradId } from '../lib/boxes';
import { lineGeom, moveLine, pathD, recognize, type Recognized } from '../lib/geometry';
import { sid } from '../lib/colors';
import { scaleOf } from '../lib/scale';

export type Tool = 'pen' | 'eraser' | null;

interface Props {
  shapes: Shape[];
  strokes: Stroke[];
  sel: string | null;
  snapId: string | null;
  tool: Tool;
  penColor: string;
  penWidth: number;
  onSelect: (id: string | null) => void;
  onChange: (id: string, fn: (s: Shape) => Shape) => void;
  onDelete: (id: string) => void;
  onAddStroke: (s: Stroke) => void;
  onEraseStroke: (id: string) => void;
  onSnap: (res: Recognized, stroke: Stroke) => void;
}

const CSSVars = (o: Record<string, string | number | undefined>) => o as unknown as CSSProperties;

function Label({ text, editing, onCommit }: { text: string; editing: boolean; onCommit: (t: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  // The label's text is written by hand so React never fights the contentEditable caret.
  useLayoutEffect(() => {
    if (ref.current && !editing) ref.current.textContent = text;
  }, [text, editing]);
  useEffect(() => {
    const el = ref.current;
    if (!editing || !el) return;
    el.focus();
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    const s = getSelection()!;
    s.removeAllRanges();
    s.addRange(r);
  }, [editing]);
  return <div className="lbl" ref={ref} contentEditable={editing} suppressContentEditableWarning onBlur={() => editing && onCommit(ref.current?.innerText.replace(/\n$/, '') ?? '')} />;
}

function BoxView({ s, sel, snapped, editing, onLabel, onDelete }: { s: BoxShape; sel: boolean; snapped: boolean; editing: boolean; onLabel: (t: string) => void; onDelete: () => void }) {
  const def = BOX_DEF[s.kind];
  return (
    <div className={'shape' + (sel ? ' sel' : '') + (snapped ? ' snapped' : '')} data-id={s.id}
      style={CSSVars({ left: s.x, top: s.y, width: s.w, height: s.h, '--f': fillVar(s), '--t': s.labelColor })}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        {s.grad && (
          <defs>
            <linearGradient id={gradId(s)} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={s.grad[0]} /><stop offset="1" stopColor={s.grad[1]} />
            </linearGradient>
          </defs>
        )}
        {createElement(def.tag, def.attrs)}
      </svg>
      <Label text={s.label} editing={editing} onCommit={onLabel} />
      {sel && ['nw', 'ne', 'sw', 'se'].map((h) => <div key={h} className="rh" data-h={h} />)}
      {sel && <div className="xd" title="Delete shape (or press Delete)" onClick={onDelete}>Delete</div>}
    </div>
  );
}

function LineView({ s, sel, snapped, onDelete }: { s: LineShape; sel: boolean; snapped: boolean; onDelete: () => void }) {
  const g = lineGeom(s);
  return (
    <div className={'shape line' + (sel ? ' sel' : '') + (snapped ? ' snapped' : '')} data-id={s.id}
      style={CSSVars({ left: g.left, top: g.top, width: g.width, height: g.height, '--f': s.color })}>
      <svg>
        <path className="hit" d={g.hitD} />
        <path className="ln" d={g.lnD} strokeWidth={s.w} strokeDasharray={g.dash} />
        {g.tips.map((t, i) => <polygon key={i} points={t} />)}
      </svg>
      {sel && (['p1', 'p2', 'pc'] as const).map((k) => <div key={k} className="rh" data-h={k} style={{ left: g.handles[k][0] - 7, top: g.handles[k][1] - 7 }} />)}
      {sel && <div className="xd" title="Delete shape (or press Delete)" onClick={onDelete}>Delete</div>}
    </div>
  );
}

interface Drag { id: string; r: string | null; x: number; y: number; orig: Shape }

export default function Layer(props: Props) {
  const { shapes, strokes, sel, snapId, tool, onSelect } = props;
  const P = useRef(props);
  P.current = props;
  const layerRef = useRef<HTMLDivElement>(null);
  const inkRef = useRef<SVGSVGElement>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const drag = useRef<Drag | null>(null);
  const pts = useRef<Pt[]>([]);
  const pen = useRef<{ er: boolean; done: boolean } | null>(null);
  const hold = useRef<{ t: number | null; pt: Pt | null }>({ t: null, pt: null });

  /* ---- dragging, resizing and moving shapes ---- */
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const sc = layerRef.current ? scaleOf(layerRef.current) : 1;
      const dx = (e.clientX - d.x) / sc, dy = (e.clientY - d.y) / sc, o = d.orig;
      if (o.type === 'line') {
        P.current.onChange(d.id, () => moveLine(o, d.r, dx, dy, e.shiftKey));
        return;
      }
      let L = o.x, T = o.y, W = o.w, H = o.h;
      if (d.r) {
        const k = d.r;
        if (k.includes('e')) W = Math.max(30, o.w + dx);
        if (k.includes('w')) { W = Math.max(30, o.w - dx); L = o.x + o.w - W; }
        if (k.includes('s')) H = Math.max(20, o.h + dy);
        if (k.includes('n')) { H = Math.max(20, o.h - dy); T = o.y + o.h - H; }
      } else { L = o.x + dx; T = o.y + dy; }
      P.current.onChange(d.id, (s) => ({ ...(s as BoxShape), x: L, y: T, w: W, h: H }));
    };
    const up = () => { drag.current = null; };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    return () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
    };
  }, []);

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement, el = t.closest<HTMLElement>('.shape');
    if (!el) return;
    const id = el.dataset.id!;
    onSelect(id);
    if (t.isContentEditable || t.classList.contains('xd')) return;
    const a = document.activeElement as HTMLElement | null;
    if (a && a !== document.body) a.blur();
    const orig = shapes.find((s) => s.id === id);
    if (!orig) return;
    drag.current = { id, r: t.classList.contains('rh') ? t.dataset.h || 'se' : null, x: e.clientX, y: e.clientY, orig };
    e.preventDefault();
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.shape');
    const s = el && shapes.find((x) => x.id === el.dataset.id);
    if (s && s.type === 'box') setEditing(s.id);
  };

  /* ---- pen and eraser ---- */
  const lp = (e: { clientX: number; clientY: number }): Pt => {
    const el = layerRef.current!, r = el.getBoundingClientRect(), s = scaleOf(el);
    return [(e.clientX - r.left) / s, (e.clientY - r.top) / s];
  };

  const erase = (e: RPointerEvent) => {
    const [x, y] = lp(e);
    const hits: string[] = [];
    inkRef.current?.querySelectorAll<SVGPathElement>('path[data-id]').forEach((p) => {
      const bb = p.getBBox(), w = (+(p.getAttribute('stroke-width') || 2)) / 2 + 8;
      if (x < bb.x - w || x > bb.x + bb.width + w || y < bb.y - w || y > bb.y + bb.height + w) return;
      const L = p.getTotalLength();
      let hit = false;
      for (let s = 0; s <= L && !hit; s += 4) {
        const q = p.getPointAtLength(s);
        if (Math.hypot(q.x - x, q.y - y) <= w) hit = true;
      }
      if (L < 5 && Math.hypot(bb.x - x, bb.y - y) <= w) hit = true;
      if (hit) hits.push(p.dataset.id!);
    });
    hits.forEach((id) => P.current.onEraseStroke(id));
  };

  const snapStroke = () => {
    const c = pen.current, p = P.current;
    if (!c || c.done || c.er || p.tool !== 'pen') return;
    const res = recognize(pts.current);
    if (!res) return;
    p.onSnap(res, { id: sid(), d: pathD(pts.current), color: p.penColor, width: p.penWidth });
    c.done = true;
    setDraft(null);
  };

  const inkDown = (e: RPointerEvent<SVGSVGElement>) => {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    if (tool === 'eraser') {
      pen.current = { er: true, done: false };
      erase(e);
      return;
    }
    pts.current = [lp(e)];
    pen.current = { er: false, done: false };
    hold.current = { t: null, pt: pts.current[0] };
    setDraft(pathD(pts.current));
  };
  const inkMove = (e: RPointerEvent<SVGSVGElement>) => {
    const c = pen.current;
    if (!c || c.done) return;
    if (c.er) { erase(e); return; }
    const q = lp(e);
    pts.current.push(q);
    setDraft(pathD(pts.current));
    const h = hold.current;
    if (tool === 'pen' && h.pt && Math.hypot(q[0] - h.pt[0], q[1] - h.pt[1]) > 5) {
      h.pt = q;
      if (h.t) clearTimeout(h.t);
      h.t = window.setTimeout(snapStroke, 550); // pause at the end of a stroke to snap it
    }
  };
  const inkEnd = () => {
    if (hold.current.t) clearTimeout(hold.current.t);
    const c = pen.current;
    if (c && !c.er && !c.done && pts.current.length) props.onAddStroke({ id: sid(), d: pathD(pts.current), color: props.penColor, width: props.penWidth });
    pen.current = null;
    pts.current = [];
    setDraft(null);
  };

  return (
    <div id="layer" ref={layerRef} onPointerDown={onPointerDown} onDoubleClick={onDoubleClick}>
      {shapes.map((s) =>
        s.type === 'box' ? (
          <BoxView key={s.id} s={s} sel={sel === s.id} snapped={snapId === s.id} editing={editing === s.id}
            onLabel={(t) => { setEditing(null); props.onChange(s.id, (x) => ({ ...(x as BoxShape), label: t })); }}
            onDelete={() => props.onDelete(s.id)} />
        ) : (
          <LineView key={s.id} s={s} sel={sel === s.id} snapped={snapId === s.id} onDelete={() => props.onDelete(s.id)} />
        ),
      )}
      <svg ref={inkRef} className="ink" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', overflow: 'visible' }}
        onPointerDown={inkDown} onPointerMove={inkMove} onPointerUp={inkEnd} onPointerCancel={inkEnd}>
        {strokes.map((k) => <path key={k.id} data-id={k.id} fill="none" stroke={k.color} strokeWidth={k.width} strokeLinecap="round" strokeLinejoin="round" d={k.d} />)}
        {draft && <path fill="none" stroke={props.penColor} strokeWidth={props.penWidth} strokeLinecap="round" strokeLinejoin="round" d={draft} />}
      </svg>
    </div>
  );
}
