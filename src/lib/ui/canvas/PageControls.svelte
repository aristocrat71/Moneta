<script lang="ts">
  // Bottom-right cluster: where you are, how to see every page, and — when the
  // window has handed the pointer through — the one key that takes it back.
  import { LayoutGrid } from '@lucide/svelte';
  import { session } from '$lib/store/session.svelte';

  let {
    hidden,
    passThrough = false,
    overviewOpen = $bindable(false),
  }: {
    hidden: boolean;
    passThrough?: boolean;
    overviewOpen?: boolean;
  } = $props();
</script>

<div class="corner" class:hidden>
  {#if passThrough}
    <span class="pill through">click-through · ⎋</span>
  {/if}
  <span class="pill">p {session.currentPage + 1}/{session.pageCount}</span>
  <button
    class="overview"
    class:active={overviewOpen}
    class:dimmed={passThrough}
    title="Pages"
    aria-label="Page overview"
    onclick={() => (overviewOpen = !overviewOpen)}
  >
    <LayoutGrid size={16} strokeWidth={1.5} />
  </button>
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
    /* Status is for reading; only the button takes the pointer. */
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
  .overview {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 999px;
    color: var(--text-muted);
    pointer-events: auto;
    transition: opacity 200ms ease-out;
  }
  .overview:hover,
  .overview.active {
    color: var(--text);
    background: var(--surface-2);
  }
  .overview.dimmed {
    opacity: 0.5;
  }
</style>
