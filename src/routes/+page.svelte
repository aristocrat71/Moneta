<script lang="ts">
  // The Library — see all your ink, resume in one click (DESIGN.md §3).
  import { goto } from '$app/navigation';
  import { Contrast, FolderPlus, Plus, SquarePen } from '@lucide/svelte';
  import { library } from '$lib/store/library.svelte';
  import { settings } from '$lib/store/settings.svelte';
  import { theme } from '$lib/store/theme.svelte';
  import { ui } from '$lib/store/ui.svelte';
  import Menu from '$lib/ui/Menu.svelte';
  import { beginWindowDrag } from '$lib/ui/window-drag';
  import LibrarySearch from '$lib/ui/LibrarySearch.svelte';
  import NotebookCard from '$lib/ui/NotebookCard.svelte';
  import ProjectSection from '$lib/ui/ProjectSection.svelte';
  import type { MenuItem } from '$lib/ui/menu';

  let newMenuOpen = $state(false);
  let searchOpen = $state(false);

  const empty = $derived(
    library.loaded && library.notebooks.length === 0 && library.projects.length === 0,
  );

  async function createNotebook() {
    const id = await library.createNotebook(null, settings.data.lastTemplate);
    if (id) void goto(`/notebook/${id}`);
  }

  async function createProject() {
    ui.renameProjectId = await library.createProject('New project');
  }

  const newMenuItems: MenuItem[] = [
    { label: 'New notebook', icon: SquarePen, action: () => void createNotebook() },
    { label: 'New project', icon: FolderPlus, action: () => void createProject() },
  ];

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
</script>

<svelte:window onkeydown={onKeydown} />

<div class="library">
  <header role="presentation" onmousedown={beginWindowDrag}>
    <span class="wordmark" role="presentation" onmousedown={beginWindowDrag}>Moneta</span>
    <div class="tools">
      <LibrarySearch bind:open={searchOpen} />
      <button
        class="icon-btn"
        title="Theme"
        aria-label="Toggle theme"
        onclick={() => theme.toggle()}
      >
        <Contrast size={16} strokeWidth={1.5} />
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

  <main>
    {#if empty}
      <div class="empty">
        <div class="ghost-sheet"></div>
        <p>No projects yet.</p>
        <button class="primary" onclick={createProject}>Create your first project</button>
      </div>
    {:else if library.loaded}
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
    {/if}
  </main>
</div>

<style>
  .library {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 56px;
    /* left padding clears the macOS traffic lights (overlay title bar) */
    padding: 0 20px 0 84px;
    flex: none;
  }
  .wordmark {
    font-size: 14px;
    font-weight: 550;
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
    padding: 16px 32px 64px;
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
  .ghost-sheet {
    width: 226px;
    height: 320px;
    border: 1px dashed var(--border);
    border-radius: 4px;
    background: var(--canvas);
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
