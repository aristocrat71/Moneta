// The open notebook. The document is a plain non-reactive object — the UI
// observes only the summary $state fields here (title, counts, undo flags).

import { ipc } from '$lib/ipc';
import { History, type Command } from '$lib/doc/commands';
import { parseNotebook, serializeNotebook } from '$lib/doc/serialize';
import type { NotebookDoc, ViewAnchor } from '$lib/doc/model';
import { DEFAULT_TUNING, renderPageBitmap } from '$lib/ink/engine';
import { getThemePaint } from '$lib/ui/theme-paint';
import { toasts } from './toast.svelte';
import { library } from './library.svelte';

const AUTOSAVE_MS = 1500;

class NotebookSession {
  /** Plain mutable document — not reactive by design. */
  doc: NotebookDoc | null = null;
  readonly history = new History();

  id = $state<string | null>(null);
  title = $state('');
  projectId = $state<string | null>(null);
  pageCount = $state(0);
  currentPage = $state(0);
  canUndo = $state(false);
  canRedo = $state(false);
  saveFailed = $state(false);
  /** Bumped when the page list changes (add/delete/reorder) — views re-key. */
  rev = $state(0);

  /** Set by the canvas view: repaint these page ids after a mutation. */
  onPagesChanged: (pageIds: string[]) => void = () => {};

  /** Set by the canvas view: where the viewport is right now. Read after every
   *  edit so reopening the notebook lands where the last one happened. */
  captureView: (() => ViewAnchor | null) | null = null;

  private dirtyDoc = false;
  private saving = false;
  private pendingFlush = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  async open(id: string): Promise<void> {
    if (this.id === id && this.doc) return;
    await this.close();
    const text = await ipc.readNotebook(id);
    const doc = parseNotebook(text);
    this.doc = doc;
    this.id = id;
    this.history.clear();
    this.currentPage = doc.lastOpenPage;
    this.saveFailed = false;
    this.syncMeta();
    this.rev++;
  }

  async close(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    await this.flush();
    this.doc = null;
    this.id = null;
    this.history.clear();
    this.title = '';
    this.pageCount = 0;
    this.canUndo = false;
    this.canRedo = false;
  }

  private syncMeta(): void {
    if (!this.doc) return;
    this.title = this.doc.title;
    this.projectId = this.doc.projectId;
    this.pageCount = this.doc.pages.length;
    this.canUndo = this.history.canUndo;
    this.canRedo = this.history.canRedo;
  }

  /** `notify=false` skips the repaint callback — used when the engine has
   *  already painted the result (stroke bake, live erase). */
  apply(cmd: Command, notify = true): void {
    if (!this.doc) return;
    this.history.push(this.doc, cmd);
    this.afterMutation(cmd, notify);
  }

  undo(): Command | null {
    if (!this.doc) return null;
    const cmd = this.history.undo(this.doc);
    if (cmd) this.afterMutation(cmd, true);
    return cmd;
  }

  redo(): Command | null {
    if (!this.doc) return null;
    const cmd = this.history.redo(this.doc);
    if (cmd) this.afterMutation(cmd, true);
    return cmd;
  }

  private afterMutation(cmd: Command, notify: boolean): void {
    if (!this.doc) return;
    this.doc.modifiedAt = Date.now();
    // Every edit — ink, erase, rotate, recolour — moves the resume point.
    const view = this.captureView?.();
    if (view) this.doc.lastView = view;
    this.syncMeta();
    if (cmd.structural) {
      this.currentPage = Math.min(this.currentPage, this.doc.pages.length - 1);
      this.rev++;
    }
    if (notify) this.onPagesChanged(cmd.pageIds);
    this.scheduleSave();
  }

  rename(title: string): void {
    if (!this.doc) return;
    this.doc.title = title.trim() || 'Untitled';
    this.syncMeta();
    this.scheduleSave();
  }

  setProject(projectId: string | null): void {
    if (!this.doc) return;
    this.doc.projectId = projectId;
    this.syncMeta();
    this.scheduleSave();
  }

  setCurrentPage(index: number): void {
    this.currentPage = index;
    if (this.doc && this.doc.lastOpenPage !== index) {
      this.doc.lastOpenPage = index;
      this.scheduleSave();
    }
  }

  scheduleSave(): void {
    this.dirtyDoc = true;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.flush();
    }, AUTOSAVE_MS);
  }

  /** Serialize + write + refresh thumbnails. Called on debounce, blur,
   *  page-switch, and close. Silence means saved. */
  async flush(): Promise<void> {
    if (!this.doc || !this.dirtyDoc) return;
    if (this.saving) {
      this.pendingFlush = true;
      return;
    }
    this.saving = true;
    this.dirtyDoc = false;
    const doc = this.doc;
    try {
      await ipc.writeNotebook(doc.id, serializeNotebook(doc));
      await this.writeThumbnails(doc);
      this.saveFailed = false;
      const meta = library.notebooks.find((n) => n.id === doc.id);
      if (meta) {
        meta.title = doc.title;
        meta.projectId = doc.projectId;
        meta.modifiedAt = doc.modifiedAt;
        meta.pageCount = doc.pages.length;
      }
    } catch (e) {
      this.dirtyDoc = true;
      if (!this.saveFailed) {
        this.saveFailed = true;
        toasts.show(`Couldn't save · ${e}`, {
          sticky: true,
          action: { label: 'Retry', run: () => void this.flush() },
        });
      }
    } finally {
      this.saving = false;
      if (this.pendingFlush) {
        this.pendingFlush = false;
        void this.flush();
      }
    }
  }

  private async writeThumbnails(doc: NotebookDoc): Promise<void> {
    const page = doc.pages[0];
    if (!page) return;
    for (const dark of [false, true]) {
      const canvas = renderPageBitmap({
        strokes: page.strokes,
        template: page.template,
        size: page.size,
        paint: getThemePaint(dark),
        tuning: DEFAULT_TUNING,
        width: 400,
        height: 520,
      });
      const data = canvas.toDataURL('image/png').split(',')[1];
      await ipc.writeThumbnail(doc.id, dark, data);
    }
  }
}

export const session = new NotebookSession();
