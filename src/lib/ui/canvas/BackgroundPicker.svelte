<script lang="ts">
  // Page background for the whole notebook. Chips, not words — a background is
  // a thing you recognise faster than you read.
  import { LayoutTemplate, MousePointerClick } from '@lucide/svelte';
  import type { TemplateKind } from '$lib/ink/engine';

  let {
    template,
    onpick,
    glass,
    glassOpacity,
    passThrough,
    onglass,
    onopacity,
    onpassthrough,
  }: {
    template: TemplateKind;
    onpick: (t: TemplateKind) => void;
    /** Glass lives for as long as the notebook is open — it is never stored,
     *  so the page keeps its real background underneath. */
    glass: boolean;
    glassOpacity: number;
    passThrough: boolean;
    onglass: (on: boolean) => void;
    onopacity: (v: number) => void;
    onpassthrough: () => void;
  } = $props();

  const TEMPLATES: { kind: TemplateKind; label: string }[] = [
    { kind: 'blank', label: 'Blank' },
    { kind: 'ruled', label: 'Ruled' },
    { kind: 'grid', label: 'Grid' },
    { kind: 'dotted', label: 'Dotted' },
  ];

  let open = $state(false);
  let anchor = $state<HTMLDivElement | null>(null);

  // Nothing may be left hanging over the source once the pointer is gone —
  // the panel could not be dismissed by clicking it.
  $effect(() => {
    if (passThrough) open = false;
  });

  $effect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!anchor?.contains(e.target as Node)) open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        open = false;
      }
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  });

  function pick(kind: TemplateKind) {
    open = false;
    if (glass) onglass(false);
    if (kind !== template) onpick(kind);
  }
</script>

<div class="anchor" bind:this={anchor}>
  <button
    class="trigger"
    class:open
    title="Page background"
    aria-label="Page background"
    aria-expanded={open}
    onclick={() => (open = !open)}
  >
    <LayoutTemplate size={16} strokeWidth={1.5} />
  </button>

  {#if open}
    <div class="panel" role="menu" aria-label="Page background">
      <div class="chips">
        {#each TEMPLATES as t (t.kind)}
          <button
            class="option"
            class:current={!glass && t.kind === template}
            role="menuitemradio"
            aria-checked={!glass && t.kind === template}
            onclick={() => pick(t.kind)}
          >
            <span class="chip {t.kind}"></span>
            <span class="label">{t.label}</span>
          </button>
        {/each}
        <span class="divider"></span>
        <button
          class="option"
          class:current={glass}
          role="menuitemradio"
          aria-checked={glass}
          title="See through to whatever is behind the window  G G"
          onclick={() => onglass(!glass)}
        >
          <span class="chip glass"></span>
          <span class="label">Glass</span>
        </button>
      </div>

      {#if glass}
        <label class="opacity">
          <span>Paper</span>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={Math.round(glassOpacity * 100)}
            oninput={(e) => onopacity(Number(e.currentTarget.value) / 100)}
          />
          <span class="value">{Math.round(glassOpacity * 100)}%</span>
        </label>
        <button
          class="through"
          title="The window stops taking the pointer, so the app behind it does"
          onclick={() => {
            open = false;
            onpassthrough();
          }}
        >
          <MousePointerClick size={13} strokeWidth={1.5} />
          <span>Click through</span>
          <kbd>J J</kbd>
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .anchor {
    position: relative;
    display: flex;
    align-items: center;
  }
  .trigger {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 6px;
    color: var(--text-muted);
  }
  .trigger:hover,
  .trigger.open {
    background: var(--surface-2);
    color: var(--text);
  }
  .panel {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    z-index: 50;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 6px;
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
  .chips {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .divider {
    width: 1px;
    align-self: stretch;
    margin: 4px 2px;
    background: var(--border);
  }
  .option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    padding: 6px 6px 5px;
    border-radius: 8px;
    font-size: 11px;
    color: var(--text-muted);
  }
  .option:hover {
    background: var(--surface-2);
    color: var(--text);
  }
  .option.current {
    color: var(--text);
  }
  /* Chips draw the real templates: 24px page units ≈ 4px here. */
  .chip {
    width: 34px;
    height: 44px;
    background: var(--canvas);
    border: 1px solid var(--border);
    border-radius: 3px;
  }
  .option.current .chip {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
  }
  .chip.ruled {
    background-image: repeating-linear-gradient(
      to bottom,
      transparent 0 5px,
      var(--template-line) 5px 6px
    );
    background-position: 0 6px;
    background-size: 100% 100%;
  }
  .chip.grid {
    background-image:
      repeating-linear-gradient(to bottom, transparent 0 5px, var(--template-line) 5px 6px),
      repeating-linear-gradient(to right, transparent 0 5px, var(--template-line) 5px 6px);
  }
  .chip.dotted {
    background-image: radial-gradient(var(--template-line) 0.8px, transparent 0.9px);
    background-size: 6px 6px;
    background-position: 3px 3px;
  }
  /* The universal "nothing here" checkerboard. */
  .chip.glass {
    background:
      conic-gradient(
          from 90deg at 50% 50%,
          var(--surface-2) 0 25%,
          transparent 0 50%,
          var(--surface-2) 0 75%,
          transparent 0
        )
        0 0 / 10px 10px,
      var(--surface);
  }
  .opacity {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 6px 2px;
    border-top: 1px solid var(--border);
    font-size: 11px;
    color: var(--text-muted);
  }
  .opacity input {
    flex: 1;
    width: 100px;
    accent-color: var(--accent);
  }
  .value {
    width: 34px;
    text-align: right;
  }
  .through {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border-radius: 6px;
    font-size: 12px;
    color: var(--text-muted);
    text-align: left;
  }
  .through:hover {
    background: var(--surface-2);
    color: var(--text);
  }
  .through span {
    flex: 1;
  }
  kbd {
    font: inherit;
    font-size: 11px;
    color: var(--text-muted);
  }
</style>
