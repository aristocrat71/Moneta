<script lang="ts">
  // PDF export with the pages on screen while you choose them. The preview is
  // the export renderer at a smaller width, on light paper — what you see is
  // the page you are about to get, not an approximation of it (DESIGN §5.6).
  import { ChevronLeft, ChevronRight } from '@lucide/svelte';
  import { ipc, type NotebookMeta } from '$lib/ipc';
  import { toasts } from '$lib/store/toast.svelte';
  import { parseNotebook } from '$lib/doc/serialize';
  import { exportNotebook, resolveRange } from '$lib/export';
  import { getThemePaint } from '$lib/ui/theme-paint';
  import { DEFAULT_TUNING, renderPageBitmap } from '$lib/ink/engine';
  import type { NotebookDoc } from '$lib/doc/model';

  let { open = $bindable(false), nb }: { open?: boolean; nb: NotebookMeta } = $props();

  let doc = $state<NotebookDoc | null>(null);
  /** null while a field is empty mid-typing; the range resolves around it. */
  let from = $state<number | null>(1);
  let to = $state<number | null>(null);
  let page = $state(1);
  let src = $state<string | null>(null);
  let busy = $state(false);
  let exportBtn = $state<HTMLButtonElement | null>(null);

  const total = $derived(doc?.pages.length ?? nb.pageCount);
  const span = $derived(resolveRange(total, { from: from ?? 1, to: to ?? total }));
  const count = $derived(span.to - span.from + 1);
  const summary = $derived(
    count < total
      ? `${count} of ${total} pages`
      : total === 1
        ? '1 page'
        : `All ${total} pages`,
  );
  /** The preview follows the range: a page that drops out of it is left behind. */
  const shown = $derived(Math.min(Math.max(page, span.from), span.to));

  $effect(() => {
    if (!open) {
      doc = null;
      src = null;
      return;
    }
    let alive = true;
    void (async () => {
      try {
        const loaded = parseNotebook(await ipc.readNotebook(nb.id));
        if (!alive) return;
        doc = loaded;
        from = 1;
        to = loaded.pages.length;
        page = 1;
        exportBtn?.focus();
      } catch (e) {
        if (!alive) return;
        toasts.show(`Couldn't open “${nb.title}” · ${e}`);
        open = false;
      }
    })();
    return () => {
      alive = false;
    };
  });

  $effect(() => {
    const p = doc?.pages[shown - 1];
    if (!p) {
      src = null;
      return;
    }
    src = renderPageBitmap({
      strokes: p.strokes,
      template: p.template,
      size: p.size,
      paint: getThemePaint(false),
      tuning: DEFAULT_TUNING,
      width: 620,
    }).toDataURL();
  });

  function onkeydown(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === 'Escape') {
      e.stopPropagation();
      open = false;
    }
  }

  /** Typing is left alone; leaving the field settles it on a real page. */
  function snap() {
    from = span.from;
    to = span.to;
  }

  async function run() {
    if (!doc || busy) return;
    busy = true;
    try {
      const path = await exportNotebook(doc, 'pdf', span);
      open = false;
      toasts.show(`Exported to ${path}`);
    } catch (e) {
      toasts.show(`Couldn't export · ${e}`);
    } finally {
      busy = false;
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
    <div class="sheet" role="dialog" aria-label={`Export ${nb.title}`}>
      <header>
        <h2>Export PDF</h2>
        <span class="sub">{nb.title}</span>
      </header>

      <div class="body">
        <div class="preview">
          <div class="sheet-shadow">
            {#if src}
              <img {src} alt={`Page ${shown}`} draggable="false" />
            {/if}
          </div>
          <div class="stepper">
            <button
              aria-label="Previous page"
              disabled={shown <= span.from}
              onclick={() => (page = shown - 1)}
            >
              <ChevronLeft size={16} strokeWidth={1.5} />
            </button>
            <span class="num">Page {shown} of {total}</span>
            <button
              aria-label="Next page"
              disabled={shown >= span.to}
              onclick={() => (page = shown + 1)}
            >
              <ChevronRight size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <div class="side">
          <span class="label">Pages</span>
          <div class="range" role="group" aria-label="Page range">
            <input
              type="number"
              min="1"
              max={total}
              aria-label="First page"
              bind:value={from}
              onblur={snap}
              onkeydown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') void run();
              }}
            />
            <span class="to">to</span>
            <input
              type="number"
              min="1"
              max={total}
              aria-label="Last page"
              bind:value={to}
              onblur={snap}
              onkeydown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') void run();
              }}
            />
          </div>
          <p class="count">{summary}</p>
        </div>
      </div>

      <footer>
        <button class="btn" onclick={() => (open = false)}>Cancel</button>
        <button
          bind:this={exportBtn}
          class="btn primary"
          disabled={!doc || busy}
          onclick={() => void run()}
        >
          {busy ? 'Exporting…' : 'Export PDF'}
        </button>
      </footer>
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
    animation: fade 180ms ease-out;
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
  }
  .sheet {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: min(560px, calc(100vw - 96px));
    padding: 20px;
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
  header {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  h2 {
    font-size: 15px;
    font-weight: 600;
  }
  .sub {
    font-size: 13px;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .body {
    display: flex;
    gap: 20px;
  }
  .preview {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: none;
  }
  /* The paper is the point: it keeps its own surface and shadow whichever
     theme the library is in, because the PDF will be light either way. */
  .sheet-shadow {
    width: 240px;
    height: 340px;
    background: var(--canvas);
    border: 1px solid var(--border);
    border-radius: 4px;
    overflow: hidden;
    box-shadow: var(--shadow-card);
  }
  .sheet-shadow img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top;
  }
  .stepper {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }
  .stepper button {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    color: var(--text-muted);
  }
  .stepper button:hover:not(:disabled) {
    background: var(--surface-2);
    color: var(--text);
  }
  .stepper button:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .num {
    min-width: 120px;
    font-size: 12px;
    color: var(--text-muted);
    text-align: center;
  }
  .side {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }
  .label {
    font-size: 13px;
    font-weight: 550;
  }
  .range {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  /* No spinners: a page number is typed, and the arrows only cost width.
     ↑/↓ still step the field for anyone who reaches for them. */
  .range input {
    width: 56px;
    padding: 5px 8px;
    font-size: 13px;
    text-align: center;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    appearance: textfield;
  }
  .range input::-webkit-outer-spin-button,
  .range input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    appearance: none;
    margin: 0;
  }
  .range input:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
  }
  .to {
    font-size: 13px;
    color: var(--text-muted);
  }
  .count {
    font-size: 12px;
    color: var(--text-muted);
  }
  footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .btn {
    padding: 7px 14px;
    border-radius: 8px;
    border: 1px solid var(--border);
    font-size: 13px;
    font-weight: 500;
  }
  .btn:hover:not(:disabled) {
    background: var(--surface-2);
  }
  .btn.primary {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-ink);
  }
  .btn.primary:hover:not(:disabled) {
    filter: brightness(1.08);
    background: var(--accent);
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
