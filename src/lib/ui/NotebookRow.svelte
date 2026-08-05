<script lang="ts">
  // A leaf of the library tree.
  import { goto } from '$app/navigation';
  import { Copy, Download, FolderInput, MoreHorizontal, Pencil, Trash2 } from '@lucide/svelte';
  import type { NotebookMeta } from '$lib/ipc';
  import { ipc } from '$lib/ipc';
  import { library } from '$lib/store/library.svelte';
  import { theme } from '$lib/store/theme.svelte';
  import { toasts } from '$lib/store/toast.svelte';
  import { parseNotebook } from '$lib/doc/serialize';
  import { exportNotebook, type ExportKind } from '$lib/export';
  import { pagesLabel, relTime } from '$lib/util/format';
  import Menu from './Menu.svelte';
  import ConfirmSheet from './ConfirmSheet.svelte';
  import ExportSheet from './ExportSheet.svelte';
  import { preview } from './preview.svelte';
  import type { MenuItem } from './menu';

  let {
    nb,
    rowKey,
    parentKey,
    active = false,
    depth = 1,
    showProject = false,
  }: {
    nb: NotebookMeta;
    rowKey: string;
    parentKey: string;
    active?: boolean;
    depth?: number;
    showProject?: boolean;
  } = $props();

  let row = $state<HTMLDivElement | null>(null);
  let menuOpen = $state(false);
  let renaming = $state(false);
  let draft = $state('');
  let confirmDelete = $state(false);
  let exportPdf = $state(false);
  let renameInput = $state<HTMLInputElement | null>(null);

  const thumb = $derived(library.thumbSrc(nb.id, theme.dark));
  const projectName = $derived(showProject ? library.projectName(nb.projectId) : null);

  $effect(() => {
    if (renaming) renameInput?.select();
  });

  async function runExport(kind: ExportKind) {
    try {
      const doc = parseNotebook(await ipc.readNotebook(nb.id));
      const path = await exportNotebook(doc, kind);
      toasts.show(`Exported to ${path}`);
    } catch (e) {
      toasts.show(`Couldn't export · ${e}`);
    }
  }

  const menuItems = $derived.by((): MenuItem[] => [
    {
      label: 'Rename',
      icon: Pencil,
      action: () => {
        draft = nb.title;
        renaming = true;
      },
    },
    {
      label: 'Move to',
      icon: FolderInput,
      children: [
        ...library.projects.map((p) => ({
          label: p.name,
          disabled: nb.projectId === p.id,
          action: () => void library.moveNotebook(nb.id, p.id),
        })),
        {
          label: 'Unfiled',
          disabled: nb.projectId === null,
          action: () => void library.moveNotebook(nb.id, null),
        },
      ],
    },
    { label: 'Duplicate', icon: Copy, action: () => void library.duplicateNotebook(nb.id) },
    {
      label: 'Export',
      icon: Download,
      children: [
        { label: 'PDF…', action: () => (exportPdf = true) },
        { label: 'PNG', action: () => void runExport('png') },
        { label: 'SVG', action: () => void runExport('svg') },
      ],
    },
    { label: 'Delete', icon: Trash2, danger: true, action: () => (confirmDelete = true) },
  ]);

  function commitRename() {
    renaming = false;
    if (draft.trim() && draft.trim() !== nb.title) {
      void library.renameNotebook(nb.id, draft);
    }
  }

  function open() {
    if (renaming) return;
    preview.close();
    void goto(`/notebook/${nb.id}`);
  }

  /** Nothing to peek at until the first page has ink. */
  function peek() {
    if (menuOpen || renaming || !thumb) return;
    preview.show(nb, row);
  }
</script>

<div
  bind:this={row}
  class="tree-row child notebook"
  style:--depth={depth}
  data-key={rowKey}
  data-parent={parentKey}
  role="treeitem"
  aria-level={depth + 1}
  aria-selected={active}
  tabindex={active ? 0 : -1}
  draggable="true"
  onclick={open}
  onkeydown={(e) => {
    if (e.key === 'Enter') open();
  }}
  onpointerenter={peek}
  onpointerleave={() => preview.hide()}
  onfocus={peek}
  onblur={() => preview.hide()}
  ondragstart={(e) => {
    preview.close();
    e.dataTransfer?.setData('text/moneta-notebook', nb.id);
  }}
>
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
    <span class="title">{nb.title}</span>
  {/if}
  <span class="meta">
    {projectName ? `${projectName} · ` : ''}{pagesLabel(nb.pageCount)} · {relTime(
      nb.modifiedAt,
    )}
  </span>
  <!-- Clicks inside the menu must never bubble into the row's open(). -->
  <div
    class="menu-anchor"
    role="presentation"
    onclick={(e) => e.stopPropagation()}
    onpointerdown={(e) => e.stopPropagation()}
    ondragstart={(e) => e.stopPropagation()}
  >
    <button
      class="more"
      class:open={menuOpen}
      aria-label="Notebook actions"
      onclick={() => {
        menuOpen = !menuOpen;
        preview.close();
      }}
    >
      <MoreHorizontal size={15} strokeWidth={1.5} />
    </button>
    <Menu bind:open={menuOpen} items={menuItems} align="right" />
  </div>
</div>

<ExportSheet bind:open={exportPdf} {nb} />

<ConfirmSheet
  bind:open={confirmDelete}
  title={`Delete “${nb.title}”?`}
  body="This can't be undone."
  confirmLabel="Delete notebook"
  thumbSrc={thumb}
  onconfirm={() => void library.deleteNotebook(nb.id)}
/>

<style>
  .title {
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rename {
    flex: 1;
    min-width: 0;
    padding: 1px 4px;
    font-size: 13px;
    background: var(--surface);
    border: 1px solid var(--accent);
    border-radius: 4px;
  }
  .rename:focus {
    outline: none;
  }
  .meta {
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
  .notebook:hover .more,
  .notebook:focus-within .more,
  .more.open {
    opacity: 1;
  }
  .more:hover {
    background: var(--border);
    color: var(--text);
  }
</style>
