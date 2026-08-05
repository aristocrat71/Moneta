<script lang="ts">
  // Destructive confirmation: shows what you're deleting; Cancel is the default.
  let {
    open = $bindable(false),
    title,
    body = '',
    confirmLabel,
    thumbSrc = null,
    onconfirm,
  }: {
    open?: boolean;
    title: string;
    body?: string;
    confirmLabel: string;
    thumbSrc?: string | null;
    onconfirm: () => void;
  } = $props();

  let cancelBtn = $state<HTMLButtonElement | null>(null);

  $effect(() => {
    if (open) cancelBtn?.focus();
  });

  function onkeydown(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === 'Escape') {
      e.stopPropagation();
      open = false;
    }
  }
</script>

<svelte:window {onkeydown} />

{#if open}
  <div
    class="scrim"
    role="presentation"
    onpointerdown={(e) => {
      if (e.target === e.currentTarget) open = false;
    }}
  >
    <div class="sheet" role="alertdialog" aria-label={title}>
      {#if thumbSrc}
        <img class="thumb" src={thumbSrc} alt="" draggable="false" />
      {/if}
      <h2>{title}</h2>
      {#if body}
        <p>{body}</p>
      {/if}
      <div class="actions">
        <button bind:this={cancelBtn} class="btn" onclick={() => (open = false)}>
          Cancel
        </button>
        <button
          class="btn danger"
          onclick={() => {
            open = false;
            onconfirm();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: grid;
    place-items: center;
    background: var(--scrim);
  }
  .sheet {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    width: 320px;
    padding: 24px 24px 20px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: var(--shadow-sheet);
    animation: rise 160ms ease-out;
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
  }
  .thumb {
    width: 120px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--canvas);
  }
  h2 {
    font-size: 15px;
    font-weight: 600;
    text-align: center;
  }
  p {
    font-size: 13px;
    color: var(--text-muted);
    text-align: center;
  }
  .actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }
  .btn {
    padding: 7px 14px;
    border-radius: 8px;
    border: 1px solid var(--border);
    font-size: 13px;
    font-weight: 500;
  }
  .btn:hover {
    background: var(--surface-2);
  }
  .btn.danger {
    background: var(--danger);
    border-color: var(--danger);
    color: var(--accent-ink);
  }
  .btn.danger:hover {
    filter: brightness(1.08);
    background: var(--danger);
  }
</style>
