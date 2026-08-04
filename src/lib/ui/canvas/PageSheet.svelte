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
  }: {
    page: DocPage;
    index: number;
    zoom: number;
    active: boolean;
    engine: InkEngine;
    windowFor: (index: number, page: DocPage) => PageWindow;
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
  canvas {
    position: absolute;
    display: block;
  }
</style>
