// The ink engine's public surface — the only module the app imports from
// lib/ink. Orchestrates pointer capture, the wet layer (active stroke), dry
// page renderers, eraser hit-testing, and lasso geometry.
//
// Latency contract: nothing between pointer events and wet-canvas paint may
// await, invoke IPC, touch Svelte reactivity, or allocate in per-move loops.

import {
  attachPointer,
  coalescedEvents,
  predictedEvents,
  BUTTONS_BARREL,
  BUTTONS_ERASER,
} from './input';
import { PageRenderer, applyStrokeStyle, cachedStrokeBounds } from './renderer';
import { strokeOutline, outlineToPath } from './stroke';
import {
  inflateRect,
  maskStrokeUnderCircle,
  polygonBounds,
  rectUnion,
  splitPointsByMask,
  strokeInPolygon,
} from './hittest';
import { DEFAULT_TUNING } from './types';
import type {
  DrawTool,
  InkTuning,
  Mat,
  PageSize,
  PageWindow,
  Rect,
  StrokeData,
  StrokeEdit,
  StrokeStyle,
  TemplateKind,
  ThemePaint,
  ToolKind,
} from './types';

export interface EngineCallbacks {
  /** Must synchronously add the stroke to the document (undoably). */
  onCommitStroke(pageId: string, stroke: StrokeData): void;
  /** Must synchronously apply the split edits to the document (undoably). */
  onEraseCommit(pageId: string, edits: StrokeEdit[]): void;
  onLassoSelect(pageId: string, ids: string[]): void;
  onStrokeStart?(): void;
  onStrokeEnd?(): void;
}

export interface PageRegistration {
  id: string;
  el: HTMLElement;
  canvas: HTMLCanvasElement;
  size: PageSize;
  template: TemplateKind;
  getStrokes(): StrokeData[];
  getWindow(): PageWindow;
}

interface InternalPage {
  reg: PageRegistration;
  renderer: PageRenderer;
  detach: () => void;
}

interface ActiveGesture {
  kind: 'draw' | 'erase' | 'lasso';
  pageId: string;
  tool: DrawTool;
  style: StrokeStyle;
  rect: DOMRect;
  rectDirty: boolean;
  n: number;
  np: number;
  /** Partial-erase masks: stroke id → per-point erased flags. */
  masks: Map<string, Uint8Array>;
  lasso: number[];
  lastX: number;
  lastY: number;
  raf: number;
  dirty: boolean;
  lastInputAt: number;
}

export interface EngineStats {
  wetFrameMs: number;
  inputToPaintMs: number;
  movesPerSec: number;
  activePoints: number;
}

export class InkEngine {
  tool: ToolKind = 'pen';
  pen: StrokeStyle = { color: 'ink/black', width: 3 };
  highlighter: StrokeStyle = { color: 'ink/amber', width: 16 };
  eraserRadius = 14;

  private paint: ThemePaint = {
    dark: false,
    canvas: '#ffffff',
    templateLine: '#e0e0e0',
    accent: '#3e5c8a',
  };
  private tuning: InkTuning = { ...DEFAULT_TUNING };
  private pages = new Map<string, InternalPage>();
  private hiddenByPage = new Map<string, Set<string>>();
  /** Live-erase preview: original stroke id → its surviving segments. */
  private replaceByPage = new Map<string, Map<string, StrokeData[]>>();
  private wetCanvas: HTMLCanvasElement | null = null;
  private wetCtx: CanvasRenderingContext2D | null = null;
  private wetRect: DOMRect | null = null;
  private dpr = 1;
  private active: ActiveGesture | null = null;
  private pts = new Float32Array(3 * 1024);
  private predicted = new Float32Array(3 * 4);
  private combined = new Float32Array(3 * 1024 + 12);
  private moveTimes: number[] = [];

  readonly stats: EngineStats = {
    wetFrameMs: 0,
    inputToPaintMs: 0,
    movesPerSec: 0,
    activePoints: 0,
  };

  constructor(private callbacks: EngineCallbacks) {}

  // ————— shell wiring —————

  attachWet(canvas: HTMLCanvasElement): void {
    this.wetCanvas = canvas;
    this.wetCtx = canvas.getContext('2d');
    this.wetRect = null;
  }

  setViewportSize(cssW: number, cssH: number, dpr: number): void {
    this.dpr = dpr;
    if (this.wetCanvas) {
      const w = Math.max(1, Math.round(cssW * dpr));
      const h = Math.max(1, Math.round(cssH * dpr));
      if (this.wetCanvas.width !== w) this.wetCanvas.width = w;
      if (this.wetCanvas.height !== h) this.wetCanvas.height = h;
      this.wetRect = null;
    }
  }

