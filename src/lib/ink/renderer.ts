// Dry-layer page rendering. Each visible page owns a PageRenderer; the canvas
// backing store covers a "window" of the page (the whole page when it fits
// under MAX_BACKING device px, otherwise the visible slice at high zoom).

import { resolveInk } from './palette';
import { strokeOutline, outlineToPath } from './stroke';
import { rectsIntersect, strokeBounds } from './hittest';
import type { InkTuning, PageSize, Rect, StrokeData, TemplateKind, ThemePaint } from './types';

/** Max backing-store dimension per canvas, in device px. */
export const MAX_BACKING = 4096;

export const HIGHLIGHT_ALPHA_LIGHT = 0.45;
export const HIGHLIGHT_ALPHA_DARK = 0.35;

const TEMPLATE_STEP = 44; // page units ≈ 7.5mm at 150dpi
const RULED_TOP = 128;
const RULED_BOTTOM = 64;
const RULED_INSET = 48;

// Stroke bounds cached against the identity of the points array — a transform
// command replaces the array, invalidating the cache automatically.
const boundsCache = new WeakMap<number[], { width: number; rect: Rect }>();

export function cachedStrokeBounds(stroke: StrokeData): Rect {
  const hit = boundsCache.get(stroke.points);
  if (hit && hit.width === stroke.width) return hit.rect;
  const rect = strokeBounds(stroke.points, stroke.width);
  boundsCache.set(stroke.points, { width: stroke.width, rect });
  return rect;
}

export interface PaintPageArgs {
  strokes: StrokeData[];
  template: TemplateKind;
  size: PageSize;
  paint: ThemePaint;
  tuning: InkTuning;
  /** Page-unit rect rasterized by this canvas. */
  win: Rect;
  /** Device px per page unit. */
  scale: number;
  hidden?: ReadonlySet<string> | null;
  /** Page-unit rect to redraw; full window when omitted. */
  dirty?: Rect;
  pathFor?: (stroke: StrokeData) => Path2D;
}

