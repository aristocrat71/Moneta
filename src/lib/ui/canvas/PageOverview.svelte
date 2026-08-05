<script lang="ts">
  // Page overview sheet: jump, drag to reorder, add (with template), delete.
  import { Plus, X } from '@lucide/svelte';
  import { session } from '$lib/store/session.svelte';
  import { theme } from '$lib/store/theme.svelte';
  import { getThemePaint } from '$lib/ui/theme-paint';
  import { DEFAULT_TUNING, renderPageBitmap, type TemplateKind } from '$lib/ink/engine';

  let {
    open = $bindable(false),
    onJump,
    onAddPage,
    onDeletePage,
    onReorder,
  }: {
    open?: boolean;
    onJump: (index: number) => void;
    onAddPage: (template: TemplateKind) => void;
    onDeletePage: (pageId: string) => void;
    onReorder: (from: number, to: number) => void;
  } = $props();

  const TEMPLATES: TemplateKind[] = ['blank', 'ruled', 'grid', 'dotted'];

  let thumbs = $state<string[]>([]);
  let dragFrom = $state<number | null>(null);
  let dragOver = $state<number | null>(null);
  let picking = $state(false);
  let tiles = $state<(HTMLDivElement | null)[]>([]);

  // Opening the sheet lands you on the page you were writing on.
  $effect(() => {
    if (open) tiles[session.currentPage]?.scrollIntoView({ block: 'nearest' });
  });

  $effect(() => {
    void session.rev;
    void theme.dark;
    if (!open || !session.doc) {
      thumbs = [];
      picking = false;
      return;
    }
    const paint = getThemePaint(theme.dark);
    thumbs = session.doc.pages.map((p) =>
      renderPageBitmap({
        strokes: p.strokes,
        template: p.template,
        size: p.size,
        paint,
        tuning: DEFAULT_TUNING,
        width: 200,
      }).toDataURL(),
    );
  });

  function onkeydown(e: KeyboardEvent) {
    if (open && e.key === 'Escape') {
      e.stopPropagation();
      open = false;
    }
  }

  function drop(target: number) {
    if (dragFrom !== null && dragFrom !== target) onReorder(dragFrom, target);
    dragFrom = null;
    dragOver = null;
  }
</script>

<svelte:window {onkeydown} />

{#if open && session.doc}
  <div
    class="scrim"
    role="presentation"
    onpointerdown={(e) => {
      if (e.target === e.currentTarget) open = false;
    }}
  >
    <div class="sheet" role="dialog" aria-label="Pages">
      <div class="grid">
        {#each session.doc.pages as p, i (p.id)}
          <div
            class="tile"
            class:current={i === session.currentPage}
            class:drop-target={dragOver === i && dragFrom !== null && dragFrom !== i}
            bind:this={tiles[i]}
            role="button"
            tabindex="0"
            aria-current={i === session.currentPage ? 'page' : undefined}
            draggable="true"
            ondragstart={(e) => {
              dragFrom = i;
              e.dataTransfer?.setData('text/plain', String(i));
            }}
            ondragover={(e) => {
              e.preventDefault();
              dragOver = i;
            }}
            ondrop={(e) => {
              e.preventDefault();
              drop(i);
            }}
            ondragend={() => {
              dragFrom = null;
              dragOver = null;
            }}
            onclick={() => {
              open = false;
              onJump(i);
            }}
            onkeydown={(e) => {
              if (e.key === 'Enter') {
                open = false;
                onJump(i);
              }
            }}
          >
            {#if thumbs[i]}
              <img src={thumbs[i]} alt={`Page ${i + 1}`} draggable="false" />
            {/if}
            <span class="num">{i + 1}</span>
            {#if session.doc.pages.length > 1}
              <button
                class="del"
                title="Delete page"
                aria-label={`Delete page ${i + 1}`}
                onclick={(e) => {
                  e.stopPropagation();
                  onDeletePage(p.id);
                }}
              >
                <X size={12} strokeWidth={1.5} />
              </button>
            {/if}
          </div>
        {/each}

        <div class="tile add" class:picking>
          {#if picking}
            <div class="templates">
              {#each TEMPLATES as t (t)}
                <button
                  onclick={() => {
                    picking = false;
                    onAddPage(t);
                  }}
                >
                  {t}
                </button>
              {/each}
            </div>
          {:else}
            <button class="plus" aria-label="Add page" onclick={() => (picking = true)}>
              <Plus size={20} strokeWidth={1.5} />
            </button>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: grid;
    place-items: center;
    background: var(--scrim);
    animation: fade 180ms ease-out;
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
  }
  .sheet {
    width: min(720px, calc(100vw - 96px));
    max-height: calc(100vh - 120px);
    overflow-y: auto;
    padding: 20px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: var(--shadow-sheet);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, 132px);
    gap: 16px;
    justify-content: center;
  }
  .tile {
    position: relative;
    width: 132px;
    height: 176px;
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
    background: var(--canvas);
    cursor: pointer;
  }
  .tile:hover {
    box-shadow: var(--shadow-card);
  }
  .tile.drop-target {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  /* Where you are: the only accent in the sheet. */
  .tile.current {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
  }
  .tile img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top;
  }
  .num {
    position: absolute;
    left: 6px;
    bottom: 4px;
    font-size: 12px;
    color: var(--text-muted);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0 5px;
  }
  .tile.current .num {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-ink);
  }
  .del {
    position: absolute;
    top: 4px;
    right: 4px;
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text-muted);
    opacity: 0;
    transition: opacity 120ms ease-out;
  }
  .tile:hover .del,
  .del:focus-visible {
    opacity: 1;
  }
  .del:hover {
    color: var(--danger);
  }
  .add {
    display: grid;
    place-items: center;
    border-style: dashed;
    background: transparent;
    cursor: default;
  }
  .plus {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    color: var(--text-muted);
  }
  .plus:hover {
    color: var(--text);
    background: var(--surface-2);
  }
  .templates {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
    padding: 8px;
  }
  .templates button {
    padding: 6px 8px;
    border-radius: 6px;
    font-size: 12px;
    text-transform: capitalize;
    text-align: left;
  }
  .templates button:hover {
    background: var(--surface-2);
  }
</style>
