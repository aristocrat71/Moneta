import type { NotebookMeta } from '$lib/ipc';

/** Hover-to-peek for library rows: the tree stays dense, the ink stays one
 *  hover away. One panel for the whole tree — rows only say what to show. */

/** Wait before the first peek so a cursor crossing the tree stays quiet. */
const OPEN_DELAY = 220;
/** Grace after leaving a row: moving down the tree swaps instantly. */
const CLOSE_DELAY = 100;

class PreviewStore {
  nb = $state<NotebookMeta | null>(null);
  /** Viewport coords of the row that asked for it. */
  anchorTop = $state(0);
  anchorRight = $state(0);

  private timer: ReturnType<typeof setTimeout> | null = null;

  show(nb: NotebookMeta, row: HTMLElement | null): void {
    if (!row) return;
    this.clear();
    const open = () => {
      const rect = row.getBoundingClientRect();
      this.anchorTop = rect.top;
      this.anchorRight = rect.right;
      this.nb = nb;
      this.timer = null;
    };
    if (this.nb) open();
    else this.timer = setTimeout(open, OPEN_DELAY);
  }

  hide(): void {
    this.clear();
    if (!this.nb) return;
    this.timer = setTimeout(() => {
      this.nb = null;
      this.timer = null;
    }, CLOSE_DELAY);
  }

  /** No grace — for opening a notebook, menus, and leaving the library. */
  close(): void {
    this.clear();
    this.nb = null;
  }

  private clear(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}

export const preview = new PreviewStore();
