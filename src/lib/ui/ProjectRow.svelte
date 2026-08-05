<script lang="ts">
  // A branch of the library tree: Recent, a project, or Unfiled.
  import { goto } from '$app/navigation';
  import { ChevronRight, MoreHorizontal, Pencil, SquarePen, Trash2 } from '@lucide/svelte';
  import type { ProjectData } from '$lib/ipc';
  import { library } from '$lib/store/library.svelte';
  import { settings } from '$lib/store/settings.svelte';
  import { ui } from '$lib/store/ui.svelte';
  import Menu from './Menu.svelte';
  import ConfirmSheet from './ConfirmSheet.svelte';
  import { preview } from './preview.svelte';
  import type { MenuItem } from './menu';

  let {
    rowKey,
    label,
    count,
    collapsed,
    ontoggle,
    project = null,
    droppable = false,
    active = false,
  }: {
    rowKey: string;
    label: string;
    count: number;
    collapsed: boolean;
    ontoggle: () => void;
    /** null for Recent and Unfiled — neither can be renamed or deleted. */
    project?: ProjectData | null;
    droppable?: boolean;
    active?: boolean;
  } = $props();

  let menuOpen = $state(false);
  let renaming = $state(false);
  let draft = $state('');
  let confirmDelete = $state(false);
  let dragOver = $state(false);
  let renameInput = $state<HTMLInputElement | null>(null);

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

  async function newNotebook() {
    const id = await library.createNotebook(project?.id ?? null, settings.data.lastTemplate);
    if (id) void goto(`/notebook/${id}`);
  }

  const menuItems = $derived.by((): MenuItem[] => [
    { label: 'New notebook', icon: SquarePen, action: () => void newNotebook() },
    {
      label: 'Rename',
      icon: Pencil,
      action: () => {
        draft = label;
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

  function toggle() {
    if (!renaming) ontoggle();
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

<div
  id={project ? `project-${project.id}` : undefined}
  class="tree-row group"
  class:drag-over={dragOver}
  style:--depth={0}
  data-key={rowKey}
  role="treeitem"
  aria-level="1"
  aria-expanded={!collapsed}
  aria-selected={active}
  tabindex={active ? 0 : -1}
  onclick={toggle}
  onkeydown={(e) => {
    if (e.key === 'Enter') toggle();
  }}
  onpointerenter={() => preview.hide()}
  ondragover={(e) => {
    if (droppable && e.dataTransfer?.types.includes('text/moneta-notebook')) {
      e.preventDefault();
      dragOver = true;
    }
  }}
  ondragleave={() => (dragOver = false)}
  ondrop={droppable ? onDrop : undefined}
>
  <span class="caret" class:collapsed>
    <ChevronRight size={14} strokeWidth={2} />
  </span>
  {#if renaming}
    <input
      class="rename"
      bind:this={renameInput}
      bind:value={draft}
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') commitRename();
        if (e.key === 'Escape') renaming = false;
      }}
      onblur={commitRename}
    />
  {:else}
    <span class="name">{label}</span>
  {/if}
  <span class="count">{count === 1 ? '1 notebook' : `${count} notebooks`}</span>
  {#if project}
    <!-- Clicks inside the menu must never bubble into the row's toggle(). -->
    <div
      class="menu-anchor"
      role="presentation"
      onclick={(e) => e.stopPropagation()}
      onpointerdown={(e) => e.stopPropagation()}
    >
      <button
        class="more"
        class:open={menuOpen}
        aria-label="Project actions"
        onclick={() => (menuOpen = !menuOpen)}
      >
        <MoreHorizontal size={15} strokeWidth={1.5} />
      </button>
      <Menu bind:open={menuOpen} items={menuItems} align="right" />
    </div>
  {:else}
    <span class="menu-spacer"></span>
  {/if}
</div>

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
  .group.drag-over {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
    background: var(--surface-2);
  }
  .caret {
    display: grid;
    place-items: center;
    flex: none;
    width: 16px;
    height: 16px;
    color: var(--text-muted);
    transition: transform 120ms ease-out;
    transform: rotate(90deg);
  }
  .caret.collapsed {
    transform: rotate(0deg);
  }
  .name {
    font-size: 13px;
    font-weight: 550;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rename {
    flex: 1;
    min-width: 0;
    padding: 1px 4px;
    font-size: 13px;
    font-weight: 550;
    background: var(--surface);
    border: 1px solid var(--accent);
    border-radius: 4px;
  }
  .rename:focus {
    outline: none;
  }
  .count {
    margin-left: auto;
    padding-left: 12px;
    font-size: 12px;
    color: var(--text-muted);
    white-space: nowrap;
  }
  .menu-anchor {
    position: relative;
    flex: none;
  }
  .menu-spacer {
    width: 22px;
  }
  .more {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 6px;
    color: var(--text-muted);
    opacity: 0;
    transition: opacity 120ms ease-out;
  }
  .group:hover .more,
  .group:focus-within .more,
  .more.open {
    opacity: 1;
  }
  .more:hover {
    background: var(--border);
    color: var(--text);
  }
</style>
