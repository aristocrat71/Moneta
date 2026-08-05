<script lang="ts">
  import type { InkEngine, PageWindow } from '$lib/ink/engine';
  import type { DocPage } from '$lib/doc/model';

  let {
    page,
    index,
    zoom,
    active,
    engine,
    windowFor,
    glass = false,
  }: {
    page: DocPage;
    index: number;
    zoom: number;
    active: boolean;
    engine: InkEngine;
    windowFor: (index: number, page: DocPage) => PageWindow;
    /** See-through mode: the sheet keeps only its outline, and the paper such
     *  as it is comes from the canvas itself (ThemePaint.paperAlpha). */
    glass?: boolean;
  } = $props();

  let el = $state<HTMLDivElement | null>(null);
  let canvas = $state<HTMLCanvasElement | null>(null);

  $effect(() => {
    if (!active || !el || !canvas) return;
    engine.registerPage({
      id: page.id,
      el,
      canvas,
      size: page.size,
      template: page.template,
      getStrokes: () => page.strokes,
      getWindow: () => windowFor(index, page),
    });
    return () => engine.unregisterPage(page.id);
  });
</script>

<div
  class="sheet"
  class:glass
  bind:this={el}
  style:width={`${page.size.w * zoom}px`}
  style:height={`${page.size.h * zoom}px`}
>
  {#if active}
    <canvas bind:this={canvas}></canvas>
  {/if}
</div>

<style>
  .sheet {
    position: relative;
    background: var(--canvas);
    /* Hairline via shadow so the border never shifts ink geometry. */
    box-shadow:
      0 0 0 1px var(--border),
      var(--shadow-page);
    border-radius: 2px;
    overflow: hidden;
    touch-action: none;
    cursor: crosshair;
  }
  /* Only the outline survives — it's the one cue for where the page ends. */
  .sheet.glass {
    background: transparent;
    box-shadow: 0 0 0 1px var(--border);
  }
  canvas {
    position: absolute;
    display: block;
  }
</style>
