import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { curCell, tblOp, type TableOp } from '../lib/editor';
import { scaleOf } from '../lib/scale';

interface Props {
  editorRef: RefObject<HTMLDivElement>;
  pageRef: RefObject<HTMLDivElement>;
  onChange: () => void;
}

/** Floating toolbar that appears over the table the caret is in. */
export default function TableBar({ editorRef, pageRef, onChange }: Props) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [dropTop, setDropTop] = useState<number | null>(null);
  const drag = useRef<{ t: HTMLTableElement; ref: Element | null; end: boolean } | null>(null);

  const update = useCallback(() => {
    const ed = editorRef.current, page = pageRef.current;
    if (!ed || !page) return;
    const s = getSelection(), n = s && s.rangeCount ? s.anchorNode : null;
    let c: Element | null = null;
    if (n && ed.contains(n)) {
      const el = n.nodeType === 1 ? (n as Element) : n.parentElement;
      c = el && el.closest('td,th');
    }
    if (!c) { setPos(null); return; }
    const pr = page.getBoundingClientRect(), r = c.closest('table')!.getBoundingClientRect();
    const sc = scaleOf(page);
    const next = { left: Math.max(4, (r.left - pr.left) / sc), top: Math.max(4, (r.top - pr.top) / sc - 38) };
    setPos((p) => (p && p.left === next.left && p.top === next.top ? p : next));
  }, [editorRef, pageRef]);

  useEffect(() => {
    const ed = editorRef.current;
    document.addEventListener('selectionchange', update);
    ed?.addEventListener('input', update);
    addEventListener('resize', update);
    return () => {
      document.removeEventListener('selectionchange', update);
      ed?.removeEventListener('input', update);
      removeEventListener('resize', update);
    };
  }, [editorRef, update]);

  // dragging the table to another position between blocks
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current, ed = editorRef.current, page = pageRef.current;
      if (!d || !ed || !page) return;
      const pr = page.getBoundingClientRect(), kids = [...ed.children].filter((k) => k !== d.t);
      let ref: Element | null = null, y: number | null = null;
      for (const k of kids) {
        const r = k.getBoundingClientRect();
        if (e.clientY < r.top + r.height / 2) { ref = k; y = r.top; break; }
      }
      if (!ref && kids.length) y = kids[kids.length - 1].getBoundingClientRect().bottom;
      d.ref = ref;
      d.end = !ref && kids.length > 0;
      if (y != null) setDropTop((y - pr.top) / scaleOf(page) - 1);
    };
    const up = () => {
      const d = drag.current, ed = editorRef.current;
      if (!d || !ed) return;
      drag.current = null;
      setDropTop(null);
      if (d.ref || d.end) {
        if (d.ref) ed.insertBefore(d.t, d.ref);
        else ed.appendChild(d.t);
        const nx = d.t.nextElementSibling;
        if (!nx || nx.tagName === 'TABLE') d.t.insertAdjacentHTML('afterend', '<p><br></p>');
        onChange();
        update();
      }
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    return () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
    };
  }, [editorRef, pageRef, onChange, update]);

  const op = (t: TableOp, v = '') => ({
    onClick: () => {
      if (!editorRef.current) return;
      tblOp(editorRef.current, t, v);
      onChange();
      update();
    },
  });

  return (
    <>
      <div id="tbar" className={pos ? 'on' : ''} role="toolbar" aria-label="Table tools" style={pos ?? undefined} onMouseDown={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          if (!(e.target as Element).closest('[data-t=move]') || !editorRef.current) return;
          const c = curCell(editorRef.current);
          if (!c) return;
          drag.current = { t: c.closest('table')!, ref: null, end: false };
          e.preventDefault();
          try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
        }}>
        <button data-t="move" title="Drag to move the table">⠿ Move</button>
        <button title="Add a row below" {...op('tadd', 'row')}>+ Row</button>
        <button title="Add a column to the right" {...op('tadd', 'col')}>+ Column</button>
        <button title="Delete this row" {...op('tdelr')}>− Row</button>
        <button title="Delete this column" {...op('tdelc')}>− Column</button>
        <button title="Delete the table" {...op('tdel')}>Delete</button>
      </div>
      <div id="dropi" style={dropTop != null ? { display: 'block', top: dropTop } : undefined} />
    </>
  );
}