  /** Client rects are cached per gesture; call when the scroller scrolls. */
  notifyScrolled(): void {
    this.wetRect = null;
    if (this.active) this.active.rectDirty = true;
  }

  setPaint(paint: ThemePaint): void {
    this.paint = paint;
    this.repaintAll();
  }

  getPaint(): ThemePaint {
    return this.paint;
  }

  setTuning(partial: Partial<InkTuning>): void {
    this.tuning = { ...this.tuning, ...partial };
    for (const page of this.pages.values()) page.renderer.setTuning(this.tuning);
    this.repaintAll();
  }

  getTuning(): InkTuning {
    return this.tuning;
  }

  styleFor(tool: DrawTool): StrokeStyle {
    return tool === 'highlighter' ? this.highlighter : this.pen;
  }

  // ————— page lifecycle —————

  registerPage(reg: PageRegistration): void {
    this.unregisterPage(reg.id);
    const renderer = new PageRenderer(reg.canvas, reg.size, reg.template, this.tuning);
    const detach = attachPointer(reg.el, {
      onDown: (e) => this.gestureDown(reg.id, e),
      onMove: (e) => this.gestureMove(e),
      onUp: (e) => this.gestureUp(e, false),
      onCancel: (e) => this.gestureUp(e, true),
    });
    this.pages.set(reg.id, { reg, renderer, detach });
    this.repaintPage(reg.id);
  }

  unregisterPage(id: string): void {
    const page = this.pages.get(id);
    if (!page) return;
    if (this.active?.pageId === id) this.abortGesture();
    page.detach();
    this.pages.delete(id);
  }

  setTemplate(pageId: string, template: TemplateKind): void {
    const page = this.pages.get(pageId);
    if (!page) return;
    page.reg.template = template;
    page.renderer.template = template;
    this.repaintPage(pageId);
  }

  destroy(): void {
    this.abortGesture();
    for (const id of [...this.pages.keys()]) this.unregisterPage(id);
  }

  // ————— painting —————

  repaintPage(id: string, dirty?: Rect): void {
    const page = this.pages.get(id);
    if (!page) return;
    const { rect, scale } = page.reg.getWindow();
    const resized = page.renderer.setWindow(rect, scale);
    this.positionCanvas(page);
    page.renderer.render(this.effectiveStrokes(page), this.paint, {
      hidden: this.hiddenByPage.get(id),
      dirty: resized ? undefined : dirty,
    });
  }

  /** Doc strokes with any live-erase preview substitutions applied. */
  private effectiveStrokes(page: InternalPage): StrokeData[] {
    const strokes = page.reg.getStrokes();
    const repl = this.replaceByPage.get(page.reg.id);
    if (!repl || repl.size === 0) return strokes;
    const out: StrokeData[] = [];
    for (const s of strokes) {
      const segments = repl.get(s.id);
      if (segments) out.push(...segments);
      else out.push(s);
    }
    return out;
  }

  repaintAll(): void {
    for (const id of this.pages.keys()) this.repaintPage(id);
  }

  /** Re-rasterize when the desired window drifted (scroll while zoomed in). */
  refreshWindow(id: string): void {
    const page = this.pages.get(id);
    if (!page) return;
    const { rect, scale } = page.reg.getWindow();
    const cur = page.renderer.window;
    if (scale === page.renderer.pxScale && cur.w === rect.w && cur.h === rect.h) {
      const slackX = rect.w * 0.2;
      const slackY = rect.h * 0.2;
      if (Math.abs(cur.x - rect.x) < slackX && Math.abs(cur.y - rect.y) < slackY) return;
    }
    this.repaintPage(id);
  }

  bakeStroke(pageId: string, stroke: StrokeData): void {
    this.pages.get(pageId)?.renderer.bake(stroke, this.paint);
  }

  private positionCanvas(page: InternalPage): void {
    const { rect, scale } = page.reg.getWindow();
    const cssPerUnit = scale / this.dpr;
    const style = page.reg.canvas.style;
    style.position = 'absolute';
    style.left = `${rect.x * cssPerUnit}px`;
    style.top = `${rect.y * cssPerUnit}px`;
    style.width = `${rect.w * cssPerUnit}px`;
    style.height = `${rect.h * cssPerUnit}px`;
  }

  // ————— selection support —————

  setHidden(pageId: string, ids: ReadonlySet<string> | null): void {
    if (ids && ids.size > 0) {
      this.hiddenByPage.set(pageId, new Set(ids));
    } else {
      this.hiddenByPage.delete(pageId);
    }
    this.repaintPage(pageId);
  }

