import { useEffect, useState } from 'react';

interface Props {
  docId: string;
  name: string;
  status: { t: string; ok: boolean };
  dark: boolean;
  zoom: 'fit' | number;
  onZoom: (z: 'fit' | number) => void;
  onToggleSidebar: () => void;
  onName: (n: string) => void;
  onSave: (el: HTMLElement) => void;
  onTheme: () => void;
  onPrint: () => void;
}

export default function TopBar(p: Props) {
  // Local text so clearing the field doesn't instantly snap back to "Untitled".
  const [v, setV] = useState(p.name);
  useEffect(() => setV(p.name), [p.docId]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <header className="top">
      <button id="docs" aria-label="Documents" title="Show or hide the document list" onClick={p.onToggleSidebar}>☰<span className="tlabel"> Docs</span></button>
      <span className="brand">Draftboard</span>
      <input id="dn" aria-label="Document name" value={v} onChange={(e) => { setV(e.target.value); p.onName(e.target.value); }} />
      <span id="sv" className="hint" aria-live="polite" style={{ color: p.status.ok ? '' : '#c0392b' }}>{p.status.t}</span>
      <span className="grow" />
      <select id="zoom" aria-label="Zoom" title="Zoom: Fit shrinks the page to the screen width" value={String(p.zoom)} onChange={(e) => p.onZoom(e.target.value === 'fit' ? 'fit' : +e.target.value)}>
        <option value="fit">Fit</option><option value="0.5">50%</option><option value="0.75">75%</option><option value="1">100%</option><option value="1.25">125%</option><option value="1.5">150%</option>
      </select>
      <button id="save" title="Save a copy to this device (Ctrl+S)" onClick={(e) => p.onSave(e.currentTarget)}>Save</button>
      <button id="theme" title="Switch between light and dark mode" onClick={p.onTheme}><span className="ticon">{p.dark ? '☀' : '☾'}</span><span className="tlabel">{p.dark ? '☀ Light' : '☾ Dark'}</span></button>
      <button id="print" title="Print or save as PDF" aria-label="Print" onClick={p.onPrint}><span className="tlabel">Print</span><span className="ticon">⎙</span></button>
    </header>
  );
}
