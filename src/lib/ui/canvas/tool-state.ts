import type { ShapeKind, ToolKind } from '$lib/ink/engine';

/** Reactive tool state shared between the canvas page and the island. */
export interface ToolState {
  tool: ToolKind;
  shape: ShapeKind;
  penColor: string;
  penWidth: number;
  hlColor: string;
  hlWidth: number;
  /** Eraser radius in page units. */
  eraserRadius: number;
}

export const PEN_PRESETS = [2, 3.5, 6];
export const HL_PRESETS = [10, 16, 24];
export const ERASER_PRESETS = [8, 14, 28];
export const ERASER_MIN = 4;
export const ERASER_MAX = 60;