  /** Draw transformed clones of `strokes` on the wet layer (drag preview). */
  drawSelectionPreview(pageId: string, strokes: StrokeData[], m: Mat): void {
    const page = this.pages.get(pageId);
    const ctx = this.wetCtx;
    if (!page || !ctx || !this.wetCanvas) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.wetCanvas.width, this.wetCanvas.height);
    const pr = page.reg.el.getBoundingClientRect();
    const wr = this.wetCanvasRect();
    const scale = (pr.width / page.reg.size.w) * this.dpr;
    ctx.setTransform(
      scale,
      0,
      0,
      scale,
      (pr.left - wr.left) * this.dpr,
      (pr.top - wr.top) * this.dpr,
    );
    ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
    for (const stroke of strokes) {
      applyStrokeStyle(ctx, stroke, this.paint);
      ctx.fill(page.renderer.pathFor(stroke));
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  clearWet(): void {
    const ctx = this.wetCtx;
    if (!ctx || !this.wetCanvas) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.wetCanvas.width, this.wetCanvas.height);
  }

  // ————— gesture handling (the hot path) —————

  private gestureDown(pageId: string, e: PointerEvent): boolean {
    if (this.active) return false;
    if (e.buttons & BUTTONS_BARREL) return false; // barrel button pans (shell)
    if (e.button !== 0 && !(e.buttons & BUTTONS_ERASER)) return false;
    const page = this.pages.get(pageId);
    if (!page) return false;

    const forcedEraser = (e.buttons & BUTTONS_ERASER) !== 0;
    const tool = forcedEraser ? 'eraser' : this.tool;
    const kind = tool === 'eraser' ? 'erase' : tool === 'lasso' ? 'lasso' : 'draw';
    const drawTool: DrawTool = tool === 'highlighter' ? 'highlighter' : 'pen';

    this.active = {
      kind,
      pageId,
      tool: drawTool,
      style: { ...this.styleFor(drawTool) },
      rect: page.reg.el.getBoundingClientRect(),
      rectDirty: false,
      n: 0,
      np: 0,
      masks: new Map(),
      lasso: [],
      lastX: 0,
      lastY: 0,
      raf: 0,
      dirty: true,
      lastInputAt: performance.now(),
    };
    this.appendEvent(page, e);
    this.callbacks.onStrokeStart?.();
    const frame = () => {
      if (!this.active) return;
      this.renderWet();
      this.active.raf = requestAnimationFrame(frame);
    };
    this.active.raf = requestAnimationFrame(frame);
    return true;
  }

  private gestureMove(e: PointerEvent): void {
    const active = this.active;
    if (!active) return;
    const page = this.pages.get(active.pageId);
    if (!page) return;
    if (active.rectDirty) {
      active.rect = page.reg.el.getBoundingClientRect();
      active.rectDirty = false;
    }
    const events = coalescedEvents(e);
    for (let i = 0; i < events.length; i++) {
      this.appendEvent(page, events[i]);
    }
    if (active.kind === 'draw') {
      const preds = predictedEvents(e, 3);
      active.np = 0;
      for (let i = 0; i < preds.length; i++) {
        const ev = preds[i];
        const k = active.np * 3;
        this.predicted[k] = this.toPageX(page, ev.clientX);
        this.predicted[k + 1] = this.toPageY(page, ev.clientY);
        this.predicted[k + 2] = ev.pressure || 0.5;
        active.np++;
      }
    }
    active.dirty = true;
    active.lastInputAt = performance.now();
    this.moveTimes.push(active.lastInputAt);
  }

