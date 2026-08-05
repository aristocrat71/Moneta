<script lang="ts">
  // Where you are in the notebook. Bottom-right, out of the island's way,
  // and it fades with the top bar the moment the pen touches down.
  import { session } from '$lib/store/session.svelte';

  let { hidden }: { hidden: boolean } = $props();
</script>

<span class="pages" class:hidden aria-live="off">
  p {session.currentPage + 1}/{session.pageCount}
</span>

<style>
  .pages {
    position: absolute;
    right: 20px;
    bottom: 24px;
    z-index: 25;
    padding: 3px 10px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 999px;
    font-size: 12px;
    color: var(--text-muted);
    pointer-events: none;
    transition: opacity 200ms ease-out;
  }
  .pages.hidden {
    opacity: 0;
  }
</style>