export function applyStrokeStyle(
  ctx: CanvasRenderingContext2D,
  stroke: StrokeData,
  paint: ThemePaint,
): void {
  ctx.fillStyle = resolveInk(stroke.color, paint.dark);
  if (stroke.tool === 'highlighter') {
    // Multiply reads as marker on paper; on slate it would vanish, so dark
    // pages use screen at a slightly lower alpha instead.
    ctx.globalAlpha = paint.dark ? HIGHLIGHT_ALPHA_DARK : HIGHLIGHT_ALPHA_LIGHT;
    ctx.globalCompositeOperation = paint.dark ? 'screen' : 'multiply';
  } else {
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

function resetStrokeStyle(ctx: CanvasRenderingContext2D): void {
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function drawTemplate(ctx: CanvasRenderingContext2D, args: PaintPageArgs): void {
  const { template, size, paint, win, scale } = args;
  if (template === 'blank') return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.strokeStyle = paint.templateLine;
  ctx.fillStyle = paint.templateLine;
  ctx.lineWidth = 1;

  const dx = (x: number) => (x - win.x) * scale;
  const dy = (y: number) => (y - win.y) * scale;

  if (template === 'ruled') {
    ctx.beginPath();
    for (let y = RULED_TOP; y <= size.h - RULED_BOTTOM; y += TEMPLATE_STEP) {
      const py = Math.round(dy(y)) + 0.5;
      ctx.moveTo(dx(RULED_INSET), py);
      ctx.lineTo(dx(size.w - RULED_INSET), py);
    }
    ctx.stroke();
  } else if (template === 'grid') {
    ctx.beginPath();
    for (let y = TEMPLATE_STEP; y < size.h; y += TEMPLATE_STEP) {
      const py = Math.round(dy(y)) + 0.5;
      ctx.moveTo(dx(0), py);
      ctx.lineTo(dx(size.w), py);
    }
    for (let x = TEMPLATE_STEP; x < size.w; x += TEMPLATE_STEP) {
      const px = Math.round(dx(x)) + 0.5;
      ctx.moveTo(px, dy(0));
      ctx.lineTo(px, dy(size.h));
    }
    ctx.stroke();
  } else if (template === 'dotted') {
    const r = Math.max(1, scale * 1.1);
    // Only draw dots that can land on this canvas window.
    const x0 = Math.max(TEMPLATE_STEP, Math.floor(win.x / TEMPLATE_STEP) * TEMPLATE_STEP);
    const y0 = Math.max(TEMPLATE_STEP, Math.floor(win.y / TEMPLATE_STEP) * TEMPLATE_STEP);
    const x1 = Math.min(size.w - 1, win.x + win.w + TEMPLATE_STEP);
    const y1 = Math.min(size.h - 1, win.y + win.h + TEMPLATE_STEP);
    ctx.beginPath();
    for (let y = y0; y <= y1; y += TEMPLATE_STEP) {
      for (let x = x0; x <= x1; x += TEMPLATE_STEP) {
        ctx.moveTo(dx(x) + r, dy(y));
        ctx.arc(dx(x), dy(y), r, 0, Math.PI * 2);
      }
    }
    ctx.fill();
  }
}

/** Paint (a window of) a page into a 2D context. Shared by the dry layer,
 *  thumbnails, and PNG export. */
export function paintPage(ctx: CanvasRenderingContext2D, args: PaintPageArgs): void {
  const { strokes, paint, tuning, win, scale, hidden, dirty } = args;
  const makePath =
    args.pathFor ??
    ((s: StrokeData) =>
      outlineToPath(
        strokeOutline(s.points, Math.floor(s.points.length / 3), {
          width: s.width,
          tool: s.tool,
          tuning,
        }),
      ));

  ctx.save();
  const region = dirty ?? win;
  const clip = dirty != null;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (clip) {
    const rx = Math.floor((region.x - win.x) * scale) - 1;
    const ry = Math.floor((region.y - win.y) * scale) - 1;
    const rw = Math.ceil(region.w * scale) + 2;
    const rh = Math.ceil(region.h * scale) + 2;
    ctx.beginPath();
    ctx.rect(rx, ry, rw, rh);
    ctx.clip();
    ctx.clearRect(rx, ry, rw, rh);
  } else {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }
  // Paper and template fade together; at 0 the cleared canvas is left alone
  // and whatever is behind the window shows through.
  const paperAlpha = paint.paperAlpha ?? 1;
  if (paperAlpha > 0) {
    ctx.globalAlpha = paperAlpha;
    ctx.fillStyle = paint.canvas;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    drawTemplate(ctx, args);
    ctx.globalAlpha = 1;
  }

  ctx.setTransform(scale, 0, 0, scale, -win.x * scale, -win.y * scale);
  for (const stroke of strokes) {
    if (hidden?.has(stroke.id)) continue;
    if (clip && !rectsIntersect(cachedStrokeBounds(stroke), region)) continue;
    if (!clip && !rectsIntersect(cachedStrokeBounds(stroke), win)) continue;
    applyStrokeStyle(ctx, stroke, paint);
    ctx.fill(makePath(stroke));
  }
  resetStrokeStyle(ctx);
  ctx.restore();
}

interface PathCacheEntry {
  points: number[];
  width: number;
  path: Path2D;
}

export class PageRenderer {
  private cache = new Map<string, PathCacheEntry>();
  private win: Rect;
  private scale = 0;

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly size: PageSize,
    public template: TemplateKind,
    private tuning: InkTuning,
  ) {
    this.win = { x: 0, y: 0, w: size.w, h: size.h };
  }

  get window(): Rect {
    return this.win;
  }

  get pxScale(): number {
    return this.scale;
  }

  setTuning(tuning: InkTuning): void {
    this.tuning = tuning;
    this.cache.clear();
  }

  /** Returns true when the backing store was resized (contents lost). */
  setWindow(win: Rect, scale: number): boolean {
    const w = Math.max(1, Math.round(win.w * scale));
    const h = Math.max(1, Math.round(win.h * scale));
    const changed =
      this.canvas.width !== w ||
      this.canvas.height !== h ||
      this.win.x !== win.x ||
      this.win.y !== win.y ||
      this.scale !== scale;
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
    this.win = { ...win };
    this.scale = scale;
    return changed;
  }

  pathFor = (stroke: StrokeData): Path2D => {
    const hit = this.cache.get(stroke.id);
    if (hit && hit.points === stroke.points && hit.width === stroke.width) {
      return hit.path;
    }
    const path = outlineToPath(
      strokeOutline(stroke.points, Math.floor(stroke.points.length / 3), {
        width: stroke.width,
        tool: stroke.tool,
        tuning: this.tuning,
      }),
    );
    this.cache.set(stroke.id, { points: stroke.points, width: stroke.width, path });
    return path;
  };

  render(
    strokes: StrokeData[],
    paint: ThemePaint,
    opts?: { hidden?: ReadonlySet<string> | null; dirty?: Rect },
  ): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx || this.scale <= 0) return;
    paintPage(ctx, {
      strokes,
      template: this.template,
      size: this.size,
      paint,
      tuning: this.tuning,
      win: this.win,
      scale: this.scale,
      hidden: opts?.hidden,
      dirty: opts?.dirty,
      pathFor: this.pathFor,
    });
    this.gcCache(strokes);
  }

  /** Draw one committed stroke on top of the existing raster (no clear). */
  bake(stroke: StrokeData, paint: ThemePaint): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx || this.scale <= 0) return;
    ctx.save();
    ctx.setTransform(
      this.scale,
      0,
      0,
      this.scale,
      -this.win.x * this.scale,
      -this.win.y * this.scale,
    );
    applyStrokeStyle(ctx, stroke, paint);
    ctx.fill(this.pathFor(stroke));
    resetStrokeStyle(ctx);
    ctx.restore();
  }

  private gcCache(strokes: StrokeData[]): void {
    if (this.cache.size <= strokes.length * 2 + 64) return;
    const live = new Set(strokes.map((s) => s.id));
    for (const id of this.cache.keys()) {
      if (!live.has(id)) this.cache.delete(id);
    }
  }
}

/** Render a full page to a fresh canvas — thumbnails and PNG export. */
export function renderPageBitmap(args: {
  strokes: StrokeData[];
  template: TemplateKind;
  size: PageSize;
  paint: ThemePaint;
  tuning: InkTuning;
  width: number;
  height?: number;
}): HTMLCanvasElement {
  const scale = args.width / args.size.w;
  const height = args.height ?? Math.round(args.size.h * scale);
  const canvas = document.createElement('canvas');
  canvas.width = args.width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    paintPage(ctx, {
      strokes: args.strokes,
      template: args.template,
      size: args.size,
      paint: args.paint,
      tuning: args.tuning,
      win: { x: 0, y: 0, w: args.size.w, h: height / scale },
      scale,
    });
  }
  return canvas;
}
