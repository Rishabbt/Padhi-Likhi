import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { getSaved } from '../lib/editor';

interface Props {
  /** Element to anchor under; when null the popover follows the text selection. */
  anchor: Element | null;
  editor: HTMLElement | null;
  onClose: () => void;
  children: ReactNode;
}

export default function Popover({ anchor, editor, onClose, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Re-position after every render, since the content (and so the size) can change.
  useLayoutEffect(() => {
    const pop = ref.current;
    if (!pop) return;
    const s = getSelection();
    const r = s && s.rangeCount && editor && editor.contains(s.anchorNode) ? s.getRangeAt(0) : getSaved();
    let b: DOMRect | null = anchor ? anchor.getBoundingClientRect() : r ? r.getBoundingClientRect() : null;
    if (!b || !b.height) {
      let el: Node | null = r ? r.startContainer : editor;
      if (el && el.nodeType !== 1) el = el.parentElement;
      if (el) b = (el as Element).getBoundingClientRect();
    }
    if (!b) return;
    pop.style.left = Math.max(8, Math.min(b.left, innerWidth - pop.offsetWidth - 8)) + 'px';
        let t = b.bottom + 6;
    const barH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--barH')) || 90;
    if (t + pop.offsetHeight > innerHeight - barH - 20) {
      // open upwards; for buttons inside the bottom bar, stop above the whole bar, not just the button
      const bar = anchor && anchor.closest('.bar');
      t = (bar ? bar.getBoundingClientRect().top : b.top) - pop.offsetHeight - 8;
    }
    pop.style.top = Math.max(8, t) + 'px';
  });

  useEffect(() => {
    const h = (e: PointerEvent) => {
      if (!(e.target as Element).closest('#pop')) onClose();
    };
    document.addEventListener('pointerdown', h);
    return () => document.removeEventListener('pointerdown', h);
  }, [onClose]);

  // Keep the editor selection alive while clicking menu buttons (inputs still take focus).
  const keepSel = (e: { target: EventTarget; preventDefault: () => void }) => {
    if (!(e.target as Element).closest('input')) e.preventDefault();
  };
  return (
    <div id="pop" ref={ref} style={{ display: 'block' }} onPointerDown={keepSel} onMouseDown={keepSel}>
      {children}
    </div>
  );
}