  private gestureUp(e: PointerEvent, cancelled: boolean): void {
    const active = this.active;
    if (!active) return;
    cancelAnimationFrame(active.raf);
    this.active = null;
    this.moveTimes.length = 0;
    const page = this.pages.get(active.pageId);

    if (!cancelled && page && active.kind === 'draw' && active.n > 0) {
      const points = new Array<number>(active.n * 3);
      for (let i = 0; i < points.length; i++) {
        points[i] = Math.round(this.pts[i] * 100) / 100;
      }
      const stroke: StrokeData = {
        id: crypto.randomUUID(),
        tool: active.tool,
        color: active.style.color,
        width: active.style.width,
        points,
      };
      this.callbacks.onCommitStroke(active.pageId, stroke);
      this.bakeStroke(active.pageId, stroke);
    } else if (!cancelled && active.kind === 'erase') {
      if (page && active.masks.size > 0) {
        const edits: StrokeEdit[] = [];
        for (const s of page.reg.getStrokes()) {
          const mask = active.masks.get(s.id);
          if (!mask) continue;
          edits.push({ before: s, after: this.segmentsFor(s, mask, true) });
        }
        if (edits.length > 0) this.callbacks.onEraseCommit(active.pageId, edits);
      }
      // The doc now holds the split result; drop the preview substitution.
      // Pixels are identical, so no repaint is needed.
      this.replaceByPage.delete(active.pageId);
    } else if (!cancelled && page && active.kind === 'lasso') {
      const ids: string[] = [];
      if (active.lasso.length >= 6) {
        const box = polygonBounds(active.lasso);
        for (const s of page.reg.getStrokes()) {
          if (strokeInPolygon(s.points, active.lasso, box)) ids.push(s.id);
        }
      }
      this.callbacks.onLassoSelect(active.pageId, ids);
    } else if (cancelled && active.kind === 'erase') {
      // Restore anything previewed-away during a cancelled erase.
      this.replaceByPage.delete(active.pageId);
      this.repaintPage(active.pageId);
    }

    this.clearWet();
    this.stats.activePoints = 0;
    this.callbacks.onStrokeEnd?.();
  }

  private abortGesture(): void {
    const active = this.active;
    if (!active) return;
    cancelAnimationFrame(active.raf);
    this.active = null;
    this.hiddenByPage.delete(active.pageId);
    this.replaceByPage.delete(active.pageId);
    this.clearWet();
    this.callbacks.onStrokeEnd?.();
  }

  private appendEvent(page: InternalPage, e: PointerEvent): void {
    const active = this.active;
    if (!active) return;
    const x = this.toPageX(page, e.clientX);
    const y = this.toPageY(page, e.clientY);
    active.lastX = x;
    active.lastY = y;
    if (active.kind === 'draw') {
      if ((active.n + 1) * 3 > this.pts.length) this.growBuffers();
      const k = active.n * 3;
      this.pts[k] = x;
      this.pts[k + 1] = y;
      this.pts[k + 2] = e.pressure || 0.5;
      active.n++;
      this.stats.activePoints = active.n;
    } else if (active.kind === 'erase') {
      this.eraseAt(page, x, y);
    } else {
      const len = active.lasso.length;
      if (
        len < 2 ||
        Math.abs(active.lasso[len - 2] - x) + Math.abs(active.lasso[len - 1] - y) > 1.5
      ) {
        active.lasso.push(x, y);
      }
    }
  }

  /** Partial erase: mask the points under the eraser and preview the stroke
   *  as its surviving runs. The doc changes only on pointerup (one command). */
  private eraseAt(page: InternalPage, x: number, y: number): void {
    const active = this.active;
    if (!active) return;
    const r = this.eraserRadius;
    let dirty: Rect | null = null;
    let repl = this.replaceByPage.get(page.reg.id);
    for (const s of page.reg.getStrokes()) {
      const b = cachedStrokeBounds(s);
      const reach = r + s.width / 2;
      if (
        x < b.x - reach ||
        x > b.x + b.w + reach ||
        y < b.y - reach ||
        y > b.y + b.h + reach
      ) {
        continue;
      }
      // Only keep a mask once it actually marks something, so untouched
      // strokes never end up in the commit.
      let mask = active.masks.get(s.id);
      const fresh = !mask;
      if (!mask) mask = new Uint8Array(Math.floor(s.points.length / 3));
      if (maskStrokeUnderCircle(s.points, mask, x, y, reach)) {
        if (fresh) active.masks.set(s.id, mask);
        if (!repl) {
          repl = new Map();
          this.replaceByPage.set(page.reg.id, repl);
        }
        repl.set(s.id, this.segmentsFor(s, mask, false));
        dirty = dirty ? rectUnion(dirty, b) : { ...b };
      }
    }
    if (dirty) {
      this.repaintPage(page.reg.id, inflateRect(dirty, 4));
    }
  }

  /** Build the surviving segment strokes for a masked stroke. Preview ids are
   *  deterministic; the committed edit gets fresh UUIDs. */
  private segmentsFor(s: StrokeData, mask: Uint8Array, finalIds: boolean): StrokeData[] {
    return splitPointsByMask(s.points, mask).map((points, i) => ({
      id: finalIds ? crypto.randomUUID() : `${s.id}~${i}`,
      tool: s.tool,
      color: s.color,
      width: s.width,
      points,
    }));
  }

