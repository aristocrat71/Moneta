<script lang="ts">
  // Opens at the drawing pointer: `c c` rings the nib with ink, `c s` sits beside it.
  import { resolveInk } from '$lib/ink/engine';
  import { theme } from '$lib/store/theme.svelte';
  import ColorRing from './ColorRing.svelte';
  import WidthPicker from './WidthPicker.svelte';
  import { dismissOutside } from './dismiss';
  import { colorOf, drawToolOf, type ToolState } from './tool-state';

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
</script>

{#if mode === 'color'}
  <ColorRing {at} {tools} {onclose} />
{:else}
  <div
    class="picker"
    class:placed
    bind:this={panel}
    use:dismissOutside={onclose}
    style:left={`${left}px`}
    style:top={`${top}px`}
    role="dialog"
    aria-label={isEraser ? 'Eraser size' : 'Stroke width'}
  >
    <div class="caption">
      <span class="dot" style:background={isEraser ? 'transparent' : resolvedColor}></span>
      {caption}
    </div>
    <WidthPicker {tools} />
  </div>
{/if}

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
