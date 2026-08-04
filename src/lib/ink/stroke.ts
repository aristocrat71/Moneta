// Outline generation: raw pressure points → perfect-freehand polygon → Path2D.
// Stored points stay raw; outlines are always derived at render time so the
// smoothing can improve later without corrupting old ink.

import { getStroke } from 'perfect-freehand';
import type { DrawTool, InkTuning } from './types';

export interface OutlineOptions {
  width: number;
  tool: DrawTool;
  tuning: InkTuning;
  /** False while the stroke is still wet (keeps the live end taper open). */
  last?: boolean;
}

function applyGamma(p: number, gamma: number): number {
  if (gamma === 1) return p;
  return Math.pow(p, gamma);
}

/**
 * Build the outline polygon for a stroke. `points` is a flat [x, y, p] array;
 * `count` is the number of triples to use (lets the wet path pass a typed
 * array head without slicing).
 */
export function strokeOutline(
  points: ArrayLike<number>,
  count: number,
  opts: OutlineOptions,
): number[][] {
  const { tuning } = opts;
  const input: [number, number, number][] = [];
  let pressured = false;
  for (let i = 0; i < count; i++) {
    const x = points[i * 3];
    const y = points[i * 3 + 1];
    const p = points[i * 3 + 2] || 0.5;
    if (Math.abs(p - 0.5) > 0.004) pressured = true;
    input.push([x, y, applyGamma(p, tuning.pressureGamma)]);
  }
  const highlighter = opts.tool === 'highlighter';
  // Shapes are exact geometry: constant width, no smoothing or streamline.
  const shape = opts.tool === 'shape';
  return getStroke(input, {
    size: opts.width,
    thinning: highlighter || shape ? 0 : tuning.thinning,
    smoothing: shape ? 0 : tuning.smoothing,
    streamline: shape ? 0 : highlighter ? 0.4 : tuning.streamline,
    // Mouse input reports a constant 0.5 — simulate pressure from speed there.
    simulatePressure: !pressured && !highlighter && !shape,
    last: opts.last ?? true,
  });
}

/** Closed smooth path through the outline (quadratics between midpoints). */
export function outlineToPath(outline: number[][]): Path2D {
  const path = new Path2D();
  const n = outline.length;
  if (n === 0) return path;
  if (n < 3) {
    const [x, y] = outline[0];
    path.arc(x, y, 0.5, 0, Math.PI * 2);
    return path;
  }
  path.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < n; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % n];
    path.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  }
  path.closePath();
  return path;
}

/** SVG path data for the same outline — used by SVG/PDF export. */
export function outlineToSvgPath(outline: number[][]): string {
  const n = outline.length;
  if (n === 0) return '';
  if (n < 3) {
    const [x, y] = outline[0];
    return `M ${x - 0.5} ${y} a 0.5 0.5 0 1 0 1 0 a 0.5 0.5 0 1 0 -1 0 Z`;
  }
  const parts: string[] = [`M ${round2(outline[0][0])} ${round2(outline[0][1])}`];
  for (let i = 1; i < n; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % n];
    parts.push(
      `Q ${round2(a[0])} ${round2(a[1])} ${round2((a[0] + b[0]) / 2)} ${round2((a[1] + b[1]) / 2)}`,
    );
  }
  parts.push('Z');
  return parts.join(' ');
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
