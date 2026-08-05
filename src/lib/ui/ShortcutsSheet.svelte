<script lang="ts">
  // The shortcuts sheet, and optionally the small keyboard button that opens
  // it. The canvas asks for no button — nothing floats over the page that ⌘/
  // can't do — so there it is keyboard-only.
  import { Keyboard, X } from '@lucide/svelte';
  import type { ShortcutGroup } from './shortcuts';

  let {
    groups,
    title,
    launcher = true,
  }: {
    groups: ShortcutGroup[];
    title: string;
    /** Show the bottom-right keyboard button as well as the ⌘/ shortcut. */
    launcher?: boolean;
  } = $props();

  // ⌘/ is handled here rather than in the layout: each screen mounts exactly
  // one of these, so the key that opens the sheet and the state that shows it
  // stay in one component. Routing it through a shared store meant the layout
  // wrote to one module instance while a page-mounted sheet read another.
  let open = $state(false);

  function onkeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === '/') {
      e.preventDefault();
      open = !open;
      return;
    }
    if (open && e.key === 'Escape') {
      e.stopPropagation();
      open = false;
    }
  }
</script>

<svelte:window {onkeydown} />

{#if launcher}
  <button
    class="launcher"
    title="Keyboard shortcuts  ⌘/"
    aria-label="Keyboard shortcuts"
    onclick={() => (open = true)}
  >
    <Keyboard size={16} strokeWidth={1.5} />
  </button>
{/if}

{#if open}
  <div
    class="scrim"
    role="presentation"
    onpointerdown={(e) => {
      if (e.target === e.currentTarget) open = false;
    }}
  >
    <div class="sheet" role="dialog" aria-label={title}>
      <header>
        <h2>{title}</h2>
        <button class="close" aria-label="Close" onclick={() => (open = false)}>
          <X size={16} strokeWidth={1.5} />
        </button>
      </header>

      <div class="groups">
        <!-- Indexed keys, not the values: a run like `2 2` or `G G` repeats the
             same keycap, and a keyed each throws on a duplicate. -->
        {#each groups as group (group.title)}
          <section>
            <h3>{group.title}</h3>
            {#each group.items as item, i (i)}
              <div class="row">
                <span class="keys">
                  {#each item.keys as key, k (k)}
                    <kbd>{key}</kbd>
                  {/each}
                </span>
                <span class="label">{item.label}</span>
              </div>
            {/each}
          </section>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .launcher {
    position: fixed;
    right: 20px;
    bottom: 24px;
    z-index: 20;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    color: var(--text-muted);
    opacity: 0.6;
    transition:
      opacity 120ms ease-out,
      background-color 120ms ease-out;
  }
  .launcher:hover {
    background: var(--surface-2);
    color: var(--text);
    opacity: 1;
  }
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
    width: 420px;
    max-height: 78vh;
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
    margin-bottom: 8px;
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
  .groups {
    overflow-y: auto;
  }
  section {
    padding: 10px 0;
    border-top: 1px solid var(--border);
  }
  h3 {
    margin-bottom: 6px;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .row {
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding: 3px 0;
  }
  .keys {
    display: flex;
    flex: none;
    gap: 4px;
    width: 96px;
  }
  kbd {
    padding: 2px 6px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 5px;
    font-family: inherit;
    font-size: 11px;
    line-height: 1.4;
    color: var(--text);
    white-space: nowrap;
  }
  .label {
    font-size: 13px;
    text-wrap: pretty;
  }
</style>
