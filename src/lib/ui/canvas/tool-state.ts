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

// Shapes and the lasso borrow the pen's ink.

export function drawToolOf(tools: ToolState): 'pen' | 'highlighter' {
  return tools.tool === 'highlighter' ? 'highlighter' : 'pen';
}

export function colorOf(tools: ToolState): string {
  return drawToolOf(tools) === 'highlighter' ? tools.hlColor : tools.penColor;
}

export function setColorOn(tools: ToolState, color: string): void {
  if (drawToolOf(tools) === 'highlighter') tools.hlColor = color;
  else tools.penColor = color;
}

export function widthOf(tools: ToolState): number {
  if (tools.tool === 'eraser') return tools.eraserRadius;
  return drawToolOf(tools) === 'highlighter' ? tools.hlWidth : tools.penWidth;
}

export function setWidthOn(tools: ToolState, width: number): void {
  if (tools.tool === 'eraser') tools.eraserRadius = width;
  else if (drawToolOf(tools) === 'highlighter') tools.hlWidth = width;
  else tools.penWidth = width;
}

export function presetsOf(tools: ToolState): number[] {
  if (tools.tool === 'eraser') return ERASER_PRESETS;
  return drawToolOf(tools) === 'highlighter' ? HL_PRESETS : PEN_PRESETS;
}
