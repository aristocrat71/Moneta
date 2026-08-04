<script lang="ts">
  // The one floating tool island (DESIGN.md §4.2). Draggable via the grip;
  // position persists. The ink dot always carries the pen's current color.
  import { Eraser, Highlighter, Lasso, Pen, Redo2, Undo2 } from '@lucide/svelte';
  import { resolveInk, type ToolKind } from '$lib/ink/engine';
  import { session } from '$lib/store/session.svelte';
  import { settings } from '$lib/store/settings.svelte';
  import { theme } from '$lib/store/theme.svelte';
  import SwatchGrid from '$lib/ui/SwatchGrid.svelte';
  import { HL_PRESETS, PEN_PRESETS, type ToolState } from './tool-state';

  let { tools }: { tools: ToolState } = $props();

  let island = $state<HTMLDivElement | null>(null);
  let pos = $state<{ x: number; y: number } | null>(settings.data.island);
  let popover = $state<'color' | 'width' | null>(null);
  let below = $state(false);

  const drawTool = $derived(tools.tool === 'highlighter' ? 'highlighter' : 'pen');
  const activeColor = $derived(drawTool === 'highlighter' ? tools.hlColor : tools.penColor);
  const activeWidth = $derived(drawTool === 'highlighter' ? tools.hlWidth : tools.penWidth);
  const presets = $derived(drawTool === 'highlighter' ? HL_PRESETS : PEN_PRESETS);
  const resolvedColor = $derived(resolveInk(activeColor, theme.dark));

  const toolButtons: { tool: ToolKind; icon: typeof Pen; label: string; key: string }[] = [
    { tool: 'pen', icon: Pen, label: 'Pen', key: 'P' },
    { tool: 'highlighter', icon: Highlighter, label: 'Highlighter', key: 'H' },
    { tool: 'eraser', icon: Eraser, label: 'Eraser', key: 'E' },
    { tool: 'lasso', icon: Lasso, label: 'Lasso', key: 'S' },
  ];

  function setColor(color: string) {
    if (drawTool === 'highlighter') tools.hlColor = color;
    else tools.penColor = color;
  }

  function setWidth(width: number) {
    if (drawTool === 'highlighter') tools.hlWidth = width;
    else tools.penWidth = width;
  }

  function togglePopover(which: 'color' | 'width') {
    if (popover === which) {
      popover = null;
      return;
    }
    below = (island?.getBoundingClientRect().top ?? 400) < 320;
    popover = which;
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

<div class="island" bind:this={island} {style}>
  {#if popover === 'color'}
    <div class="popover" class:below>
      <SwatchGrid selected={activeColor} onpick={setColor} />
    </div>
  {:else if popover === 'width'}
    <div class="popover" class:below>
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
              style:width={`${Math.min(4 + preset * 1.6, 22)}px`}
              style:height={`${Math.min(4 + preset * 1.6, 22)}px`}
              style:background={resolvedColor}
            ></span>
          </button>
        {/each}
        <span class="width-value">{activeWidth}px</span>
      </div>
      <input
        class="width-slider"
        type="range"
        min="1"
        max="32"
        step="0.5"
        value={activeWidth}
        aria-label="Stroke width"
        oninput={(e) => setWidth(Number(e.currentTarget.value))}
      />
      <div class="preview-well">
        <span
          class="preview-dot"
          style:width={`${activeWidth}px`}
          style:height={`${activeWidth}px`}
          style:background={resolvedColor}
        ></span>
      </div>
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
      onclick={() => (tools.tool = tb.tool)}
    >
      <tb.icon size={18} strokeWidth={1.5} />
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
    onclick={() => togglePopover('color')}
  >
    <span class="ink-dot" style:background={resolvedColor}></span>
  </button>
  <button
    class="tool width-btn"
    title="Stroke width  [ ]"
    aria-label="Stroke width"
    onclick={() => togglePopover('width')}
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
  .popover {
    position: absolute;
    bottom: calc(100% + 10px);
    left: 50%;
    transform: translateX(-50%);
    min-width: 200px;
    padding: 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: var(--shadow-sheet);
    animation: rise 160ms ease-out;
  }
  .popover.below {
    bottom: auto;
    top: calc(100% + 10px);
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translate(-50%, 8px);
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
</style>
