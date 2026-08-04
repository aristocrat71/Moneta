<script lang="ts">
  import { goto } from '$app/navigation';
  import { ChevronRight, MoreHorizontal, Pencil, Plus, Trash2 } from '@lucide/svelte';
  import type { NotebookMeta, ProjectData } from '$lib/ipc';
  import { library } from '$lib/store/library.svelte';
  import { settings } from '$lib/store/settings.svelte';
  import { ui } from '$lib/store/ui.svelte';
  import Menu from './Menu.svelte';
  import ConfirmSheet from './ConfirmSheet.svelte';
  import NotebookCard from './NotebookCard.svelte';
  import type { MenuItem } from './menu';

  let {
    project = null,
    notebooks,
  }: {
    /** null renders the Unfiled section. */
    project?: ProjectData | null;
    notebooks: NotebookMeta[];
  } = $props();

  let menuOpen = $state(false);
  let renaming = $state(false);
  let draft = $state('');
  let confirmDelete = $state(false);
  let dragOver = $state(false);
  let renameInput = $state<HTMLInputElement | null>(null);

  const collapsed = $derived(
    project ? (project.collapsed ?? false) : settings.data.unfiledCollapsed,
  );
  const name = $derived(project?.name ?? 'Unfiled');

  function toggleCollapse() {
    if (project) {
      library.toggleCollapsed(project.id);
    } else {
      settings.data.unfiledCollapsed = !settings.data.unfiledCollapsed;
      settings.save();
    }
  }

  // A freshly created project opens straight into rename.
  $effect(() => {
    if (project && ui.renameProjectId === project.id) {
      ui.renameProjectId = null;
      draft = project.name;
      renaming = true;
    }
  });

  $effect(() => {
    if (renaming) renameInput?.select();
  });

  const menuItems = $derived.by((): MenuItem[] => [
    {
      label: 'Rename',
      icon: Pencil,
      action: () => {
        draft = name;
        renaming = true;
      },
    },
    {
      label: 'Delete project',
      icon: Trash2,
      danger: true,
      action: () => (confirmDelete = true),
    },
  ]);

  function commitRename() {
    renaming = false;
    if (project && draft.trim()) void library.renameProject(project.id, draft);
  }

  async function newNotebook() {
    const id = await library.createNotebook(project?.id ?? null, settings.data.lastTemplate);
    if (id) void goto(`/notebook/${id}`);
  }

  function onDrop(e: DragEvent) {
    dragOver = false;
    const id = e.dataTransfer?.getData('text/moneta-notebook');
    if (id) {
      e.preventDefault();
      void library.moveNotebook(id, project?.id ?? null);
    }
  }
</script>

<section
  class="project"
  class:drag-over={dragOver}
  role="group"
  aria-label={name}
  ondragover={(e) => {
    if (e.dataTransfer?.types.includes('text/moneta-notebook')) {
      e.preventDefault();
      dragOver = true;
    }
  }}
  ondragleave={(e) => {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) dragOver = false;
  }}
  ondrop={onDrop}
>
  <div class="header">
    <button
      class="caret"
      class:collapsed
      aria-label={collapsed ? `Expand ${name}` : `Collapse ${name}`}
      onclick={toggleCollapse}
    >
      <ChevronRight size={16} strokeWidth={1.5} />
    </button>
    {#if renaming}
      <input
        class="rename"
        bind:this={renameInput}
        bind:value={draft}
        onkeydown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') commitRename();
          if (e.key === 'Escape') renaming = false;
        }}
        onblur={commitRename}
      />
    {:else}
      <button
        class="name"
        title={collapsed ? `Expand ${name}` : `Collapse ${name}`}
        onclick={toggleCollapse}
      >
        {name}
      </button>
    {/if}
    {#if project}
      <div class="menu-anchor">
        <button
          class="more"
          class:open={menuOpen}
          aria-label="Project actions"
          onclick={() => (menuOpen = !menuOpen)}
          onpointerdown={(e) => e.stopPropagation()}
        >
          <MoreHorizontal size={16} strokeWidth={1.5} />
        </button>
        <Menu bind:open={menuOpen} items={menuItems} />
      </div>
    {/if}
    <span class="count">
      {notebooks.length === 1 ? '1 notebook' : `${notebooks.length} notebooks`}
    </span>
  </div>

  {#if !collapsed}
    <div class="grid">
      {#each notebooks as nb (nb.id)}
        <NotebookCard {nb} />
      {/each}
      <button class="new-card" onclick={newNotebook}>
        <Plus size={18} strokeWidth={1.5} />
        <span>new</span>
      </button>
    </div>
  {/if}
</section>

{#if project}
  <ConfirmSheet
    bind:open={confirmDelete}
    title={`Delete “${project.name}”?`}
    body="Its notebooks return to Unfiled."
    confirmLabel="Delete project"
    onconfirm={() => void library.deleteProject(project.id)}
  />
{/if}

<style>
  .project {
    margin-bottom: 32px;
    border-radius: 10px;
  }
  .project.drag-over {
    outline: 2px solid var(--accent);
    outline-offset: 4px;
  }
  .header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 12px;
  }
  .caret {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    color: var(--text-muted);
    transition: transform 120ms ease-out;
    transform: rotate(90deg);
  }
  .caret.collapsed {
    transform: rotate(0deg);
  }
  button.caret:hover {
    background: var(--surface-2);
    color: var(--text);
  }
  .name {
    padding: 2px 6px;
    margin-left: -2px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 550;
  }
  .name:hover {
    background: var(--surface-2);
  }
  .rename {
    font-size: 14px;
    font-weight: 550;
    padding: 1px 4px;
    background: var(--surface);
    border: 1px solid var(--accent);
    border-radius: 4px;
  }
  .rename:focus {
    outline: none;
  }
  .menu-anchor {
    position: relative;
  }
  .more {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    color: var(--text-muted);
    opacity: 0;
    transition: opacity 120ms ease-out;
  }
  .header:hover .more,
  .more.open,
  .more:focus-visible {
    opacity: 1;
  }
  .more:hover {
    background: var(--surface-2);
    color: var(--text);
  }
  .count {
    margin-left: auto;
    font-size: 12px;
    color: var(--text-muted);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, 200px);
    gap: 20px;
  }
  .new-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 200px;
    height: 200px;
    border: 1px dashed var(--border);
    border-radius: 10px;
    color: var(--text-muted);
    font-size: 12px;
  }
  .new-card:hover {
    border-color: var(--text-muted);
    color: var(--text);
    background: var(--surface-2);
  }
</style>
