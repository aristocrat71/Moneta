import type { ToolKind } from '$lib/ink/engine';

/** Reactive tool state shared between the canvas page and the island. */
export interface ToolState {
  tool: ToolKind;
  penColor: string;
  penWidth: number;
  hlColor: string;
  hlWidth: number;
}

export const PEN_PRESETS = [2, 3.5, 6];
export const HL_PRESETS = [10, 16, 24];
