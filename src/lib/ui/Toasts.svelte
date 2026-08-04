<script lang="ts">
  import { toasts } from '$lib/store/toast.svelte';
</script>

{#if toasts.list.length > 0}
  <div class="stack">
    {#each toasts.list as toast (toast.id)}
      <div class="toast">
        <span>{toast.message}</span>
        {#if toast.action}
          <button
            class="action"
            onclick={() => {
              toasts.dismiss(toast.id);
              toast.action?.run();
            }}
          >
            {toast.action.label}
          </button>
        {:else}
          <button class="action quiet" onclick={() => toasts.dismiss(toast.id)}>
            Dismiss
          </button>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  .stack {
    position: fixed;
    left: 16px;
    bottom: 16px;
    z-index: 80;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .toast {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: var(--shadow-card);
    font-size: 12px;
    animation: rise 160ms ease-out;
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
  }
  .action {
    font-size: 12px;
    font-weight: 600;
    color: var(--accent);
  }
  .action.quiet {
    color: var(--text-muted);
    font-weight: 400;
  }
</style>
