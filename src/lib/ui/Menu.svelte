<script lang="ts">
  import { ChevronLeft, ChevronRight } from '@lucide/svelte';
  import type { MenuItem } from './menu';

  let {
    open = $bindable(false),
    items,
    align = 'left',
    up = false,
  }: {
    open?: boolean;
    items: MenuItem[];
    align?: 'left' | 'right';
    up?: boolean;
  } = $props();

  let el = $state<HTMLDivElement | null>(null);
  let stack = $state<MenuItem[][]>([]);

  const current = $derived(stack.length > 0 ? stack[stack.length - 1] : items);

  $effect(() => {
    if (!open) {
      stack = [];
      return;
    }
    const onDown = (e: PointerEvent) => {
      if (el && !el.parentElement?.contains(e.target as Node)) open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        open = false;
      }
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  });

  function pick(item: MenuItem) {
    if (item.disabled) return;
    if (item.children) {
      stack = [...stack, item.children];
      return;
    }
    open = false;
    item.action?.();
  }
</script>

{#if open}
  <div
    bind:this={el}
    class="menu"
    class:up
    style:left={align === 'left' ? '0' : 'auto'}
    style:right={align === 'right' ? '0' : 'auto'}
    role="menu"
    tabindex="-1"
  >
    {#if stack.length > 0}
      <button class="item back" role="menuitem" onclick={() => (stack = stack.slice(0, -1))}>
        <ChevronLeft size={16} strokeWidth={1.5} />
        <span>Back</span>
      </button>
      <div class="rule"></div>
    {/if}
    {#each current as item, i (i)}
      <button
        class="item"
        class:danger={item.danger}
        role="menuitem"
        disabled={item.disabled}
        onclick={() => pick(item)}
      >
        {#if item.icon}
          <item.icon size={16} strokeWidth={1.5} />
        {/if}
        <span>{item.label}</span>
        {#if item.children}
          <ChevronRight size={16} strokeWidth={1.5} class="chev" />
        {/if}
      </button>
    {/each}
  </div>
{/if}

<style>
  .menu {
    position: absolute;
    top: calc(100% + 6px);
    z-index: 40;
    min-width: 180px;
    padding: 4px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: var(--shadow-sheet);
    animation: rise 160ms ease-out;
  }
  .menu.up {
    top: auto;
    bottom: calc(100% + 6px);
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
  }
  .item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 7px 10px;
    border-radius: 6px;
    font-size: 13px;
    text-align: left;
    white-space: nowrap;
  }
  .item span {
    flex: 1;
  }
  .item:hover:not(:disabled) {
    background: var(--surface-2);
  }
  .item:disabled {
    color: var(--text-muted);
    cursor: default;
  }
  .item.danger {
    color: var(--danger);
  }
  .back {
    color: var(--text-muted);
  }
  .rule {
    height: 1px;
    margin: 4px 6px;
    background: var(--border);
  }
</style>
