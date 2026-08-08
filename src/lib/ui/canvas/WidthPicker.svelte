<script lang="ts">
  // Shared by the island popover and the floating picker.
  import { resolveInk } from '$lib/ink/engine';
  import { theme } from '$lib/store/theme.svelte';
  import {
    ERASER_MAX,
    ERASER_MIN,
    colorOf,
    presetsOf,
    setWidthOn,
    widthOf,
    type ToolState,
  } from './tool-state';

  let { tools }: { tools: ToolState } = $props();

  const isEraser = $derived(tools.tool === 'eraser');
  const width = $derived(widthOf(tools));
  const presets = $derived(presetsOf(tools));
  const resolvedColor = $derived(resolveInk(colorOf(tools), theme.dark));

  function presetDotSize(preset: number): number {
    return isEraser ? Math.min(4 + preset, 22) : Math.min(4 + preset * 1.6, 22);
  }
</script>

<div class="width-presets">
  {#each presets as preset (preset)}
    <button
      class="preset"
      class:active={Math.abs(width - preset) < 0.01}
      aria-label={`Width ${preset}`}
      onclick={() => setWidthOn(tools, preset)}
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
  <span class="width-value">{width}px</span>
</div>
<input
  class="width-slider"
  type="range"
  min={isEraser ? ERASER_MIN : 1}
  max={isEraser ? ERASER_MAX : 32}
  step={isEraser ? 1 : 0.5}
  value={width}
  aria-label={isEraser ? 'Eraser size' : 'Stroke width'}
  oninput={(e) => setWidthOn(tools, Number(e.currentTarget.value))}
/>
<div class="preview-well">
  <span
    class="preview-dot"
    class:hollow={isEraser}
    style:width={`${isEraser ? Math.min(width * 2, 40) : width}px`}
    style:height={`${isEraser ? Math.min(width * 2, 40) : width}px`}
    style:background={isEraser ? 'transparent' : resolvedColor}
  ></span>
</div>

<style>
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
