// Where the pointer-side colour ring puts its swatches — pure math, no DOM.

export interface RingPoint {
  x: number;
  y: number;
}

/** Radii in CSS pixels: `hole` is the clear disc at the nib, `reach` the band's outer edge. */
export const RING = {
  outerRadius: 84,
  outerDot: 26,
  innerRadius: 52,
  innerDot: 18,
  hole: 36,
  reach: 104,
} as const;

function round(v: number): number {
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) ? 0 : r;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** `count` points spread evenly clockwise from the top, so the first is always straight up. */
export function ringSlots(count: number, radius: number): RingPoint[] {
  const slots: RingPoint[] = [];
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count;
    slots.push({ x: round(Math.cos(angle) * radius), y: round(Math.sin(angle) * radius) });
  }
  return slots;
}

/** Slides the ring inward at a window edge; a window too small to hold it gets it centred. */
export function ringCenter(
  at: RingPoint,
  reach: number,
  view: { w: number; h: number },
  edge = 8,
): RingPoint {
  const span = reach + edge;
  return {
    x: view.w >= span * 2 ? clamp(at.x, span, view.w - span) : view.w / 2,
    y: view.h >= span * 2 ? clamp(at.y, span, view.h - span) : view.h / 2,
  };
}
