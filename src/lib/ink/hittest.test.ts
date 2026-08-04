import { describe, expect, test } from 'vitest';
import {
  distSqPointToSegment,
  maskStrokeUnderCircle,
  pointInPolygon,
  polygonBounds,
  rectsIntersect,
  rectUnion,
  splitPointsByMask,
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

describe('partial-erase masking', () => {
  test('masks the points under the eraser circle', () => {
    const stroke = line(0, 0, 100, 0, 10); // points every 10 units
    const mask = new Uint8Array(11);
    const changed = maskStrokeUnderCircle(stroke, mask, 50, 0, 12);
    expect(changed).toBe(true);
    // Segments 30–40 … 60–70 come within reach 12 of x=50 → endpoints 30..70.
    expect(Array.from(mask)).toEqual([0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0]);
    // A second identical pass marks nothing new.
    expect(maskStrokeUnderCircle(stroke, mask, 50, 0, 12)).toBe(false);
  });

  test('catches a crossing between sparse points (segment test)', () => {
    // Two points 100 apart; eraser sits on the middle of the segment.
    const stroke = [0, 0, 0.5, 100, 0, 0.5];
    const mask = new Uint8Array(2);
    expect(maskStrokeUnderCircle(stroke, mask, 50, 5, 8)).toBe(true);
    expect(Array.from(mask)).toEqual([1, 1]);
  });

  test('splitPointsByMask keeps surviving runs and drops debris', () => {
    const stroke = line(0, 0, 100, 0, 10);
    const mask = new Uint8Array(11);
    mask[4] = 1;
    mask[5] = 1;
    const runs = splitPointsByMask(stroke, mask);
    expect(runs).toHaveLength(2);
    expect(runs[0].length).toBe(4 * 3); // points 0..3
    expect(runs[1].length).toBe(5 * 3); // points 6..10
    expect(runs[1][0]).toBeCloseTo(60);
  });

  test('a fully masked stroke yields no runs; a lone survivor is dropped', () => {
    const stroke = line(0, 0, 20, 0, 2); // 3 points
    const all = new Uint8Array([1, 1, 1]);
    expect(splitPointsByMask(stroke, all)).toHaveLength(0);
    const lone = new Uint8Array([1, 0, 1]);
    expect(splitPointsByMask(stroke, lone)).toHaveLength(0);
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
