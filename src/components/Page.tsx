import { Fragment, useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { clearSaved, trackSelection } from '../lib/editor';
import { GAP, MARGIN, PAGE_W, PITCH } from '../lib/pageGeometry';
import { scaleOf } from '../lib/scale';
import Layer from './Layer';
import TableBar from './TableBar';

type LayerProps = React.ComponentProps<typeof Layer>;

interface Props {
  editorRef: RefObject<HTMLDivElement>;
  pageRef: RefObject<HTMLDivElement>;
  /** editor HTML, applied once when the page mounts (the page is re-keyed per document) */
  html: string;
  onInput: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
  onTableChange: () => void;
  layer: LayerProps;
  /** visual scale of the page: below 1 on narrow screens so the whole sheet fits */
  scale: number;
}

/** How many sheets the text needs. Grows and shrinks as the content changes. */
function usePageCount(editorRef: RefObject<HTMLDivElement>, pageRef: RefObject<HTMLDivElement>) {
  const [pages, setPages] = useState(1);
  const raf = useRef(0);
  const measure = useCallback(() => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const ed = editorRef.current, pg = pageRef.current;
      if (!ed || !pg) return;
      const r = document.createRange();
      r.selectNodeContents(ed);
      const b = r.getBoundingClientRect();
      const bottom = b.height ? (b.bottom - pg.getBoundingClientRect().top) / scaleOf(pg) + 8 : 0;
      setPages(Math.max(1, Math.ceil((bottom + MARGIN + GAP) / PITCH)));
    });
  }, [editorRef, pageRef]);

  useLayoutEffect(() => {
    const ed = editorRef.current!;
    const mo = new MutationObserver(measure);
    mo.observe(ed, { childList: true, subtree: true, characterData: true, attributes: true });
    const ro = new ResizeObserver(measure);
    ro.observe(ed);
    addEventListener('resize', measure);
    document.fonts?.ready.then(measure);
    measure();
    return () => {
      mo.disconnect();
      ro.disconnect();
      removeEventListener('resize', measure);
      cancelAnimationFrame(raf.current);
    };
  }, [editorRef, measure]);
  // adding or removing a page break moves text, so measure again once it's laid out
  useLayoutEffect(measure, [pages, measure]);
  return pages;
}

export default function Page({ editorRef, pageRef, html, onInput, onKeyDown, onTableChange, layer, scale }: Props) {
  // The editor is a browser-managed contentEditable: set its HTML once, never re-render it.
  useLayoutEffect(() => {
    const ed = editorRef.current!;
    ed.innerHTML = html;
    clearSaved();
    return trackSelection(ed);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const pages = usePageCount(editorRef, pageRef);

  return (
    <div className="wrap">
      {/* The page keeps its real Letter size and is scaled visually; this box reserves the scaled space. */}
      <div className="pagebox" style={{ width: PAGE_W * scale, height: `calc((var(--ph) * ${pages} + var(--gap) * ${pages - 1}) * ${scale})` }}>
      <div id="page" ref={pageRef} style={{ height: `calc(var(--ph) * ${pages} + var(--gap) * ${pages - 1})`, ...(scale !== 1 ? { transform: `scale(${scale})`, transformOrigin: '0 0' } : {}) }}>
        {Array.from({ length: pages }, (_, k) => (
          <div key={'s' + k} className="sheet" style={{ top: `calc((var(--ph) + var(--gap)) * ${k})` }} />
        ))}
        <div className="pgaps" aria-hidden="true">
          {Array.from({ length: pages - 1 }, (_, k) => (
            <Fragment key={k}><div className={'pgsp' + (k ? '' : ' first')} /><div className="pgap" /></Fragment>
          ))}
        </div>
        <div id="editor" ref={editorRef} contentEditable suppressContentEditableWarning spellCheck onInput={onInput} onKeyDown={onKeyDown} />
        <Layer {...layer} />
        <TableBar editorRef={editorRef} pageRef={pageRef} onChange={onTableChange} />
      </div>
      </div>
    </div>
  );
}
