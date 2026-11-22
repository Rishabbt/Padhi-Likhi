# Draftboard (React + TypeScript + Vite)

A document editor with a drawing layer: rich text, tables, shapes, arrows, a pen that snaps
strokes into clean shapes, folders, and PDF/HTML/text/JSON export. Data stays in your browser's
`localStorage`.

## Run

    npm install
    npm run dev        # http://localhost:5173
    npm run build      # typecheck + production build into dist/

## Layout

    src/
      App.tsx                 wires state, shortcuts, menus and export together
      types.ts                Shape / Stroke / Doc models
      hooks/useDocStore.ts    documents, folders, debounced autosave
      components/
        TopBar, Toolbar, Sidebar, Popover, Menus
        Page.tsx              contentEditable editor (browser-owned) + layers
        Layer.tsx             shapes, arrows, drag/resize, pen, eraser
        TableBar.tsx          floating table tools and drag-to-move
      lib/
        geometry.ts           shape recognizer, arrow geometry
        pdf.ts                dependency-free PDF writer
        legacy.ts             reads the original single-file format; sanitizes imports
        layerHtml.ts          static markup for exported pages
        exportImport.ts       HTML / TXT / JSON export and import
        storage.ts, editor.ts, boxes.ts, colors.ts

## Responsive layout

- The page keeps its real Letter size and is scaled to fit narrow screens (Zoom menu: Fit, 50% to 150%).
- Under 900px wide the bottom bar splits into Text / Insert / Draw / Shape tabs; sideways phones get one row.
- All sizes and breakpoints live in the responsive block of `src/styles.css`.

## Offline / install

Draftboard is a PWA: after one visit it caches itself and works with no network (editing, shapes, PDF
import and export). In Chrome or Edge use the install icon in the address bar. Service workers need https
or localhost. Documents live in the browser's storage, so export a JSON backup now and then.

## Pages

The editor is paginated like Google Docs: US Letter sheets (816 x 1056 px) with 1-inch margins and a gray
gap between them. Text flows line by line around each page break, and the PDF export uses the same layout.
Page size and margins live in `src/lib/pageGeometry.ts` and the `--ph`, `--gap` and `--m` variables in
`src/styles.css` (keep them in sync).

## Notes

- Shapes and strokes are now typed React state (not DOM markup). Documents saved by the original
  single-file Draftboard, and its exported `.html` / `.json` files, are migrated on load/import.
- The migration is one-way: after opening in this version, the older single-file build can't read
  the newly saved documents.
- The text editor still uses `document.execCommand`, as before. It is deprecated but universally
  supported; replacing it (for example with TipTap or Lexical) is the natural next step.
