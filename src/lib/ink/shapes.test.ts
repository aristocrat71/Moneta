import { describe, expect, test } from 'vitest';
import { shapePoints } from './shapes';

function triples(pts: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i + 2 < pts.length; i += 3) out.push([pts[i], pts[i + 1]]);
  return out;
}

function hasVertex(pts: number[], x: number, y: number): boolean {
  return triples(pts).some(([px, py]) => px === x && py === y);
}

/** Every consecutive pair must be ≤ step apart — sparse input deforms the
 *  perfect-freehand outline. */
function maxSpacing(pts: number[]): number {
  const p = triples(pts);
  let max = 0;
  for (let i = 1; i < p.length; i++) {
    max = Math.max(max, Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
  }
  return max;
}

describe('shapePoints', () => {
  test('line keeps exact endpoints and samples densely', () => {
    const pts = shapePoints('line', 10, 20, 110, 40);
    expect(pts.slice(0, 2)).toEqual([10, 20]);
    expect(pts.slice(-3, -1)).toEqual([110, 40]);
    expect(maxSpacing(pts)).toBeLessThanOrEqual(4.01);
    // collinear: every point on the segment
    for (const [x, y] of triples(pts)) {
      expect((x - 10) * 20 - (y - 20) * 100).toBeCloseTo(0);
    }
  });

  test('rect keeps all four corners, closes, and stays on the perimeter', () => {
    const pts = shapePoints('rect', 10, 20, 50, 60);
    for (const [x, y] of [
      [10, 20],
      [50, 20],
      [50, 60],
      [10, 60],
    ]) {
      expect(hasVertex(pts, x, y)).toBe(true);
    }
    expect(pts.slice(0, 2)).toEqual([10, 20]);
    expect(pts.slice(-3, -1)).toEqual([10, 20]);
    expect(maxSpacing(pts)).toBeLessThanOrEqual(4.01);
    for (const [x, y] of triples(pts)) {
      const onEdge = x === 10 || x === 50 || y === 20 || y === 60;
      expect(onEdge).toBe(true);
      expect(x).toBeGreaterThanOrEqual(10);
      expect(x).toBeLessThanOrEqual(50);
      expect(y).toBeGreaterThanOrEqual(20);
      expect(y).toBeLessThanOrEqual(60);
    }
  });

  test('triangle: apex top-center, base at the bottom, any drag direction', () => {
    for (const [ax, ay, bx, by] of [
      [0, 0, 100, 50],
      [100, 50, 0, 0],
    ]) {
      const pts = shapePoints('triangle', ax, ay, bx, by);
      expect(hasVertex(pts, 50, 0)).toBe(true);
      expect(hasVertex(pts, 100, 50)).toBe(true);
      expect(hasVertex(pts, 0, 50)).toBe(true);
      expect(pts.slice(0, 2)).toEqual([50, 0]);
      expect(pts.slice(-3, -1)).toEqual([50, 0]);
      expect(maxSpacing(pts)).toBeLessThanOrEqual(4.01);
      // The base edge must be densely covered, not a single long segment.
      const base = triples(pts).filter(([, y]) => y === 50);
      expect(base.length).toBeGreaterThan(20);
    }
  });

  test('degenerate drag collapses to a single point, not duplicates', () => {
    const pts = shapePoints('rect', 30, 30, 30, 30);
    expect(pts).toEqual([30, 30, 0.5]);
  });

  test('ellipse points lie on the ellipse of the drag rect', () => {
    const pts = shapePoints('ellipse', 0, 0, 200, 100);
    expect(pts.length / 3).toBeGreaterThanOrEqual(25);
    for (const [x, y] of triples(pts)) {
      const nx = (x - 100) / 100;
      const ny = (y - 50) / 50;
      expect(nx * nx + ny * ny).toBeCloseTo(1);
    }
    // closed: first and last coincide
    expect(pts[0]).toBeCloseTo(pts[pts.length - 3]);
    expect(pts[1]).toBeCloseTo(pts[pts.length - 2]);
  });
});
