// Shape tool geometry: an anchor + drag point become flat [x, y, p] stroke
// points, so committed shapes are ordinary strokes (erase/lasso/export free).

import type { ShapeKind } from './types';

const PRESSURE = 0.5;

/** Stroke points for a shape dragged from (ax, ay) to (bx, by), page units. */
export function shapePoints(
  kind: ShapeKind,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number[] {
  switch (kind) {
    case 'line':
      return [ax, ay, PRESSURE, bx, by, PRESSURE];
    case 'rect':
      return closed([ax, ay, bx, ay, bx, by, ax, by]);
    case 'triangle': {
      // Isosceles in the drag rect: apex top-center, base along the bottom.
      const x0 = Math.min(ax, bx);
      const x1 = Math.max(ax, bx);
      const y0 = Math.min(ay, by);
      const y1 = Math.max(ay, by);
      return closed([(x0 + x1) / 2, y0, x1, y1, x0, y1]);
    }
    case 'ellipse': {
      const cx = (ax + bx) / 2;
      const cy = (ay + by) / 2;
      const rx = Math.abs(bx - ax) / 2;
      const ry = Math.abs(by - ay) / 2;
      // Enough segments for ~4-unit chords, bounded for tiny/huge drags.
      const steps = Math.max(24, Math.min(128, Math.ceil((Math.PI * (rx + ry)) / 4)));
      const pts: number[] = [];
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * Math.PI * 2;
        pts.push(cx + Math.cos(t) * rx, cy + Math.sin(t) * ry, PRESSURE);
      }
      return pts;
    }
  }
}

/** [x, y, ...] vertices → [x, y, p] triples, looped back to the start. */
function closed(verts: number[]): number[] {
  const pts: number[] = [];
  for (let i = 0; i + 1 < verts.length; i += 2) pts.push(verts[i], verts[i + 1], PRESSURE);
  pts.push(verts[0], verts[1], PRESSURE);
  return pts;
}
