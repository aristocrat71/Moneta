<script lang="ts">
  import { goto } from '$app/navigation';
  import { ArrowLeft, ChevronDown, LayoutGrid } from '@lucide/svelte';
  import { session } from '$lib/store/session.svelte';
  import { library } from '$lib/store/library.svelte';
  import Menu from '$lib/ui/Menu.svelte';
  import type { MenuItem } from '$lib/ui/menu';

  let {
    hidden,
    overviewOpen = $bindable(false),
  }: {
    hidden: boolean;
    overviewOpen?: boolean;
  } = $props();

  let renaming = $state(false);
  let draft = $state('');
  let moveOpen = $state(false);
  let input = $state<HTMLInputElement | null>(null);

  $effect(() => {
    if (renaming) input?.select();
  });

  const moveItems = $derived.by((): MenuItem[] => [
    ...library.projects.map((p) => ({
      label: p.name,
      disabled: session.projectId === p.id,
      action: () => {
        session.setProject(p.id);
      },
    })),
    {
      label: 'Unfiled',
      disabled: session.projectId === null,
      action: () => {
        session.setProject(null);
      },
    },
  ]);

  function commitRename() {
    renaming = false;
    if (draft.trim()) session.rename(draft);
  }
</script>

<header class="bar" class:hidden data-tauri-drag-region>
  <button class="back" onclick={() => void goto('/')}>
    <ArrowLeft size={16} strokeWidth={1.5} />
    <span>Library</span>
  </button>

  <div class="center">
    {#if renaming}
      <input
        bind:this={input}
        bind:value={draft}
        class="rename"
        onkeydown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') commitRename();
          if (e.key === 'Escape') renaming = false;
        }}
        onblur={commitRename}
      />
    {:else}
      <button
        class="title"
        title="Rename notebook"
        onclick={() => {
          draft = session.title;
          renaming = true;
        }}
      >
        {session.title}
      </button>
      <div class="menu-anchor">
        <button
          class="caret"
          aria-label="Move to project"
          onclick={() => (moveOpen = !moveOpen)}
          onpointerdown={(e) => e.stopPropagation()}
        >
          <ChevronDown size={14} strokeWidth={1.5} />
        </button>
        <Menu bind:open={moveOpen} items={moveItems} />
      </div>
    {/if}
  </div>

  <div class="right">
    <span class="pages">p {session.currentPage + 1}/{session.pageCount}</span>
    <button
      class="overview"
      class:active={overviewOpen}
      title="Pages"
      aria-label="Page overview"
      onclick={() => (overviewOpen = !overviewOpen)}
    >
      <LayoutGrid size={16} strokeWidth={1.5} />
    </button>
  </div>
</header>

<style>
  .bar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    height: 40px;
    padding: 0 12px 0 84px;
    transition: opacity 200ms ease-out;
  }
  .bar.hidden {
    opacity: 0;
    pointer-events: none;
  }
  .back {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px;
    border-radius: 6px;
    font-size: 13px;
    color: var(--text-muted);
  }
  .back:hover {
    background: var(--surface-2);
    color: var(--text);
  }
  .center {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 2px;
    max-width: 40%;
  }
  .title {
    padding: 4px 6px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 550;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .title:hover {
    background: var(--surface-2);
  }
  .rename {
    width: 220px;
    padding: 3px 8px;
    font-size: 13px;
    font-weight: 550;
    text-align: center;
    background: var(--surface);
    border: 1px solid var(--accent);
    border-radius: 6px;
  }
  .rename:focus {
    outline: none;
  }
  .menu-anchor {
    position: relative;
  }
  .caret {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 6px;
    color: var(--text-muted);
  }
  .caret:hover {
    background: var(--surface-2);
    color: var(--text);
  }
  .right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .pages {
    font-size: 12px;
    color: var(--text-muted);
  }
  .overview {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 6px;
    color: var(--text-muted);
  }
  .overview:hover,
  .overview.active {
    background: var(--surface-2);
    color: var(--text);
  }
</style>
