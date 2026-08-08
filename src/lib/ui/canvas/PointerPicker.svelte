<script lang="ts">
  // Opens beside the drawing pointer: `c c` and `c s`.
  import { resolveInk } from '$lib/ink/engine';
  import { theme } from '$lib/store/theme.svelte';
  import SwatchGrid from '$lib/ui/SwatchGrid.svelte';
  import WidthPicker from './WidthPicker.svelte';
  import { colorOf, drawToolOf, setColorOn, type ToolState } from './tool-state';

  let {
    mode,
    at,
    tools,
    onclose,
  }: {
    mode: 'color' | 'width';
    /** Pointer position in client coordinates. */
    at: { x: number; y: number };
    tools: ToolState;
    onclose: () => void;
  } = $props();

  const GAP = 18;
  const EDGE = 8;

  let panel = $state<HTMLDivElement | null>(null);
  let left = $state(0);
  let top = $state(0);
  let placed = $state(false);

  const isEraser = $derived(tools.tool === 'eraser');
  const caption = $derived(
    isEraser ? 'Eraser' : drawToolOf(tools) === 'highlighter' ? 'Highlighter' : 'Pen',
  );
  const resolvedColor = $derived(resolveInk(colorOf(tools), theme.dark));

  // Down-right of the pointer, flipping before it runs off.
  $effect(() => {
    const el = panel;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let x = at.x + GAP;
    if (x + w > window.innerWidth - EDGE) x = at.x - GAP - w;
    let y = at.y + GAP;
    if (y + h > window.innerHeight - EDGE) y = at.y - GAP - h;
    left = Math.min(Math.max(EDGE, x), Math.max(EDGE, window.innerWidth - w - EDGE));
    top = Math.min(Math.max(EDGE, y), Math.max(EDGE, window.innerHeight - h - EDGE));
    placed = true;
  });

  // A press outside dismisses without leaving a stray dot.
  $effect(() => {
    const onDown = (e: PointerEvent) => {
      if (panel?.contains(e.target as Node)) return;
      e.preventDefault();
      e.stopPropagation();
      // preventDefault suppresses the blur a typed hex commits on.
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && panel?.contains(focused)) focused.blur();
      onclose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onclose();
      }
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  });

  function pickColor(color: string) {
    setColorOn(tools, color);
    onclose();
  }
</script>

<div
  class="picker"
  class:placed
  bind:this={panel}
  style:left={`${left}px`}
  style:top={`${top}px`}
  role="dialog"
  aria-label={mode === 'color' ? 'Ink color' : isEraser ? 'Eraser size' : 'Stroke width'}
>
  <div class="caption">
    <span class="dot" style:background={isEraser ? 'transparent' : resolvedColor}></span>
    {caption}
  </div>
  {#if mode === 'color'}
    <SwatchGrid selected={colorOf(tools)} onpick={pickColor} />
  {:else}
    <WidthPicker {tools} />
  {/if}
</div>

<style>
  .picker {
    position: fixed;
    z-index: 35;
    min-width: 200px;
    padding: 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: var(--shadow-sheet);
    opacity: 0;
  }
  .picker.placed {
    animation: pop 140ms ease-out forwards;
  }
  @keyframes pop {
    from {
      opacity: 0;
      transform: scale(0.96);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
  .caption {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 10px;
    font-size: 11px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    border: 1px solid var(--border);
  }
</style>
