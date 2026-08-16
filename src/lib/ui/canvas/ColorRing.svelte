<script lang="ts">
  // `c c`: the ink palette laid out around the nib, not in a panel beside it.
  import { Highlighter, Pen, Plus } from '@lucide/svelte';
  import { INKS, resolveInk } from '$lib/ink/engine';
  import { settings } from '$lib/store/settings.svelte';
  import { theme } from '$lib/store/theme.svelte';
  import { rememberColor } from '$lib/ui/recent-colors';
  import { dismissOutside } from './dismiss';
  import { RING, ringCenter, ringSlots, type RingPoint } from './ring';
  import { colorOf, drawToolOf, setColorOn, type ToolState } from './tool-state';

  let {
    at,
    tools,
    onclose,
  }: {
    /** Pointer position in client coordinates. */
    at: { x: number; y: number };
    tools: ToolState;
    onclose: () => void;
  } = $props();

  const selected = $derived(colorOf(tools));
  const resolvedColor = $derived(resolveInk(selected, theme.dark));
  const NibIcon = $derived(drawToolOf(tools) === 'highlighter' ? Highlighter : Pen);
  const recents = $derived(settings.data.recentColors);

  const outer = ringSlots(INKS.length, RING.outerRadius);
  /** The custom chip holds the first inner slot, so recents keep their bearing. */
  const inner = $derived(ringSlots(recents.length + 1, RING.innerRadius));

  const center = $derived(
    ringCenter(at, RING.reach, { w: window.innerWidth, h: window.innerHeight }),
  );

  function place(slot: RingPoint): string {
    return `translate(-50%, -50%) translate(${slot.x}px, ${slot.y}px)`;
  }

  function pick(color: string): void {
    setColorOn(tools, color);
    onclose();
  }

  function pickCustom(color: string): void {
    rememberColor(color);
    pick(color);
  }
</script>

<div
  class="ring"
  use:dismissOutside={onclose}
  style:left={`${center.x}px`}
  style:top={`${center.y}px`}
  style:--size={`${RING.reach * 2}px`}
  style:--band={`${RING.reach - RING.hole}px`}
  style:--hole={`${RING.hole * 2}px`}
  style:--dot={`${RING.outerDot}px`}
  style:--chip={`${RING.innerDot}px`}
  role="dialog"
  aria-label="Ink color"
>
  <!-- One band under both rows; a press on it is ignored, so a missed tap costs nothing. -->
  <div class="band"></div>

  <div class="nib" role="presentation" title="Close" onpointerdown={onclose}>
    <span class="face" style:color={resolvedColor}>
      <NibIcon size={16} strokeWidth={1.5} />
    </span>
  </div>

  {#each INKS as ink, i (ink.id)}
    <button
      class="swatch"
      class:selected={selected === ink.id}
      style:transform={place(outer[i])}
      style:background={resolveInk(ink.id, theme.dark)}
      aria-label={ink.name}
      aria-pressed={selected === ink.id}
      title={ink.name}
      onclick={() => pick(ink.id)}
    ></button>
  {/each}

  <!-- Seeded with the current ink: `change` never fires for the value it already holds. -->
  <span class="chip custom" style:transform={place(inner[0])} title="Custom color">
    <Plus size={11} strokeWidth={2} />
    <input
      type="color"
      aria-label="Pick a custom color"
      value={resolvedColor}
      onchange={(e) => pickCustom(e.currentTarget.value)}
    />
  </span>

  {#each recents as color, i (color)}
    <button
      class="chip"
      class:selected={selected === color}
      style:transform={place(inner[i + 1])}
      style:background={color}
      aria-label={color}
      aria-pressed={selected === color}
      title={color}
      onclick={() => pickCustom(color)}
    ></button>
  {/each}
</div>

<style>
  .ring {
    position: fixed;
    z-index: 35;
    width: var(--size);
    height: var(--size);
    transform: translate(-50%, -50%);
    pointer-events: none;
    animation: bloom 140ms ease-out;
  }
  @keyframes bloom {
    from {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.92);
    }
  }
  /* A circle whose border is the band, so the hole stays the page. */
  .band {
    position: absolute;
    inset: 0;
    border: var(--band) solid var(--surface);
    border-radius: 50%;
    box-shadow:
      var(--shadow-sheet),
      0 0 0 1px var(--border),
      inset 0 0 0 1px var(--border);
    pointer-events: auto;
  }
  .nib {
    position: absolute;
    top: 50%;
    left: 50%;
    display: grid;
    place-items: center;
    width: var(--hole);
    height: var(--hole);
    border-radius: 50%;
    transform: translate(-50%, -50%);
    pointer-events: auto;
  }
  .face {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 999px;
  }
  .swatch,
  .chip {
    position: absolute;
    top: 50%;
    left: 50%;
    width: var(--dot);
    height: var(--dot);
    border: 1px solid var(--border);
    border-radius: 999px;
    pointer-events: auto;
  }
  .chip {
    width: var(--chip);
    height: var(--chip);
  }
  .swatch:hover,
  .chip:hover {
    outline: 2px solid var(--text-muted);
    outline-offset: 2px;
  }
  .swatch.selected,
  .chip.selected,
  .swatch.selected:hover,
  .chip.selected:hover {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .custom {
    display: grid;
    place-items: center;
    background: var(--surface-2);
    color: var(--text-muted);
  }
  .custom:hover {
    color: var(--text);
  }
  .custom input {
    position: absolute;
    inset: 0;
    opacity: 0;
    border: none;
    padding: 0;
    background: none;
    cursor: pointer;
  }
</style>
