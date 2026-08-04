import { describe, expect, test } from 'vitest';
import { shapePoints } from './shapes';

describe('shapePoints', () => {
  test('line is two endpoints', () => {
    expect(shapePoints('line', 10, 20, 110, 40)).toEqual([10, 20, 0.5, 110, 40, 0.5]);
  });

  test('rect closes back to the anchor corner', () => {
    const pts = shapePoints('rect', 10, 20, 50, 60);
    expect(pts.length).toBe(5 * 3);
    expect(pts.slice(0, 2)).toEqual([10, 20]);
    expect(pts.slice(3, 5)).toEqual([50, 20]);
    expect(pts.slice(6, 8)).toEqual([50, 60]);
    expect(pts.slice(9, 11)).toEqual([10, 60]);
    expect(pts.slice(12, 14)).toEqual([10, 20]);
  });

  test('triangle: apex top-center, base at the bottom, any drag direction', () => {
    for (const [ax, ay, bx, by] of [
      [0, 0, 100, 50],
      [100, 50, 0, 0],
    ]) {
      const pts = shapePoints('triangle', ax, ay, bx, by);
      expect(pts.length).toBe(4 * 3);
      expect(pts.slice(0, 2)).toEqual([50, 0]);
      expect(pts.slice(3, 5)).toEqual([100, 50]);
      expect(pts.slice(6, 8)).toEqual([0, 50]);
      expect(pts.slice(9, 11)).toEqual([50, 0]);
    }
  });

  test('ellipse points lie on the ellipse of the drag rect', () => {
    const pts = shapePoints('ellipse', 0, 0, 200, 100);
    expect(pts.length / 3).toBeGreaterThanOrEqual(25);
    for (let i = 0; i + 2 < pts.length; i += 3) {
      const nx = (pts[i] - 100) / 100;
      const ny = (pts[i + 1] - 50) / 50;
      expect(nx * nx + ny * ny).toBeCloseTo(1);
    }
    // closed: first and last coincide
    expect(pts[0]).toBeCloseTo(pts[pts.length - 3]);
    expect(pts[1]).toBeCloseTo(pts[pts.length - 2]);
  });
});
