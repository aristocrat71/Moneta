<script lang="ts">
  // Dev-only tweak panel (?dev): live engine stats + feel constants.
  import type { InkEngine } from '$lib/ink/engine';
  import { settings } from '$lib/store/settings.svelte';

  let { engine }: { engine: InkEngine } = $props();

  let stats = $state({ wetFrameMs: 0, inputToPaintMs: 0, movesPerSec: 0, activePoints: 0 });
  // The engine is deliberately non-reactive; seeding from it once is intended.
  // svelte-ignore state_referenced_locally
  let tuning = $state({ ...engine.getTuning() });

  $effect(() => {
    const timer = setInterval(() => {
      stats = { ...engine.stats };
    }, 250);
    return () => clearInterval(timer);
  });

  function set(key: 'thinning' | 'smoothing' | 'streamline' | 'pressureGamma', v: number) {
    tuning[key] = v;
    engine.setTuning({ [key]: v });
    if (key === 'pressureGamma') {
      settings.data.pressureGamma = v;
      settings.save();
    }
  }
</script>

<div class="hud">
  <div class="row mono">
    wet {stats.wetFrameMs.toFixed(2)}ms · in→paint {stats.inputToPaintMs.toFixed(1)}ms
  </div>
  <div class="row mono">{stats.movesPerSec} moves/s · {stats.activePoints} pts</div>
  {#each [['thinning', 0, 1], ['smoothing', 0, 1], ['streamline', 0, 1], ['pressureGamma', 0.5, 2]] as [key, min, max] (key)}
    <label class="row">
      <span>{key}</span>
      <input
        type="range"
        {min}
        {max}
        step="0.05"
        value={tuning[key as 'thinning']}
        oninput={(e) =>
          set(key as 'thinning', Number((e.currentTarget as HTMLInputElement).value))}
      />
      <span class="val">{tuning[key as 'thinning'].toFixed(2)}</span>
    </label>
  {/each}
</div>

<style>
  .hud {
    position: fixed;
    top: 48px;
    right: 12px;
    z-index: 90;
    width: 240px;
    padding: 10px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: var(--shadow-card);
    font-size: 11px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 0;
  }
  .row span:first-child {
    width: 90px;
  }
  .row input {
    flex: 1;
    accent-color: var(--accent);
  }
  .val {
    width: 32px;
    text-align: right;
    color: var(--text-muted);
  }
  .mono {
    color: var(--text-muted);
  }
</style>
