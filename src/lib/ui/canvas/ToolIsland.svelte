<script lang="ts">
  // The one floating tool island (DESIGN.md §4.2). Draggable via the grip;
  // position persists. The ink dot always carries the pen's current color.
  import {
    Circle,
    Eraser,
    Highlighter,
    Lasso,
    Minus,
    Pen,
    Redo2,
    Square,
    Triangle,
    Undo2,
  } from '@lucide/svelte';
  import { resolveInk, type ShapeKind, type ToolKind } from '$lib/ink/engine';
  import { session } from '$lib/store/session.svelte';
  import { settings } from '$lib/store/settings.svelte';
  import { theme } from '$lib/store/theme.svelte';
  import SwatchGrid from '$lib/ui/SwatchGrid.svelte';
  import {
    ERASER_MAX,
    ERASER_MIN,
    ERASER_PRESETS,
    HL_PRESETS,
    PEN_PRESETS,
    type ToolState,
  } from './tool-state';

  let {
    tools,
    dimmed = false,
  }: {
    tools: ToolState;
    /** Click-through is on: nothing here can be pressed, so it says so. */
    dimmed?: boolean;
  } = $props();

  let island = $state<HTMLDivElement | null>(null);
  let pos = $state<{ x: number; y: number } | null>(settings.data.island);
  let popover = $state<'color' | 'width' | 'shape' | null>(null);
  let below = $state(false);
  /** The popover hangs off the button that opened it, not the island's middle. */
  let popEl = $state<HTMLDivElement | null>(null);
  let anchorX = $state(0);
  let popLeft = $state<number | null>(null);

  const drawTool = $derived(tools.tool === 'highlighter' ? 'highlighter' : 'pen');
  const isEraser = $derived(tools.tool === 'eraser');
  const activeColor = $derived(drawTool === 'highlighter' ? tools.hlColor : tools.penColor);
  const activeWidth = $derived(
    isEraser ? tools.eraserRadius : drawTool === 'highlighter' ? tools.hlWidth : tools.penWidth,
  );
  const presets = $derived(
    isEraser ? ERASER_PRESETS : drawTool === 'highlighter' ? HL_PRESETS : PEN_PRESETS,
  );
  const resolvedColor = $derived(resolveInk(activeColor, theme.dark));

  const toolButtons: { tool: ToolKind; icon: typeof Pen; label: string; key: string }[] = [
    { tool: 'pen', icon: Pen, label: 'Pen', key: 'P' },
    { tool: 'shape', icon: Square, label: 'Shapes', key: 'R' },
    { tool: 'eraser', icon: Eraser, label: 'Eraser', key: 'E' },
    { tool: 'highlighter', icon: Highlighter, label: 'Highlighter', key: 'H' },
    { tool: 'lasso', icon: Lasso, label: 'Lasso', key: 'S' },
  ];

  const SHAPE_OPTIONS: { kind: ShapeKind; icon: typeof Square; label: string }[] = [
    { kind: 'line', icon: Minus, label: 'Line' },
    { kind: 'rect', icon: Square, label: 'Rectangle' },
    { kind: 'ellipse', icon: Circle, label: 'Circle' },
    { kind: 'triangle', icon: Triangle, label: 'Triangle' },
  ];
  const ShapeIcon = $derived(SHAPE_OPTIONS.find((o) => o.kind === tools.shape)?.icon ?? Square);

  function setColor(color: string) {
    if (drawTool === 'highlighter') tools.hlColor = color;
    else tools.penColor = color;
  }

  function setWidth(width: number) {
    if (isEraser) tools.eraserRadius = width;
    else if (drawTool === 'highlighter') tools.hlWidth = width;
    else tools.penWidth = width;
  }

  function presetDotSize(preset: number): number {
    return isEraser ? Math.min(4 + preset, 22) : Math.min(4 + preset * 1.6, 22);
  }

  function togglePopover(which: 'color' | 'width' | 'shape', trigger: HTMLElement) {
    if (popover === which) {
      popover = null;
      return;
    }
    const host = island;
    const ir = host?.getBoundingClientRect();
    const br = trigger.getBoundingClientRect();
    // Offsets are measured from the island's padding box — the origin `left: 0`
    // resolves against for the absolutely positioned anchor.
    anchorX = ir && host ? br.left + br.width / 2 - ir.left - host.clientLeft : 0;
    popLeft = null;
    below = (ir?.top ?? 400) < 320;
    popover = which;
  }

  /** Keep the popover on screen even when its button sits near a window edge. */
  $effect(() => {
    const el = popEl;
    const target = anchorX;
    if (!el || !island) return;
    const half = el.offsetWidth / 2;
    const left = island.getBoundingClientRect().left + island.clientLeft;
    const min = 8 + half - left;
    const max = window.innerWidth - 8 - half - left;
    popLeft = max < min ? (min + max) / 2 : Math.min(Math.max(target, min), max);
  });

  function pickTool(t: ToolKind, trigger: HTMLElement) {
    if (t === 'shape') {
      // First tap selects the tool; a tap on the active tool opens the picker.
      if (tools.tool !== 'shape') {
        tools.tool = 'shape';
        if (popover !== 'shape') togglePopover('shape', trigger);
      } else {
        togglePopover('shape', trigger);
      }
    } else {
      tools.tool = t;
      if (popover === 'shape') popover = null;
    }
  }

  $effect(() => {
    if (!popover) return;
    const onDown = (e: PointerEvent) => {
      if (island && !island.contains(e.target as Node)) popover = null;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        popover = null;
      }
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  });

  function clampPos(x: number, y: number): { x: number; y: number } {
    const w = island?.offsetWidth ?? 360;
    const h = island?.offsetHeight ?? 48;
    return {
      x: Math.min(Math.max(8, x), window.innerWidth - w - 8),
      y: Math.min(Math.max(8, y), window.innerHeight - h - 8),
    };
  }

  function startDrag(e: PointerEvent) {
    if (!island) return;
    e.preventDefault();
    const rect = island.getBoundingClientRect();
    const offX = e.clientX - rect.left;
    const offY = e.clientY - rect.top;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      pos = clampPos(ev.clientX - offX, ev.clientY - offY);
    };
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      settings.data.island = pos;
      settings.save();
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
  }

  const style = $derived(
    pos
      ? `left: ${pos.x}px; top: ${pos.y}px; transform: none;`
      : 'left: 50%; bottom: 24px; transform: translateX(-50%);',
  );
