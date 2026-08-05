<script lang="ts">
  // The Library: a dense tree or the thumbnail grid, toggled from the header.
  import { goto } from '$app/navigation';
  import { FolderPlus, LayoutGrid, ListTree, Plus, Settings, SquarePen } from '@lucide/svelte';
  import type { NotebookMeta, ProjectData } from '$lib/ipc';
  import { library } from '$lib/store/library.svelte';
  import { settings } from '$lib/store/settings.svelte';
  import { ui } from '$lib/store/ui.svelte';
  import Menu from '$lib/ui/Menu.svelte';
  import { beginWindowDrag } from '$lib/ui/window-drag';
  import LibrarySearch from '$lib/ui/LibrarySearch.svelte';
  import NewNotebookRow from '$lib/ui/NewNotebookRow.svelte';
  import NotebookCard from '$lib/ui/NotebookCard.svelte';
  import NotebookPreview from '$lib/ui/NotebookPreview.svelte';
  import NotebookRow from '$lib/ui/NotebookRow.svelte';
  import ProjectRow from '$lib/ui/ProjectRow.svelte';
  import ProjectSection from '$lib/ui/ProjectSection.svelte';
  import { preview } from '$lib/ui/preview.svelte';
  import ShortcutsSheet from '$lib/ui/ShortcutsSheet.svelte';
  import { LIBRARY_SHORTCUTS } from '$lib/ui/shortcuts';
  import type { MenuItem } from '$lib/ui/menu';

  let newMenuOpen = $state(false);
  let searchOpen = $state(false);
  let treeEl = $state<HTMLElement | null>(null);
  let cursorKey = $state<string | null>(null);

  const tree = $derived(settings.data.libraryLayout !== 'cards');

  function toggleLayout() {
    preview.close();
    settings.data.libraryLayout = tree ? 'cards' : 'tree';
    settings.save();
  }

  interface GroupRow {
    kind: 'group';
    key: string;
    label: string;
    count: number;
    collapsed: boolean;
    project: ProjectData | null;
    droppable: boolean;
    toggle: () => void;
  }
  interface LeafRow {
    kind: 'notebook';
    key: string;
    parent: string;
    nb: NotebookMeta;
    showProject: boolean;
  }
  interface NewRow {
    kind: 'new';
    key: string;
    parent: string;
    projectId: string | null;
  }
  type Row = GroupRow | LeafRow | NewRow;

  const empty = $derived(
    library.loaded && library.notebooks.length === 0 && library.projects.length === 0,
  );

  /** The tree, flattened: rendering, keyboard walking, and search all read this. */
  const rows = $derived.by((): Row[] => {
    const out: Row[] = [];

    const recent = library.recent;
    if (recent.length > 0) {
      const collapsed = settings.data.recentCollapsed;
      out.push({
        kind: 'group',
        key: 'g:recent',
        label: 'Recent',
        count: recent.length,
        collapsed,
        project: null,
        droppable: false,
        toggle: () => {
          settings.data.recentCollapsed = !collapsed;
          settings.save();
        },
      });
      if (!collapsed) {
        for (const nb of recent) {
          out.push({
            kind: 'notebook',
            key: `recent:${nb.id}`,
            parent: 'g:recent',
            nb,
            showProject: true,
          });
        }
      }
    }

    for (const project of library.projects) {
      const notebooks = library.notebooksIn(project.id);
      const collapsed = project.collapsed ?? false;
      out.push({
        kind: 'group',
        key: `g:${project.id}`,
        label: project.name,
        count: notebooks.length,
        collapsed,
        project,
        droppable: true,
        toggle: () => library.toggleCollapsed(project.id),
      });
      if (!collapsed) {
        for (const nb of notebooks) {
          out.push({
            kind: 'notebook',
            key: `${project.id}:${nb.id}`,
            parent: `g:${project.id}`,
            nb,
            showProject: false,
          });
        }
        out.push({
          kind: 'new',
          key: `new:${project.id}`,
          parent: `g:${project.id}`,
          projectId: project.id,
        });
      }
    }

    const unfiled = library.unfiled;
    if (unfiled.length > 0) {
      const collapsed = settings.data.unfiledCollapsed;
      out.push({
        kind: 'group',
        key: 'g:unfiled',
        label: 'Unfiled',
        count: unfiled.length,
        collapsed,
        project: null,
        droppable: true,
        toggle: () => {
          settings.data.unfiledCollapsed = !collapsed;
          settings.save();
        },
      });
      if (!collapsed) {
        for (const nb of unfiled) {
          out.push({
            kind: 'notebook',
            key: `unfiled:${nb.id}`,
            parent: 'g:unfiled',
            nb,
            showProject: false,
          });
        }
      }
    }

    return out;
  });

  /** Roving tabindex: exactly one row is in the tab order at a time. */
  const activeKey = $derived(
    rows.some((r) => r.key === cursorKey) ? cursorKey : (rows[0]?.key ?? null),
  );

  /** ⌘N and + → New notebook both land here: the newest project, not Unfiled. */
  async function createNotebook() {
    const id = await library.createNotebook(library.newestProject?.id ?? null);
    if (id) void goto(`/notebook/${id}`);
  }

  async function createProject() {
    ui.renameProjectId = await library.createProject('New project');
  }

  const newMenuItems: MenuItem[] = [
    { label: 'New notebook', icon: SquarePen, action: () => void createNotebook() },
    { label: 'New project', icon: FolderPlus, action: () => void createProject() },
  ];

  function focusRow(key: string | undefined) {
    if (!key) return;
    cursorKey = key;
    const el = treeEl?.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`);
    el?.focus();
    el?.scrollIntoView({ block: 'nearest' });
  }

  /** Tree keys: up/down walks every visible row, left/right closes/opens. */
  function onTreeKeydown(e: KeyboardEvent) {
    const i = rows.findIndex((r) => r.key === activeKey);
    if (i < 0) return;
    const row = rows[i];
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusRow(rows[Math.min(i + 1, rows.length - 1)]?.key);
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusRow(rows[Math.max(i - 1, 0)]?.key);
        break;
      case 'Home':
        e.preventDefault();
        focusRow(rows[0]?.key);
        break;
      case 'End':
        e.preventDefault();
        focusRow(rows[rows.length - 1]?.key);
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (row.kind === 'group' && row.collapsed) row.toggle();
        else focusRow(rows[Math.min(i + 1, rows.length - 1)]?.key);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (row.kind === 'group') {
          if (!row.collapsed) row.toggle();
        } else {
          focusRow(row.parent);
        }
        break;
    }
  }

  function onKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      searchOpen = true;
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      void createNotebook();
    }
  }

  // Returning from a notebook must never resurrect the last peek.
  $effect(() => {
    preview.close();
    return () => preview.close();
  });
</script>

<svelte:window onkeydown={onKeydown} />

<div class="library">
  <header role="presentation" onmousedown={beginWindowDrag}>
    <!-- The wordmark opens About rather than dragging: a control can't do both. -->
    <button class="wordmark" title="About Moneta" onclick={() => (ui.aboutOpen = true)}>
      Moneta
    </button>
    <div class="tools">
      <LibrarySearch bind:open={searchOpen} />
      <button
        class="icon-btn"
        title={tree ? 'Grid layout' : 'Tree layout'}
        aria-label={tree ? 'Switch to grid layout' : 'Switch to tree layout'}
        onclick={toggleLayout}
      >
        {#if tree}
          <LayoutGrid size={16} strokeWidth={1.5} />
        {:else}
          <ListTree size={16} strokeWidth={1.5} />
        {/if}
      </button>
      <button
        class="icon-btn"
        title="Settings  ⌘,"
        aria-label="Settings"
        onclick={() => (ui.settingsOpen = true)}
      >
        <Settings size={16} strokeWidth={1.5} />
      </button>
      <div class="menu-anchor">
        <button
          class="icon-btn"
          class:open={newMenuOpen}
          title="New"
          aria-label="Create"
          onclick={() => (newMenuOpen = !newMenuOpen)}
          onpointerdown={(e) => e.stopPropagation()}
        >
          <Plus size={18} strokeWidth={1.5} />
        </button>
        <Menu bind:open={newMenuOpen} items={newMenuItems} align="right" />
      </div>
    </div>
  </header>

  <main class:grid-layout={!tree} onscroll={() => preview.hide()}>
    {#if empty}
      <div class="empty">
        <p>No projects yet.</p>
        <button class="primary" onclick={createProject}>Create your first project</button>
      </div>
    {:else if !library.loaded}
      <!-- nothing until the scan lands -->
    {:else if !tree}
      {#if library.recent.length > 0}
        <span class="eyebrow">Recent</span>
        <div class="recent-row">
          {#each library.recent as nb (nb.id)}
            <NotebookCard {nb} showProject />
          {/each}
        </div>
      {/if}

      {#if library.projects.length > 0}
        <span class="eyebrow">Projects</span>
      {/if}
      {#each library.projects as project (project.id)}
        <div id={`project-${project.id}`}>
          <ProjectSection {project} notebooks={library.notebooksIn(project.id)} />
        </div>
      {/each}

      {#if library.unfiled.length > 0}
        <ProjectSection project={null} notebooks={library.unfiled} />
      {/if}
    {:else}
      <div
        class="tree"
        bind:this={treeEl}
        role="tree"
        aria-label="Library"
        tabindex="-1"
        onkeydown={onTreeKeydown}
        onfocusin={(e) => {
          const el = (e.target as HTMLElement).closest<HTMLElement>('[data-key]');
          if (el?.dataset.key) cursorKey = el.dataset.key;
        }}
      >
        {#each rows as row (row.key)}
          {#if row.kind === 'group'}
            <ProjectRow
              rowKey={row.key}
              label={row.label}
              count={row.count}
              collapsed={row.collapsed}
              ontoggle={row.toggle}
              project={row.project}
              droppable={row.droppable}
              active={row.key === activeKey}
            />
          {:else if row.kind === 'notebook'}
            <NotebookRow
              nb={row.nb}
              rowKey={row.key}
              parentKey={row.parent}
              showProject={row.showProject}
              active={row.key === activeKey}
            />
          {:else}
            <NewNotebookRow
              rowKey={row.key}
              parentKey={row.parent}
              projectId={row.projectId}
              active={row.key === activeKey}
            />
          {/if}
        {/each}
      </div>
    {/if}
  </main>
</div>

<NotebookPreview />
<ShortcutsSheet title="Keyboard shortcuts" groups={LIBRARY_SHORTCUTS} />

<style>
  .library {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }
  header {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    height: 56px;
    /* left padding clears the macOS traffic lights (overlay title bar) */
    padding: 0 20px 0 84px;
    flex: none;
  }
  .wordmark {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 550;
    color: var(--text);
  }
  .wordmark:hover {
    background: var(--surface-2);
  }
  .tools {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .icon-btn {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    color: var(--text-muted);
  }
  .icon-btn:hover,
  .icon-btn.open {
    background: var(--surface-2);
    color: var(--text);
  }
  .menu-anchor {
    position: relative;
  }
  main {
    flex: 1;
    overflow-y: auto;
    padding: 8px 32px 48px;
  }
  main.grid-layout {
    padding: 16px 32px 64px;
  }
  /* One narrow column — the peek panel lives in the space to its right. */
  .tree {
    max-width: 560px;
  }
  .eyebrow {
    display: block;
    margin: 8px 0 12px;
    font-size: 12px;
    font-weight: 550;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .recent-row {
    display: flex;
    gap: 20px;
    overflow-x: auto;
    padding-bottom: 8px;
    margin-bottom: 32px;
  }
  .recent-row > :global(*) {
    flex: none;
  }
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    height: 100%;
  }
  .empty p {
    font-size: 14px;
    color: var(--text-muted);
  }
  .primary {
    padding: 8px 16px;
    background: var(--accent);
    color: var(--accent-ink);
    border-radius: 8px;
    font-size: 13px;
    font-weight: 550;
  }
  .primary:hover {
    filter: brightness(1.08);
  }
</style>
