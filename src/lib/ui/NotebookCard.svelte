<script lang="ts">
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
  import type { MenuItem } from './menu';

  let { nb, showProject = false }: { nb: NotebookMeta; showProject?: boolean } = $props();

  let menuOpen = $state(false);
  let renaming = $state(false);
  let draft = $state('');
  let confirmDelete = $state(false);
  let exportPdf = $state(false);

  const thumb = $derived(library.thumbSrc(nb.id, theme.dark));
  const projectName = $derived(showProject ? library.projectName(nb.projectId) : null);

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
        // PDF takes the long road: pages to pick, and the ink to check first.
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
    if (!renaming) void goto(`/notebook/${nb.id}`);
  }
</script>

<div
  class="card"
  role="button"
  tabindex="0"
  draggable="true"
  onclick={open}
  onkeydown={(e) => {
    if (e.key === 'Enter') open();
  }}
  ondragstart={(e) => {
    e.dataTransfer?.setData('text/moneta-notebook', nb.id);
  }}
>
  <div class="thumb">
    {#if thumb}
      <img src={thumb} alt="" draggable="false" />
    {/if}
  </div>
  <!-- Outside .thumb: that box clips overflow, which would cut the menu off.
       Clicks inside the menu must never bubble into the card's open(). -->
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
      onclick={() => (menuOpen = !menuOpen)}
    >
      <MoreHorizontal size={16} strokeWidth={1.5} />
    </button>
    <Menu bind:open={menuOpen} items={menuItems} align="right" />
  </div>
  {#if renaming}
    <!-- svelte-ignore a11y_autofocus -->
    <input
      class="rename"
      bind:value={draft}
      autofocus
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
    {pagesLabel(nb.pageCount)}{projectName ? ` · ${projectName}` : ''} · {relTime(
      nb.modifiedAt,
    )}
  </span>
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
  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 200px;
    cursor: pointer;
  }
  .card:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-radius: 10px;
  }
  .thumb {
    position: relative;
    width: 200px;
    height: 200px;
    margin-bottom: 8px;
    background: var(--canvas);
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
    box-shadow: var(--shadow-card);
    transition: box-shadow 120ms ease-out;
  }
  .card:hover .thumb {
    box-shadow: var(--shadow-card-hover);
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top;
  }
  .menu-anchor {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 2;
  }
  .more {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text-muted);
    opacity: 0;
    transition: opacity 120ms ease-out;
  }
  .card:hover .more,
  .more.open,
  .more:focus-visible {
    opacity: 1;
  }
  .more:hover {
    color: var(--text);
    background: var(--surface-2);
  }
  .title {
    font-size: 15px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rename {
    font-size: 15px;
    font-weight: 600;
    padding: 0 2px;
    margin: -1px 0;
    background: var(--surface);
    border: 1px solid var(--accent);
    border-radius: 4px;
  }
  .rename:focus {
    outline: none;
  }
  .meta {
    font-size: 12px;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
