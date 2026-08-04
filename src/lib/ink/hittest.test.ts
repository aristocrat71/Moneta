import { describe, expect, test } from 'vitest';
import {
  distSqPointToSegment,
  pointInPolygon,
  polygonBounds,
  rectsIntersect,
  rectUnion,
  strokeBounds,
  strokeHitsCircle,
  strokeInPolygon,
} from './hittest';

function line(x0: number, y0: number, x1: number, y1: number, steps = 10): number[] {
  const pts: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 0.5);
  }
  return pts;
}

describe('distSqPointToSegment', () => {
  test('perpendicular distance to the middle of a segment', () => {
    expect(distSqPointToSegment(5, 5, 0, 0, 10, 0)).toBeCloseTo(25);
  });
  test('clamps to endpoints', () => {
    expect(distSqPointToSegment(-3, 4, 0, 0, 10, 0)).toBeCloseTo(25);
    expect(distSqPointToSegment(13, 4, 0, 0, 10, 0)).toBeCloseTo(25);
  });
  test('degenerate segment behaves like a point', () => {
    expect(distSqPointToSegment(3, 4, 0, 0, 0, 0)).toBeCloseTo(25);
  });
});

describe('strokeHitsCircle', () => {
  const stroke = line(0, 0, 100, 0);
  test('hits when the circle touches the path', () => {
    expect(strokeHitsCircle(stroke, 2, 50, 5, 5)).toBe(true);
  });
  test('accounts for stroke width', () => {
    // reach = radius 3 + width/2 = 8, so 7 hits and 9 misses.
    expect(strokeHitsCircle(stroke, 10, 50, 7, 3)).toBe(true);
    expect(strokeHitsCircle(stroke, 10, 50, 9, 3)).toBe(false);
  });
  test('misses when out of reach', () => {
    expect(strokeHitsCircle(stroke, 2, 50, 30, 5)).toBe(false);
  });
  test('single-point stroke (a dot)', () => {
    expect(strokeHitsCircle([10, 10, 0.5], 4, 12, 12, 2)).toBe(true);
    expect(strokeHitsCircle([10, 10, 0.5], 4, 30, 30, 2)).toBe(false);
  });
});

describe('pointInPolygon', () => {
  const square = [0, 0, 10, 0, 10, 10, 0, 10];
  test('inside / outside', () => {
    expect(pointInPolygon(5, 5, square)).toBe(true);
    expect(pointInPolygon(15, 5, square)).toBe(false);
    expect(pointInPolygon(-1, -1, square)).toBe(false);
  });
  test('concave polygon', () => {
    // A "C" shape open to the right.
    const c = [0, 0, 10, 0, 10, 3, 3, 3, 3, 7, 10, 7, 10, 10, 0, 10];
    expect(pointInPolygon(1, 5, c)).toBe(true);
    expect(pointInPolygon(7, 5, c)).toBe(false);
  });
});

describe('strokeInPolygon', () => {
  const big = [0, 0, 200, 0, 200, 200, 0, 200];
  test('selects a contained stroke', () => {
    expect(strokeInPolygon(line(20, 20, 80, 80), big)).toBe(true);
  });
  test('rejects a stroke mostly outside', () => {
    expect(strokeInPolygon(line(150, 150, 500, 500), big)).toBe(false);
  });
  test('rejects a fully external stroke via bounds pre-check', () => {
    expect(strokeInPolygon(line(300, 300, 400, 400), big)).toBe(false);
  });
});

describe('rect helpers', () => {
  test('strokeBounds pads by width', () => {
    const b = strokeBounds(line(10, 20, 30, 40), 3);
    expect(b.x).toBeCloseTo(7);
    expect(b.y).toBeCloseTo(17);
    expect(b.w).toBeCloseTo(26);
    expect(b.h).toBeCloseTo(26);
  });
  test('union and intersection', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    const b = { x: 5, y: 5, w: 10, h: 10 };
    const u = rectUnion(a, b);
    expect(u).toEqual({ x: 0, y: 0, w: 15, h: 15 });
    expect(rectsIntersect(a, b)).toBe(true);
    expect(rectsIntersect(a, { x: 20, y: 20, w: 5, h: 5 })).toBe(false);
  });
  test('polygonBounds', () => {
    expect(polygonBounds([0, 0, 4, 0, 4, 6])).toEqual({ x: 0, y: 0, w: 4, h: 6 });
  });
});
