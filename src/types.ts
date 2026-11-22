export type BoxKind = 'rect' | 'round' | 'ellipse' | 'diamond' | 'triangle' | 'text';
export type Head = 'end' | 'start' | 'both' | 'none';

export interface BoxShape {
  type: 'box';
  id: string;
  kind: BoxKind;
  x: number;
  y: number;
  w: number;
  h: number;
  /** CSS color, or 'transparent' */
  fill: string;
  /** two-stop gradient; overrides `fill` when present */
  grad?: [string, string];
  label: string;
  labelColor?: string;
}

export interface LineShape {
  type: 'line';
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** quadratic control point; absent means a straight line */
  cx?: number;
  cy?: number;
  w: number;
  head: Head;
  dash: boolean;
  color: string;
}

export type Shape = BoxShape | LineShape;

export interface Stroke {
  id: string;
  d: string;
  color: string;
  width: number;
}

export interface Doc {
  name: string;
  /** editor HTML */
  e: string;
  shapes: Shape[];
  strokes: Stroke[];
  t: number;
  /** folder id, '' for none */
  f: string;
}

export interface Folder {
  n: string;
  p: string;
}

export type Docs = Record<string, Doc>;
export type Folders = Record<string, Folder>;
export type Pt = [number, number];
