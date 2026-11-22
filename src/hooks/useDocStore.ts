import { useCallback, useEffect, useRef, useState } from 'react';
import type { Doc, Docs, Folders, Shape, Stroke } from '../types';
import { fid, uid } from '../lib/colors';
import { blankDoc, loadAll, persistDocs, persistFolders } from '../lib/storage';
import type { ImportResult } from '../lib/exportImport';

export interface Scene {
  shapes: Shape[];
  strokes: Stroke[];
}
interface State {
  docs: Docs;
  folders: Folders;
  cur: string;
}

/**
 * Documents, folders, and autosave. The state lives in a ref so timers and DOM
 * listeners always see the latest value; `commit` re-renders after each change.
 * The editor's HTML is owned by the DOM and is read through `getHTML` when saving.
 */
export function useDocStore(getHTML: () => string | null) {
  const ref = useRef<State | null>(null);
  if (!ref.current) ref.current = loadAll();
  const [, tick] = useState(0);
  const [status, setStatusRaw] = useState<{ t: string; ok: boolean }>({ t: 'Autosave on', ok: true });
  const timer = useRef<number | null>(null);
  const htmlRef = useRef(getHTML);
  htmlRef.current = getHTML;

  const commit = useCallback((s: State) => {
    ref.current = s;
    tick((x) => x + 1);
  }, []);
  const setStatus = (t: string, ok = true) => setStatusRaw((p) => (p.t === t && p.ok === ok ? p : { t, ok }));

  const flush = useCallback(() => {
    if (timer.current != null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    try {
      const s = ref.current!;
      const html = htmlRef.current();
      const d = s.docs[s.cur];
      const docs = { ...s.docs, [s.cur]: { ...d, e: html ?? d.e, t: Date.now() } };
      persistDocs(docs, s.cur);
      commit({ ...s, docs });
      setStatus('Saved at ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
    } catch {
      setStatus('Not saved: browser storage is unavailable', false);
    }
  }, [commit]);

  const markDirty = useCallback(() => {
    setStatus('Saving…');
    if (timer.current != null) clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 600);
  }, [flush]);

  useEffect(() => {
    const onHide = () => { if (timer.current != null) flush(); };
    const onVis = () => { if (document.hidden) onHide(); };
    addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [flush]);

  const S = ref.current;
  const patchDoc = (id: string, p: Partial<Doc>) => commit({ ...ref.current!, docs: { ...ref.current!.docs, [id]: { ...ref.current!.docs[id], ...p } } });

  const api = {
    flush,
    markDirty,
    status,
    setStatus,
    docs: S.docs,
    folders: S.folders,
    cur: S.cur,
    doc: S.docs[S.cur],

    setName(name: string) {
      patchDoc(ref.current!.cur, { name: name || 'Untitled' });
      markDirty();
    },
    /** Updates the current document's shapes and strokes. */
    setScene(fn: (s: Scene) => Scene) {
      const s = ref.current!, d = s.docs[s.cur];
      const n = fn({ shapes: d.shapes, strokes: d.strokes });
      commit({ ...s, docs: { ...s.docs, [s.cur]: { ...d, shapes: n.shapes, strokes: n.strokes } } });
      markDirty();
    },
    scene: (): Scene => {
      const d = ref.current!.docs[ref.current!.cur];
      return { shapes: d.shapes, strokes: d.strokes };
    },
    openDoc(id: string) {
      flush();
      const s = ref.current!;
      if (!s.docs[id]) return;
      persistDocs(s.docs, id);
      commit({ ...s, cur: id });
    },
    newDoc(f = '') {
      flush();
      const s = ref.current!, id = uid();
      const docs = { ...s.docs, [id]: blankDoc('Untitled ' + (Object.keys(s.docs).length + 1), f) };
      persistDocs(docs, id);
      commit({ ...s, docs, cur: id });
    },
    deleteDoc(id: string) {
      flush();
      const s = ref.current!, docs = { ...s.docs };
      delete docs[id];
      if (!Object.keys(docs).length) docs.d0 = blankDoc('Untitled 1');
      const cur = id === s.cur || !docs[s.cur] ? Object.keys(docs)[0] : s.cur;
      persistDocs(docs, cur);
      commit({ ...s, docs, cur });
    },
    moveDoc(id: string, f: string) {
      flush();
      patchDoc(id, { f });
      persistDocs(ref.current!.docs, ref.current!.cur);
    },

    setFolders(fn: (f: Folders) => Folders) {
      const s = ref.current!, folders = fn(s.folders);
      persistFolders(folders);
      commit({ ...s, folders });
    },
    newFolder(p = ''): string {
      const id = fid();
      api.setFolders((f) => ({ ...f, [id]: { n: 'Folder ' + (Object.keys(f).length + 1), p } }));
      return id;
    },
    deleteFolder(id: string) {
      flush();
      const s = ref.current!, par = s.folders[id]?.p && s.folders[s.folders[id].p] ? s.folders[id].p : '';
      const folders = { ...s.folders };
      Object.keys(folders).forEach((k) => { if (folders[k].p === id) folders[k] = { ...folders[k], p: par }; });
      delete folders[id];
      const docs = { ...ref.current!.docs };
      Object.keys(docs).forEach((k) => { if (docs[k].f === id) docs[k] = { ...docs[k], f: par }; });
      persistFolders(folders);
      persistDocs(docs, s.cur);
      commit({ ...ref.current!, docs, folders });
    },

    mergeImport(r: ImportResult) {
      flush();
      const s = ref.current!;
      const docs = { ...s.docs, ...r.docs }, folders = { ...s.folders, ...r.folders };
      const cur = r.last ?? s.cur;
      persistFolders(folders);
      persistDocs(docs, cur);
      commit({ docs, folders, cur });
    },
    /** A snapshot for the JSON backup, with the editor's latest HTML included. */
    snapshot() {
      flush();
      return { docs: ref.current!.docs, folders: ref.current!.folders };
    },
  };
  return api;
}
