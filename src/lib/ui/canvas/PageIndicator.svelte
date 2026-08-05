<script lang="ts">
  // Bottom-right status: where you are in the notebook, and — when the window
  // has handed the pointer through — the one key that takes it back.
  import { session } from '$lib/store/session.svelte';

  let { hidden, passThrough = false }: { hidden: boolean; passThrough?: boolean } = $props();
</script>

<div class="corner" class:hidden>
  {#if passThrough}
    <span class="pill through">click-through · ⎋</span>
  {/if}
  <span class="pill">p {session.currentPage + 1}/{session.pageCount}</span>
</div>

<style>
  .corner {
    position: absolute;
    right: 20px;
    bottom: 24px;
    z-index: 25;
    display: flex;
    align-items: center;
    gap: 6px;
    pointer-events: none;
    transition: opacity 200ms ease-out;
  }
  .corner.hidden {
    opacity: 0;
  }
  .pill {
    padding: 3px 10px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 999px;
    font-size: 12px;
    color: var(--text-muted);
  }
  /* The only thing on screen that still answers, so it says so in accent. */
  .through {
    border-color: var(--accent);
    color: var(--text);
  }
</style>
