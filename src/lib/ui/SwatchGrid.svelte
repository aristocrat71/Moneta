<script lang="ts">
  // The curated 2×6 ink grid + recents + custom color. Swatches preview in
  // the current theme's resolved hue.
  import { INKS, resolveInk } from '$lib/ink/engine';
  import { theme } from '$lib/store/theme.svelte';
  import { settings } from '$lib/store/settings.svelte';

  let {
    selected,
    onpick,
  }: {
    selected: string;
    onpick: (color: string) => void;
  } = $props();

  let hexDraft = $state('');

  function pickCustom(color: string) {
    const recents = settings.data.recentColors.filter((c) => c !== color);
    recents.unshift(color);
    settings.data.recentColors = recents.slice(0, 6);
    settings.save();
    onpick(color);
  }

  function commitHex() {
    let v = hexDraft.trim();
    if (!v) return;
    if (!v.startsWith('#')) v = `#${v}`;
    if (/^#[0-9a-fA-F]{6}$/.test(v) || /^#[0-9a-fA-F]{3}$/.test(v)) {
      pickCustom(v.toLowerCase());
      hexDraft = '';
    }
  }
</script>

<div class="swatches" role="listbox" aria-label="Ink color">
  {#each INKS as ink, i (ink.id)}
    <button
      class="swatch"
      class:selected={selected === ink.id}
      style:background={resolveInk(ink.id, theme.dark)}
      role="option"
      aria-selected={selected === ink.id}
      aria-label={ink.name}
      title={i < 9 ? `${ink.name}  ${i + 1}` : ink.name}
      onclick={() => onpick(ink.id)}
    ></button>
  {/each}
</div>

{#if settings.data.recentColors.length > 0}
  <div class="recent-row">
    {#each settings.data.recentColors as color (color)}
      <button
        class="swatch small"
        class:selected={selected === color}
        style:background={color}
        aria-label={color}
        title={color}
        onclick={() => onpick(color)}
      ></button>
    {/each}
  </div>
{/if}

<div class="custom">
  <input
    class="hex"
    placeholder="#4a6b8a"
    maxlength="7"
    bind:value={hexDraft}
    onkeydown={(e) => {
      if (e.key === 'Enter') commitHex();
      e.stopPropagation();
    }}
    onblur={commitHex}
  />
  <input
    class="wheel"
    type="color"
    aria-label="Pick a custom color"
    onchange={(e) => pickCustom(e.currentTarget.value)}
  />
</div>

<style>
  .swatches {
    display: grid;
    grid-template-columns: repeat(6, 24px);
    gap: 8px;
  }
  .swatch {
    width: 24px;
    height: 24px;
    border-radius: 999px;
    border: 1px solid var(--border);
  }
  .swatch.small {
    width: 18px;
    height: 18px;
  }
  .swatch.selected {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .recent-row {
    display: flex;
    gap: 8px;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--border);
  }
  .custom {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--border);
  }
  .hex {
    flex: 1;
    min-width: 0;
    padding: 5px 8px;
    font-size: 12px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 6px;
  }
  .hex:focus {
    outline: none;
    border-color: var(--accent);
  }
  .wheel {
    width: 26px;
    height: 26px;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: none;
  }
</style>
