<script lang="ts">
  // Lasso selection chrome: marching-ants box, corner resize handles, one
  // rotate handle, floating mini-bar (recolor · duplicate · delete).
  import { Copy, Palette, RotateCw, Trash2 } from '@lucide/svelte';
  import type { Mat, Rect } from '$lib/ink/engine';
  import SwatchGrid from '$lib/ui/SwatchGrid.svelte';

  let {
    bounds,
    origin,
    zoom,
    selectedColor,
    onPreview,
    onCommit,
    onDelete,
    onDuplicate,
    onRecolor,
    toPagePoint,
  }: {
    bounds: Rect;
    origin: { x: number; y: number };
    zoom: number;
    selectedColor: string;
    onPreview: (m: Mat | null) => void;
    onCommit: (m: Mat) => void;
    onDelete: () => void;
    onDuplicate: () => void;
    onRecolor: (color: string) => void;
    toPagePoint: (clientX: number, clientY: number) => { x: number; y: number };
  } = $props();

  let matrix = $state<Mat | null>(null);
  let recolorOpen = $state(false);

  const IDENT: Mat = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

  function apply(m: Mat, x: number, y: number): { x: number; y: number } {
    return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
  }

  function isIdentity(m: Mat): boolean {
    return (
      Math.abs(m.a - 1) < 1e-4 &&
      Math.abs(m.b) < 1e-4 &&
      Math.abs(m.c) < 1e-4 &&
      Math.abs(m.d - 1) < 1e-4 &&
      Math.abs(m.e) < 0.01 &&
      Math.abs(m.f) < 0.01
    );
  }

  const baseCorners = $derived([
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.w, y: bounds.y },
    { x: bounds.x + bounds.w, y: bounds.y + bounds.h },
    { x: bounds.x, y: bounds.y + bounds.h },
  ]);

  /** Displayed axis-aligned box (css px in container space). */
  const box = $derived.by(() => {
    const m = matrix ?? IDENT;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const c of baseCorners) {
      const p = apply(m, c.x, c.y);
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    return {
      left: origin.x + minX * zoom,
      top: origin.y + minY * zoom,
      w: (maxX - minX) * zoom,
      h: (maxY - minY) * zoom,
    };
  });

  const barBelow = $derived(box.top < 96);

  interface Gesture {
    type: 'move' | 'scale' | 'rotate';
    start: { x: number; y: number };
    anchor?: { x: number; y: number };
    center?: { x: number; y: number };
  }

  let gesture: Gesture | null = null;

  function begin(e: PointerEvent, type: Gesture['type'], extra?: Partial<Gesture>): void {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    recolorOpen = false;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    gesture = { type, start: toPagePoint(e.clientX, e.clientY), ...extra };

    const move = (ev: PointerEvent) => {
      if (!gesture) return;
      const p = toPagePoint(ev.clientX, ev.clientY);
      let m: Mat = IDENT;
      if (gesture.type === 'move') {
        m = { a: 1, b: 0, c: 0, d: 1, e: p.x - gesture.start.x, f: p.y - gesture.start.y };
      } else if (gesture.type === 'scale' && gesture.anchor) {
        const a = gesture.anchor;
        const dx0 = gesture.start.x - a.x;
        const dy0 = gesture.start.y - a.y;
        let sx = Math.abs(dx0) > 1e-3 ? (p.x - a.x) / dx0 : 1;
        let sy = Math.abs(dy0) > 1e-3 ? (p.y - a.y) / dy0 : 1;
        const clamp = (v: number) =>
          Math.sign(v || 1) * Math.min(20, Math.max(0.05, Math.abs(v)));
        sx = clamp(sx);
        sy = clamp(sy);
        if (ev.shiftKey) {
          const u = Math.max(Math.abs(sx), Math.abs(sy));
          sx = Math.sign(sx) * u;
          sy = Math.sign(sy) * u;
        }
        m = { a: sx, b: 0, c: 0, d: sy, e: a.x - sx * a.x, f: a.y - sy * a.y };
      } else if (gesture.type === 'rotate' && gesture.center) {
        const c = gesture.center;
        const a0 = Math.atan2(gesture.start.y - c.y, gesture.start.x - c.x);
        const a1 = Math.atan2(p.y - c.y, p.x - c.x);
        const t = a1 - a0;
        const cos = Math.cos(t);
        const sin = Math.sin(t);
        m = {
          a: cos,
          b: sin,
          c: -sin,
          d: cos,
          e: c.x - cos * c.x + sin * c.y,
          f: c.y - sin * c.x - cos * c.y,
        };
      }
      matrix = m;
      onPreview(m);
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      const m = matrix;
      gesture = null;
      matrix = null;
      if (m && !isIdentity(m)) onCommit(m);
      else onPreview(null);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  }

  function beginScale(e: PointerEvent, corner: number): void {
    const opposite = baseCorners[(corner + 2) % 4];
    begin(e, 'scale', { anchor: { ...opposite } });
  }

  function beginRotate(e: PointerEvent): void {
    begin(e, 'rotate', {
      center: { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 },
    });
  }

  const cursors = ['nwse-resize', 'nesw-resize', 'nwse-resize', 'nesw-resize'];
</script>

<div
  class="box"
  style:left={`${box.left}px`}
  style:top={`${box.top}px`}
  style:width={`${box.w}px`}
  style:height={`${box.h}px`}
>
  <svg class="ants" width="100%" height="100%" aria-hidden="true">
    <rect x="0.75" y="0.75" width="calc(100% - 1.5px)" height="calc(100% - 1.5px)" />
  </svg>

  <div class="move-zone" role="presentation" onpointerdown={(e) => begin(e, 'move')}></div>

  {#each cursors as cursor, i (i)}
    <div
      class="handle"
      class:tl={i === 0}
      class:tr={i === 1}
      class:br={i === 2}
      class:bl={i === 3}
      style:cursor
      role="presentation"
      onpointerdown={(e) => beginScale(e, i)}
    ></div>
  {/each}

  <div class="rotate" role="presentation" onpointerdown={beginRotate} title="Rotate">
    <RotateCw size={12} strokeWidth={1.5} />
  </div>

  {#if !matrix}
    <div class="minibar" class:below={barBelow}>
      {#if recolorOpen}
        <div class="recolor-pop">
          <SwatchGrid
            selected={selectedColor}
            onpick={(c) => {
              recolorOpen = false;
              onRecolor(c);
            }}
          />
        </div>
      {/if}
      <button title="Recolor" aria-label="Recolor" onclick={() => (recolorOpen = !recolorOpen)}>
        <Palette size={16} strokeWidth={1.5} />
      </button>
      <button title="Duplicate" aria-label="Duplicate" onclick={onDuplicate}>
        <Copy size={16} strokeWidth={1.5} />
      </button>
      <button class="danger" title="Delete" aria-label="Delete" onclick={onDelete}>
        <Trash2 size={16} strokeWidth={1.5} />
      </button>
    </div>
  {/if}
</div>

<style>
  .box {
    position: absolute;
    z-index: 15;
  }
  .ants {
    position: absolute;
    inset: 0;
    overflow: visible;
    pointer-events: none;
  }
  .ants rect {
    fill: none;
    stroke: var(--accent);
    stroke-width: 1.5;
    stroke-dasharray: 6 4;
    animation: march 0.6s linear infinite;
  }
  @keyframes march {
    to {
      stroke-dashoffset: -10;
    }
  }
  .move-zone {
    position: absolute;
    inset: 0;
    cursor: move;
  }
  .handle {
    position: absolute;
    width: 10px;
    height: 10px;
    background: var(--surface);
    border: 1.5px solid var(--accent);
    border-radius: 3px;
  }
  .handle.tl {
    left: -5px;
    top: -5px;
  }
  .handle.tr {
    right: -5px;
    top: -5px;
  }
  .handle.br {
    right: -5px;
    bottom: -5px;
  }
  .handle.bl {
    left: -5px;
    bottom: -5px;
  }
  .rotate {
    position: absolute;
    left: 50%;
    top: -28px;
    transform: translateX(-50%);
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    background: var(--surface);
    border: 1.5px solid var(--accent);
    border-radius: 999px;
    color: var(--accent);
    cursor: grab;
  }
  .minibar {
    position: absolute;
    left: 50%;
    top: -68px;
    transform: translateX(-50%);
    display: flex;
    gap: 2px;
    padding: 4px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: var(--shadow-card);
  }
  .minibar.below {
    top: auto;
    bottom: -44px;
  }
  .minibar button {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 6px;
    color: var(--text);
  }
  .minibar button:hover {
    background: var(--surface-2);
  }
  .minibar button.danger:hover {
    color: var(--danger);
  }
  .recolor-pop {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    padding: 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: var(--shadow-sheet);
  }
</style>
