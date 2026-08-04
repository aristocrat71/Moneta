<script lang="ts">
  import { ui } from '$lib/store/ui.svelte';
  import { settings } from '$lib/store/settings.svelte';
  import { theme } from '$lib/store/theme.svelte';
  import { library } from '$lib/store/library.svelte';
  import { X } from '@lucide/svelte';

  const prefs = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ] as const;

  function onkeydown(e: KeyboardEvent) {
    if (ui.settingsOpen && e.key === 'Escape') {
      e.stopPropagation();
      ui.settingsOpen = false;
    }
  }

  function setGamma(v: number) {
    settings.data.pressureGamma = v;
    settings.save();
  }
</script>

<svelte:window {onkeydown} />

{#if ui.settingsOpen}
  <div
    class="scrim"
    role="presentation"
    onpointerdown={(e) => {
      if (e.target === e.currentTarget) ui.settingsOpen = false;
    }}
  >
    <div class="sheet" role="dialog" aria-label="Settings">
      <header>
        <h2>Settings</h2>
        <button
          class="close"
          aria-label="Close settings"
          onclick={() => (ui.settingsOpen = false)}
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      </header>

      <div class="row">
        <span class="label">Theme</span>
        <div class="segments">
          {#each prefs as pref (pref.value)}
            <button
              class="segment"
              class:active={settings.data.theme === pref.value}
              onclick={() => theme.setPref(pref.value)}
            >
              {pref.label}
            </button>
          {/each}
        </div>
      </div>

      <div class="row">
        <span class="label">Pressure curve</span>
        <div class="slider-row">
          <span class="hint">soft</span>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.05"
            value={settings.data.pressureGamma}
            oninput={(e) => setGamma(Number(e.currentTarget.value))}
          />
          <span class="hint">firm</span>
        </div>
      </div>

      <div class="row">
        <span class="label">Storage</span>
        <span class="path">{library.root || '~/Moneta'}</span>
      </div>
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
    width: 380px;
    padding: 20px;
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
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }
  h2 {
    font-size: 15px;
    font-weight: 600;
  }
  .close {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    color: var(--text-muted);
  }
  .close:hover {
    background: var(--surface-2);
    color: var(--text);
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 10px 0;
    border-top: 1px solid var(--border);
  }
  .label {
    font-size: 13px;
  }
  .segments {
    display: flex;
    gap: 2px;
    padding: 2px;
    background: var(--surface-2);
    border-radius: 8px;
  }
  .segment {
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    color: var(--text-muted);
  }
  .segment.active {
    background: var(--surface);
    color: var(--text);
    box-shadow: 0 0 0 1px var(--border);
  }
  .slider-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .slider-row input {
    width: 140px;
    accent-color: var(--accent);
  }
  .hint {
    font-size: 12px;
    color: var(--text-muted);
  }
  .path {
    font-size: 12px;
    color: var(--text-muted);
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