</script>

<div class="island" class:dimmed bind:this={island} {style}>
  {#if popover}
    <div
      class="pop-anchor"
      class:below
      bind:this={popEl}
      style:--px={`${popLeft ?? anchorX}px`}
    >
      {#if popover === 'color'}
        <div class="popover">
          <SwatchGrid selected={activeColor} onpick={setColor} />
        </div>
      {:else if popover === 'width'}
        <div class="popover">
          <div class="width-presets">
            {#each presets as preset (preset)}
              <button
                class="preset"
                class:active={Math.abs(activeWidth - preset) < 0.01}
                aria-label={`Width ${preset}`}
                onclick={() => setWidth(preset)}
              >
                <span
                  class="preset-dot"
                  class:hollow={isEraser}
                  style:width={`${presetDotSize(preset)}px`}
                  style:height={`${presetDotSize(preset)}px`}
                  style:background={isEraser ? 'transparent' : resolvedColor}
                ></span>
              </button>
            {/each}
            <span class="width-value">{activeWidth}px</span>
          </div>
          <input
            class="width-slider"
            type="range"
            min={isEraser ? ERASER_MIN : 1}
            max={isEraser ? ERASER_MAX : 32}
            step={isEraser ? 1 : 0.5}
            value={activeWidth}
            aria-label={isEraser ? 'Eraser size' : 'Stroke width'}
            oninput={(e) => setWidth(Number(e.currentTarget.value))}
          />
          <div class="preview-well">
            <span
              class="preview-dot"
              class:hollow={isEraser}
              style:width={`${isEraser ? Math.min(activeWidth * 2, 40) : activeWidth}px`}
              style:height={`${isEraser ? Math.min(activeWidth * 2, 40) : activeWidth}px`}
              style:background={isEraser ? 'transparent' : resolvedColor}
            ></span>
          </div>
        </div>
      {:else if popover === 'shape'}
        <div class="popover shape-pop">
          <div class="shape-row">
            {#each SHAPE_OPTIONS as opt (opt.kind)}
              <button
                class="preset"
                class:active={tools.shape === opt.kind}
                title={opt.label}
                aria-label={opt.label}
                onclick={() => {
                  tools.shape = opt.kind;
                  popover = null;
                }}
              >
                <opt.icon size={18} strokeWidth={1.5} />
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <div class="grip" role="presentation" title="Move island" onpointerdown={startDrag}>
    <span></span><span></span>
  </div>

  {#each toolButtons as tb (tb.tool)}
    <button
      class="tool"
      class:active={tools.tool === tb.tool}
      title={`${tb.label}  ${tb.key}`}
      aria-label={tb.label}
      aria-pressed={tools.tool === tb.tool}
      onclick={(e) => pickTool(tb.tool, e.currentTarget)}
    >
      {#if tb.tool === 'shape'}
        <ShapeIcon size={18} strokeWidth={1.5} />
      {:else}
        <tb.icon size={18} strokeWidth={1.5} />
      {/if}
      {#if tb.tool === 'pen'}
        <span class="pen-dot" style:background={resolveInk(tools.penColor, theme.dark)}></span>
      {/if}
    </button>
  {/each}

  <div class="rule"></div>

  <button
    class="tool"
    title="Undo  ⌘Z"
    aria-label="Undo"
    disabled={!session.canUndo}
    onclick={() => session.undo()}
  >
    <Undo2 size={18} strokeWidth={1.5} />
  </button>
  <button
    class="tool"
    title="Redo  ⇧⌘Z"
    aria-label="Redo"
    disabled={!session.canRedo}
    onclick={() => session.redo()}
  >
    <Redo2 size={18} strokeWidth={1.5} />
  </button>

  <div class="rule"></div>

  <button
    class="tool"
    title="Ink color  1–9"
    aria-label="Ink color"
    onclick={(e) => togglePopover('color', e.currentTarget)}
  >
    <span class="ink-dot" style:background={resolvedColor}></span>
  </button>
  <button
    class="tool width-btn"
    title={isEraser ? 'Eraser size  [ ]' : 'Stroke width  [ ]'}
    aria-label={isEraser ? 'Eraser size' : 'Stroke width'}
    onclick={(e) => togglePopover('width', e.currentTarget)}
  >
    <span
      class="ink-dot outline"
      style:width={`${Math.min(4 + activeWidth * 1.4, 20)}px`}
      style:height={`${Math.min(4 + activeWidth * 1.4, 20)}px`}
    ></span>
  </button>
</div>

<style>
  .island {
    position: fixed;
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 6px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 999px;
    box-shadow: var(--shadow-card);
    transition: opacity 200ms ease-out;
  }
  .island.dimmed {
    opacity: 0.5;
  }
  .grip {
    display: flex;
    gap: 2px;
    padding: 6px 4px 6px 6px;
    cursor: grab;
    touch-action: none;
  }
  .grip span {
    width: 3px;
    height: 14px;
    border-radius: 2px;
    background: var(--border);
  }
  .grip:hover span {
    background: var(--text-muted);
  }
  .tool {
    position: relative;
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 6px;
    color: var(--text);
    transition: background-color 120ms ease-out;
  }
  .tool:hover:not(:disabled):not(.active) {
    background: var(--surface-2);
  }
  .tool.active {
    background: var(--accent);
    color: var(--accent-ink);
  }
  .tool:disabled {
    color: var(--text-muted);
    opacity: 0.5;
    cursor: default;
  }
  .pen-dot {
    position: absolute;
    right: 6px;
    bottom: 6px;
    width: 5px;
    height: 5px;
    border-radius: 999px;
  }
  .tool.active .pen-dot {
    outline: 1px solid var(--accent-ink);
  }
  .ink-dot {
    width: 16px;
    height: 16px;
    border-radius: 999px;
    border: 1px solid var(--border);
  }
  .ink-dot.outline {
    background: transparent;
    border: 2px solid currentColor;
  }
  .rule {
    width: 1px;
    height: 22px;
    margin: 0 4px;
    background: var(--border);
  }
  /* Centred on the button that opened it (--px), clamped to the window. */
  .pop-anchor {
    position: absolute;
    bottom: calc(100% + 10px);
    left: 0;
    width: max-content;
    transform: translateX(calc(var(--px, 0px) - 50%));
  }
  .pop-anchor.below {
    bottom: auto;
    top: calc(100% + 10px);
  }
  .popover {
    min-width: 200px;
    padding: 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: var(--shadow-sheet);
    animation: rise 160ms ease-out;
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
  }
  .width-presets {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .preset {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 6px;
  }
  .preset:hover {
    background: var(--surface-2);
  }
  .preset.active {
    background: var(--surface-2);
    outline: 1px solid var(--accent);
  }
  .preset-dot {
    border-radius: 999px;
  }
  .preset-dot.hollow {
    border: 1.5px solid var(--text);
  }
  .shape-pop {
    min-width: 0;
  }
  .shape-row {
    display: flex;
    gap: 4px;
  }
  .width-value {
    margin-left: auto;
    font-size: 12px;
    color: var(--text-muted);
  }
  .width-slider {
    width: 100%;
    margin-top: 10px;
    accent-color: var(--accent);
  }
  .preview-well {
    display: grid;
    place-items: center;
    height: 44px;
    margin-top: 10px;
    background: var(--canvas);
    border: 1px solid var(--border);
    border-radius: 8px;
  }
  .preview-dot {
    border-radius: 999px;
  }
  .preview-dot.hollow {
    border: 1.5px solid var(--text);
  }
</style>
