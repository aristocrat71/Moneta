// Eraser and lasso geometry. Pure functions over flat point arrays.

import type { Rect } from './types';

export function distSqPointToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = 0;
  if (lenSq > 0) {
    t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
  }
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return (px - cx) * (px - cx) + (py - cy) * (py - cy);
}

/** Whole-stroke eraser test: does a circle touch any segment of the stroke? */
export function strokeHitsCircle(
  points: number[],
  width: number,
  cx: number,
  cy: number,
  r: number,
): boolean {
  const reach = r + width / 2;
  const reachSq = reach * reach;
  const n = points.length;
  if (n < 3) return false;
  if (n < 6) {
    const dx = points[0] - cx;
    const dy = points[1] - cy;
    return dx * dx + dy * dy <= reachSq;
  }
  for (let i = 0; i + 5 < n; i += 3) {
    if (
      distSqPointToSegment(cx, cy, points[i], points[i + 1], points[i + 3], points[i + 4]) <=
      reachSq
    ) {
      return true;
    }
  }
  return false;
}

/** Ray-casting point-in-polygon over a flat [x, y, ...] polygon. */
export function pointInPolygon(x: number, y: number, poly: number[]): boolean {
  const n = poly.length / 2;
  if (n < 3) return false;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i * 2];
    const yi = poly[i * 2 + 1];
    const xj = poly[j * 2];
    const yj = poly[j * 2 + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function polygonBounds(poly: number[]): Rect {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (let i = 0; i + 1 < poly.length; i += 2) {
    if (poly[i] < minX) minX = poly[i];
    if (poly[i] > maxX) maxX = poly[i];
    if (poly[i + 1] < minY) minY = poly[i + 1];
    if (poly[i + 1] > maxY) maxY = poly[i + 1];
  }
  if (minX > maxX) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function strokeBounds(points: number[], width: number): Rect {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (let i = 0; i + 2 < points.length + 1; i += 3) {
    const x = points[i];
    const y = points[i + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (minX > maxX) return { x: 0, y: 0, w: 0, h: 0 };
  const pad = width;
  return {
    x: minX - pad,
    y: minY - pad,
    w: maxX - minX + pad * 2,
    h: maxY - minY + pad * 2,
  };
}

/** Mark points touched by an eraser circle, per segment so a fast, sparse stroke
 *  can't slip between samples. True when new points were marked. */
export function maskStrokeUnderCircle(
  points: number[],
  mask: Uint8Array,
  cx: number,
  cy: number,
  reach: number,
): boolean {
  const n = Math.floor(points.length / 3);
  const reachSq = reach * reach;
  let changed = false;
  if (n === 1) {
    const dx = points[0] - cx;
    const dy = points[1] - cy;
    if (!mask[0] && dx * dx + dy * dy <= reachSq) {
      mask[0] = 1;
      changed = true;
    }
    return changed;
  }
  for (let i = 0; i + 1 < n; i++) {
    if (mask[i] && mask[i + 1]) continue;
    const d = distSqPointToSegment(
      cx,
      cy,
      points[i * 3],
      points[i * 3 + 1],
      points[(i + 1) * 3],
      points[(i + 1) * 3 + 1],
    );
    if (d <= reachSq) {
      if (!mask[i]) {
        mask[i] = 1;
        changed = true;
      }
      if (!mask[i + 1]) {
        mask[i + 1] = 1;
        changed = true;
      }
    }
  }
  return changed;
}

/** Split into runs of consecutive unmasked points; runs under `minRun` are dropped. */
export function splitPointsByMask(points: number[], mask: Uint8Array, minRun = 2): number[][] {
  const n = Math.floor(points.length / 3);
  const runs: number[][] = [];
  let run: number[] = [];
  for (let i = 0; i < n; i++) {
    if (mask[i]) {
      if (run.length >= minRun * 3) runs.push(run);
      run = [];
      continue;
    }
    run.push(points[i * 3], points[i * 3 + 1], points[i * 3 + 2]);
  }
  if (run.length >= minRun * 3) runs.push(run);
  return runs;
}

/** Clip a run against the eraser disk, cutting segments exactly where they cross
 *  it, so the hole is never larger than the disk. Null when the disk misses. */
export function clipRunAgainstCircle(
  points: number[],
  cx: number,
  cy: number,
  r: number,
): number[][] | null {
  const n = Math.floor(points.length / 3);
  if (n === 0) return null;
  const rSq = r * r;
  if (n === 1) {
    const dx = points[0] - cx;
    const dy = points[1] - cy;
    return dx * dx + dy * dy <= rSq ? [] : null;
  }
  let touches = false;
  for (let i = 0; i + 1 < n; i++) {
    const k = i * 3;
    if (
      distSqPointToSegment(cx, cy, points[k], points[k + 1], points[k + 3], points[k + 4]) <=
      rSq
    ) {
      touches = true;
      break;
    }
  }
  if (!touches) return null;

  const EPS = 1e-4;
  const out: number[][] = [];
  let cur: number[] = [];
  const close = () => {
    // A lone leftover point is debris, not ink.
    if (cur.length >= 6) out.push(cur);
    cur = [];
  };
  const d0x = points[0] - cx;
  const d0y = points[1] - cy;
  if (d0x * d0x + d0y * d0y > rSq) cur.push(points[0], points[1], points[2]);
  for (let i = 0; i + 1 < n; i++) {
    const k = i * 3;
    const ax = points[k];
    const ay = points[k + 1];
    const ap = points[k + 2];
    const bx = points[k + 3];
    const by = points[k + 4];
    const bp = points[k + 5];
    const dx = bx - ax;
    const dy = by - ay;
    const fx = ax - cx;
    const fy = ay - cy;
    const a2 = dx * dx + dy * dy;
    // The sub-interval [u0, u1] of the segment that lies inside the disk.
    let u0 = 1;
    let u1 = 0;
    if (a2 < 1e-12) {
      if (fx * fx + fy * fy <= rSq) {
        u0 = 0;
        u1 = 1;
      }
    } else {
      const b2 = 2 * (fx * dx + fy * dy);
      const c2 = fx * fx + fy * fy - rSq;
      const disc = b2 * b2 - 4 * a2 * c2;
      if (disc >= 0) {
        const sq = Math.sqrt(disc);
        u0 = Math.max(0, (-b2 - sq) / (2 * a2));
        u1 = Math.min(1, (-b2 + sq) / (2 * a2));
      }
    }
    if (u0 > u1) {
      cur.push(bx, by, bp); // fully outside — segment survives
      continue;
    }
    if (u0 > EPS) {
      cur.push(ax + dx * u0, ay + dy * u0, ap + (bp - ap) * u0);
    }
    close();
    if (u1 < 1 - EPS) {
      cur.push(ax + dx * u1, ay + dy * u1, ap + (bp - ap) * u1, bx, by, bp);
    }
  }
  close();
  return out;
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function rectUnion(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.y + a.h, b.y + b.h) - y,
  };
}

export function inflateRect(r: Rect, m: number): Rect {
  return { x: r.x - m, y: r.y - m, w: r.w + m * 2, h: r.h + m * 2 };
}

/** Lasso containment: bounds pre-check, then ≥85% of sampled points inside. */
export function strokeInPolygon(points: number[], poly: number[], polyBox?: Rect): boolean {
  const count = Math.floor(points.length / 3);
  if (count === 0) return false;
  const box = polyBox ?? polygonBounds(poly);
  const sb = strokeBounds(points, 0);
  if (!rectsIntersect(sb, box)) return false;
  const step = count > 60 ? Math.ceil(count / 60) : 1;
  let sampled = 0;
  let inside = 0;
  for (let i = 0; i < count; i += step) {
    sampled++;
    if (pointInPolygon(points[i * 3], points[i * 3 + 1], poly)) inside++;
  }
  return sampled > 0 && inside / sampled >= 0.85;
}
