<script lang="ts">
  import { library } from '$lib/store/library.svelte';
  import { theme } from '$lib/store/theme.svelte';
  import { pagesLabel, relTime } from '$lib/util/format';
  import { preview } from './preview.svelte';

  const WIDTH = 240;
  const MARGIN = 16;
  const GAP = 16;

  let height = $state(320);

  const nb = $derived(preview.nb);
  const thumb = $derived(nb ? library.thumbSrc(nb.id, theme.dark) : null);
  const left = $derived(
    Math.max(MARGIN, Math.min(preview.anchorRight + GAP, window.innerWidth - WIDTH - MARGIN)),
  );
  const top = $derived(
    Math.max(MARGIN, Math.min(preview.anchorTop - 10, window.innerHeight - height - MARGIN)),
  );
</script>

{#if nb && thumb}
  <div
    class="preview"
    aria-hidden="true"
    bind:clientHeight={height}
    style:left="{left}px"
    style:top="{top}px"
    style:width="{WIDTH}px"
  >
    <img src={thumb} alt="" />
    <div class="foot">
      <span class="title">{nb.title}</span>
      <span class="meta">{pagesLabel(nb.pageCount)} · {relTime(nb.modifiedAt)}</span>
    </div>
  </div>
{/if}

<style>
  .preview {
    position: fixed;
    z-index: 40;
    padding: 6px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: var(--shadow-sheet);
    pointer-events: none;
    animation: rise 160ms ease-out;
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
  }
  img {
    display: block;
    width: 100%;
    aspect-ratio: 10 / 13;
    object-fit: cover;
    object-position: top;
    background: var(--canvas);
    border-radius: 6px;
  }
  .foot {
    display: flex;
    flex-direction: column;
    padding: 8px 4px 2px;
  }
  .title {
    font-size: 13px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .meta {
    font-size: 12px;
    color: var(--text-muted);
  }
</style>
