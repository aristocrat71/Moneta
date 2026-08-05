<script lang="ts">
  import { goto } from '$app/navigation';
  import { Plus } from '@lucide/svelte';
  import { library } from '$lib/store/library.svelte';
  import { preview } from './preview.svelte';

  let {
    rowKey,
    parentKey,
    projectId,
    active = false,
    depth = 1,
  }: {
    rowKey: string;
    parentKey: string;
    projectId: string | null;
    active?: boolean;
    depth?: number;
  } = $props();

  async function create() {
    preview.close();
    const id = await library.createNotebook(projectId);
    if (id) void goto(`/notebook/${id}`);
  }
</script>

<div
  class="tree-row child new"
  style:--depth={depth}
  data-key={rowKey}
  data-parent={parentKey}
  role="treeitem"
  aria-level={depth + 1}
  aria-selected={active}
  tabindex={active ? 0 : -1}
  onclick={create}
  onkeydown={(e) => {
    if (e.key === 'Enter') void create();
  }}
  onpointerenter={() => preview.hide()}
>
  <Plus size={14} strokeWidth={1.5} />
  <span>New notebook</span>
</div>

<style>
  .new {
    color: var(--text-muted);
    font-size: 13px;
  }
  .new:hover {
    color: var(--text);
  }
</style>
