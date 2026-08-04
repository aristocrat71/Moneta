// Shape tool geometry: an anchor + drag point become flat [x, y, p] stroke
// points, so committed shapes are ordinary strokes (erase/lasso/export free).

import type { ShapeKind } from './types';

const PRESSURE = 0.5;
/** Sample spacing along edges, page units. perfect-freehand needs dense
 *  points — bare corner vertices collapse its outline along long edges. */
const STEP = 4;

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
      return sampled([ax, ay, bx, by]);
    case 'rect':
      return sampled([ax, ay, bx, ay, bx, by, ax, by, ax, ay]);
    case 'triangle': {
      // Isosceles in the drag rect: apex top-center, base along the bottom.
      const x0 = Math.min(ax, bx);
      const x1 = Math.max(ax, bx);
      const y0 = Math.min(ay, by);
      const y1 = Math.max(ay, by);
      const mid = (x0 + x1) / 2;
      return sampled([mid, y0, x1, y1, x0, y1, mid, y0]);
    }
    case 'ellipse': {
      const cx = (ax + bx) / 2;
      const cy = (ay + by) / 2;
      const rx = Math.abs(bx - ax) / 2;
      const ry = Math.abs(by - ay) / 2;
      // Enough segments for ~4-unit chords, bounded for tiny/huge drags.
      const steps = Math.max(24, Math.min(128, Math.ceil((Math.PI * (rx + ry)) / STEP)));
      const pts: number[] = [];
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * Math.PI * 2;
        pts.push(cx + Math.cos(t) * rx, cy + Math.sin(t) * ry, PRESSURE);
      }
      return pts;
    }
  }
}

/** Sample a [x, y, ...] polyline every ~STEP units, keeping exact vertices. */
function sampled(verts: number[]): number[] {
  const pts: number[] = [];
  let lx = NaN;
  let ly = NaN;
  const push = (x: number, y: number) => {
    if (x === lx && y === ly) return; // zero-size drags collapse vertices
    pts.push(x, y, PRESSURE);
    lx = x;
    ly = y;
  };
  for (let e = 0; e + 3 < verts.length; e += 2) {
    const x0 = verts[e];
    const y0 = verts[e + 1];
    const x1 = verts[e + 2];
    const y1 = verts[e + 3];
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / STEP));
    for (let i = 0; i < steps; i++) {
      push(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
    }
  }
  push(verts[verts.length - 2], verts[verts.length - 1]);
  return pts;
}
