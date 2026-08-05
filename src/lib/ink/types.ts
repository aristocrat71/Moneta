// Framework-free types spoken by the ink engine. This module (and everything
// in lib/ink) must never import Svelte, Tauri, or lib/doc.

export type DrawTool = 'pen' | 'highlighter' | 'shape';
export type ToolKind = 'pen' | 'highlighter' | 'shape' | 'eraser' | 'lasso';
export type ShapeKind = 'line' | 'rect' | 'ellipse' | 'triangle';
export type TemplateKind = 'blank' | 'ruled' | 'grid' | 'dotted';

export interface StrokeData {
  id: string;
  tool: DrawTool;
  /** Semantic ink id ("ink/black") or a literal "#RRGGBB". */
  color: string;
  /** Base width in page units. */
  width: number;
  /** Flat [x, y, pressure, ...] triples in page units — raw input, pre-smoothing. */
  points: number[];
}

export interface PageSize {
  w: number;
  h: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Affine transform: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export interface Mat {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

/** Resolved paint colors for the current theme, passed in by the shell. */
export interface ThemePaint {
  dark: boolean;
  canvas: string;
  templateLine: string;
  accent: string;
  /** How solid the paper is: 1 = normal page, 0 = ink floating on nothing.
   *  Only the page fill and its template fade — ink always paints at full
   *  strength. Omitted means 1, so thumbnails and exports are never see-through. */
  paperAlpha?: number;
}

export interface StrokeStyle {
  color: string;
  width: number;
}

/** A partial-erase edit: one original stroke replaced by its surviving runs
 *  (empty when the whole stroke was erased). */
export interface StrokeEdit {
  before: StrokeData;
  after: StrokeData[];
}

/** Tunable feel constants — surfaced in the ?dev panel. */
export interface InkTuning {
  pressureGamma: number;
  thinning: number;
  smoothing: number;
  streamline: number;
}

export const DEFAULT_TUNING: InkTuning = {
  pressureGamma: 1,
  thinning: 0.55,
  smoothing: 0.5,
  streamline: 0.35,
};

/** A page's rasterized region + scale (device px per page unit). */
export interface PageWindow {
  rect: Rect;
  scale: number;
}
