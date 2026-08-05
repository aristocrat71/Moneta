<script lang="ts">
  // About Moneta — opened from the wordmark. Says what the app is and which
  // copy of it you're running, and nothing else.
  import { base } from '$app/paths';
  import { appInfo } from '$lib/store/app.svelte';
  import { ui } from '$lib/store/ui.svelte';

  function onkeydown(e: KeyboardEvent) {
    if (ui.aboutOpen && e.key === 'Escape') {
      e.stopPropagation();
      ui.aboutOpen = false;
    }
  }
</script>

<svelte:window {onkeydown} />

{#if ui.aboutOpen}
  <div
    class="scrim"
    role="presentation"
    onpointerdown={(e) => {
      if (e.target === e.currentTarget) ui.aboutOpen = false;
    }}
  >
    <div class="sheet" role="dialog" aria-label="About Moneta">
      <img class="logo" src="{base}/logo.png" alt="" draggable="false" />
      <h2>{appInfo.name}</h2>
      <p class="desc">{appInfo.description}</p>
      {#if appInfo.version}
        <p class="version">Version {appInfo.version}</p>
      {/if}
      <button class="btn" onclick={() => (ui.aboutOpen = false)}>Close</button>
    </div>
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: grid;
    place-items: center;
    background: var(--scrim);
  }
  .sheet {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    width: 300px;
    padding: 28px 24px 20px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: var(--shadow-sheet);
    animation: rise 160ms ease-out;
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
  }
  .logo {
    width: 72px;
    height: 72px;
    border-radius: 16px;
  }
  h2 {
    font-size: 16px;
    font-weight: 600;
  }
  .desc {
    font-size: 13px;
    color: var(--text-muted);
    text-align: center;
    text-wrap: balance;
  }
  .version {
    font-size: 12px;
    color: var(--text-muted);
  }
  .btn {
    margin-top: 12px;
    padding: 7px 14px;
    border-radius: 8px;
    border: 1px solid var(--border);
    font-size: 13px;
    font-weight: 500;
  }
  .btn:hover {
    background: var(--surface-2);
  }
</style>