  private toPageX(page: InternalPage, clientX: number): number {
    const active = this.active;
    if (!active) return 0;
    const v = (clientX - active.rect.left) * (page.reg.size.w / active.rect.width);
    return v < 0 ? 0 : v > page.reg.size.w ? page.reg.size.w : v;
  }

  private toPageY(page: InternalPage, clientY: number): number {
    const active = this.active;
    if (!active) return 0;
    const v = (clientY - active.rect.top) * (page.reg.size.w / active.rect.width);
    return v < 0 ? 0 : v > page.reg.size.h ? page.reg.size.h : v;
  }

  private growBuffers(): void {
    const next = new Float32Array(this.pts.length * 2);
    next.set(this.pts);
    this.pts = next;
    this.combined = new Float32Array(next.length + 12);
  }

  private wetCanvasRect(): DOMRect {
    if (!this.wetRect && this.wetCanvas) {
      this.wetRect = this.wetCanvas.getBoundingClientRect();
    }
    return this.wetRect ?? new DOMRect(0, 0, 1, 1);
  }

  private renderWet(): void {
    const active = this.active;
    const ctx = this.wetCtx;
    if (!active || !ctx || !this.wetCanvas) return;
    if (!active.dirty && active.kind !== 'draw') return;
    const t0 = performance.now();
    const page = this.pages.get(active.pageId);
    if (!page) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.wetCanvas.width, this.wetCanvas.height);

    const pr = active.rect;
    const wr = this.wetCanvasRect();
    const cssPerUnit = pr.width / page.reg.size.w;
    const scale = cssPerUnit * this.dpr;
    ctx.setTransform(
      scale,
      0,
      0,
      scale,
      (pr.left - wr.left) * this.dpr,
      (pr.top - wr.top) * this.dpr,
    );

    if (active.kind === 'draw') {
      const total = active.n * 3 + active.np * 3;
      if (total > 0) {
        this.combined.set(this.pts.subarray(0, active.n * 3));
        for (let i = 0; i < active.np * 3; i++) {
          this.combined[active.n * 3 + i] = this.predicted[i];
        }
        const outline = strokeOutline(this.combined, active.n + active.np, {
          width: active.style.width,
          tool: active.tool,
          tuning: this.tuning,
          last: false,
        });
        applyStrokeStyle(
          ctx,
          {
            id: '',
            tool: active.tool,
            color: active.style.color,
            width: active.style.width,
            points: [],
          },
          this.paint,
        );
        ctx.fill(outlineToPath(outline));
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    } else if (active.kind === 'erase') {
      ctx.strokeStyle = this.paint.accent;
      ctx.lineWidth = 1.5 / cssPerUnit;
      ctx.beginPath();
      ctx.arc(active.lastX, active.lastY, this.eraserRadius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (active.lasso.length >= 4) {
      ctx.strokeStyle = this.paint.accent;
      ctx.lineWidth = 1.5 / cssPerUnit;
      ctx.setLineDash([6 / cssPerUnit, 4 / cssPerUnit]);
      ctx.beginPath();
      ctx.moveTo(active.lasso[0], active.lasso[1]);
      for (let i = 2; i < active.lasso.length; i += 2) {
        ctx.lineTo(active.lasso[i], active.lasso[i + 1]);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    active.dirty = false;
    const now = performance.now();
    this.stats.wetFrameMs = now - t0;
    this.stats.inputToPaintMs = now - active.lastInputAt;
    while (this.moveTimes.length > 0 && this.moveTimes[0] < now - 1000) {
      this.moveTimes.shift();
    }
    this.stats.movesPerSec = this.moveTimes.length;
  }
}

// ————— re-exports: the engine's full public surface —————

export { INKS, resolveInk, isSemanticInk } from './palette';
export type { InkDef } from './palette';
export {
  strokeBounds,
  strokeInPolygon,
  pointInPolygon,
  polygonBounds,
  rectUnion,
  rectsIntersect,
  inflateRect,
  strokeHitsCircle,
  maskStrokeUnderCircle,
  splitPointsByMask,
} from './hittest';
export { strokeOutline, outlineToPath, outlineToSvgPath } from './stroke';
export {
  renderPageBitmap,
  paintPage,
  MAX_BACKING,
  cachedStrokeBounds,
  HIGHLIGHT_ALPHA_LIGHT,
  HIGHLIGHT_ALPHA_DARK,
} from './renderer';
export { DEFAULT_TUNING } from './types';
export type {
  DrawTool,
  ToolKind,
  TemplateKind,
  StrokeData,
  StrokeEdit,
  StrokeStyle,
  PageSize,
  Rect,
  Mat,
  ThemePaint,
  InkTuning,
  PageWindow,
} from './types';
