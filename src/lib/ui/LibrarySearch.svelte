<script lang="ts">
  import { goto } from '$app/navigation';
  import { Search } from '@lucide/svelte';
  import { library } from '$lib/store/library.svelte';
  import { settings } from '$lib/store/settings.svelte';
  import { ui } from '$lib/store/ui.svelte';
  import { fuzzyScore } from '$lib/util/fuzzy';
  import { pagesLabel, relTime } from '$lib/util/format';

  let { open = $bindable(false) }: { open?: boolean } = $props();

  let query = $state('');
  let cursor = $state(0);
  let input = $state<HTMLInputElement | null>(null);

  interface Result {
    kind: 'notebook' | 'project' | 'action';
    label: string;
    detail: string;
    run: () => void;
  }

  const results = $derived.by((): Result[] => {
    const out: { score: number; r: Result }[] = [];
    for (const nb of library.notebooks) {
      const s = fuzzyScore(query, nb.title);
      if (s !== null) {
        out.push({
          score: s + 10,
          r: {
            kind: 'notebook',
            label: nb.title,
            detail: `${pagesLabel(nb.pageCount)} · ${relTime(nb.modifiedAt)}`,
            run: () => void goto(`/notebook/${nb.id}`),
          },
        });
      }
    }
    for (const p of library.projects) {
      const s = fuzzyScore(query, p.name);
      if (s !== null) {
        out.push({
          score: s,
          r: {
            kind: 'project',
            label: p.name,
            detail: 'project',
            run: () => {
              if (p.collapsed) library.toggleCollapsed(p.id);
              document
                .getElementById(`project-${p.id}`)
                ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
            },
          },
        });
      }
    }
    const actions: Result[] = [
      {
        kind: 'action',
        label: 'New notebook',
        detail: 'action',
        run: async () => {
          const id = await library.createNotebook(null, settings.data.lastTemplate);
          if (id) void goto(`/notebook/${id}`);
        },
      },
      {
        kind: 'action',
        label: 'Settings',
        detail: '⌘,',
        run: () => (ui.settingsOpen = true),
      },
    ];
    for (const a of actions) {
      const s = fuzzyScore(query, a.label);
      if (s !== null) out.push({ score: s - 5, r: a });
    }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, 8).map((x) => x.r);
  });

  $effect(() => {
    if (open) {
      query = '';
      cursor = 0;
      input?.focus();
    }
  });

  $effect(() => {
    void results;
    if (cursor >= results.length) cursor = Math.max(0, results.length - 1);
  });

  function pick(r: Result) {
    open = false;
    r.run();
  }

  function onkeydown(e: KeyboardEvent) {
    e.stopPropagation();
    if (e.key === 'Escape') open = false;
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      cursor = Math.min(cursor + 1, results.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      cursor = Math.max(cursor - 1, 0);
    } else if (e.key === 'Enter' && results[cursor]) {
      pick(results[cursor]);
    }
  }
</script>

<div class="anchor">
  {#if open}
    <div class="box">
      <input
        bind:this={input}
        bind:value={query}
        placeholder="Search notebooks and projects"
        {onkeydown}
        onblur={() => setTimeout(() => (open = false), 120)}
      />
      {#if results.length > 0}
        <div class="results" role="listbox">
          {#each results as r, i (r.kind + r.label)}
            <button
              class="result"
              class:active={i === cursor}
              role="option"
              aria-selected={i === cursor}
              onpointerdown={(e) => {
                e.preventDefault();
                pick(r);
              }}
            >
              <span class="label">{r.label}</span>
              <span class="detail">{r.detail}</span>
            </button>
          {/each}
        </div>
      {:else}
        <div class="none">Nothing matches “{query}”</div>
      {/if}
    </div>
  {:else}
    <button
      class="trigger"
      title="Search  ⌘K"
      aria-label="Search"
      onclick={() => (open = true)}
    >
      <Search size={16} strokeWidth={1.5} />
    </button>
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
    width: 32px;
    height: 32px;
    border-radius: 8px;
    color: var(--text-muted);
  }
  .trigger:hover {
    background: var(--surface-2);
    color: var(--text);
  }
  .box {
    position: relative;
  }
  input {
    width: 280px;
    padding: 6px 10px;
    font-size: 13px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
  }
  input:focus {
    outline: none;
    border-color: var(--accent);
  }
  .results,
  .none {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    width: 320px;
    padding: 4px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: var(--shadow-sheet);
    z-index: 50;
    animation: rise 160ms ease-out;
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
  }
  .result {
    display: flex;
    align-items: baseline;
    gap: 8px;
    width: 100%;
    padding: 7px 10px;
    border-radius: 6px;
    text-align: left;
  }
  .result.active,
  .result:hover {
    background: var(--surface-2);
  }
  .label {
    flex: 1;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .detail {
    font-size: 12px;
    color: var(--text-muted);
    white-space: nowrap;
  }
  .none {
    padding: 12px;
    font-size: 13px;
    color: var(--text-muted);
  }
</style>
