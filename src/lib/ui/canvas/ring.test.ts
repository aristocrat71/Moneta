import { describe, expect, test } from 'vitest';
import { ringCenter, ringSlots } from './ring';

describe('ringSlots', () => {
  test('runs clockwise from the top', () => {
    expect(ringSlots(4, 10)).toEqual([
      { x: 0, y: -10 },
      { x: 10, y: 0 },
      { x: 0, y: 10 },
      { x: -10, y: 0 },
    ]);
  });

  test('a lone swatch sits straight up', () => {
    expect(ringSlots(1, 52)).toEqual([{ x: 0, y: -52 }]);
  });

  test('every slot stays on the circle', () => {
    for (const slot of ringSlots(12, 84)) {
      expect(Math.hypot(slot.x, slot.y)).toBeCloseTo(84, 1);
    }
  });

  test('an empty ring has no slots', () => {
    expect(ringSlots(0, 84)).toEqual([]);
  });
});

describe('ringCenter', () => {
  test('sits on the pointer when there is room', () => {
    expect(ringCenter({ x: 500, y: 400 }, 104, { w: 1200, h: 800 })).toEqual({
      x: 500,
      y: 400,
    });
  });

  test('slides inward at the edges instead of hanging off', () => {
    expect(ringCenter({ x: 4, y: 4 }, 104, { w: 1200, h: 800 })).toEqual({ x: 112, y: 112 });
    expect(ringCenter({ x: 1196, y: 796 }, 104, { w: 1200, h: 800 })).toEqual({
      x: 1088,
      y: 688,
    });
  });

  test('a window too small to hold the ring centres it', () => {
    expect(ringCenter({ x: 10, y: 10 }, 104, { w: 200, h: 180 })).toEqual({ x: 100, y: 90 });
  });
});
