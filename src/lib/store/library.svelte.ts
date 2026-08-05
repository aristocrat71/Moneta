import { ipc, type NotebookMeta, type ProjectData, type ThumbPair } from '$lib/ipc';
import { DEFAULT_TEMPLATE, newNotebook } from '$lib/doc/model';
import { parseNotebook } from '$lib/doc/serialize';
import { serializeNotebook } from '$lib/doc/serialize';
import type { NotebookDoc } from '$lib/doc/model';
import type { TemplateKind } from '$lib/ink/engine';
import { toasts } from './toast.svelte';

class LibraryStore {
  projects = $state<ProjectData[]>([]);
  notebooks = $state<NotebookMeta[]>([]);
  thumbs = $state<Record<string, ThumbPair>>({});
  root = $state('');
  loaded = $state(false);

  private listening = false;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  async init(): Promise<void> {
    if (!this.listening) {
      this.listening = true;
      // Watcher events (own saves + external edits) → debounced rescan.
      ipc
        .onLibraryChanged(() => {
          if (this.refreshTimer) clearTimeout(this.refreshTimer);
          this.refreshTimer = setTimeout(() => void this.refresh(), 400);
        })
        .catch(() => {});
    }
    await this.refresh();
  }

  async refresh(): Promise<void> {
    try {
      const snap = await ipc.libraryScan();
      this.projects = [...snap.projects].sort((a, b) => a.order - b.order);
      this.notebooks = snap.notebooks;
      this.root = snap.root;
      this.thumbs = await ipc.readThumbnails();
      this.loaded = true;
    } catch (e) {
      toasts.show(`Couldn't read the library · ${e}`);
    }
  }

  get recent(): NotebookMeta[] {
    return [...this.notebooks].sort((a, b) => b.modifiedAt - a.modifiedAt).slice(0, 5);
  }

  /** Where a notebook with no home goes. `order` is only assigned at creation,
   *  so the highest is the newest; `createdAt` decides once both have it. */
  get newestProject(): ProjectData | null {
    let newest: ProjectData | null = null;
    for (const p of this.projects) {
      if (!newest) {
        newest = p;
        continue;
      }
      const a = p.createdAt ?? 0;
      const b = newest.createdAt ?? 0;
      if (a > b || (a === b && p.order > newest.order)) newest = p;
    }
    return newest;
  }

  projectName(id: string | null): string | null {
    if (id === null) return null;
    return this.projects.find((p) => p.id === id)?.name ?? null;
  }

  private projectIds(): Set<string> {
    return new Set(this.projects.map((p) => p.id));
  }

  notebooksIn(projectId: string): NotebookMeta[] {
    return this.notebooks
      .filter((n) => n.projectId === projectId)
      .sort((a, b) => b.modifiedAt - a.modifiedAt);
  }

  /** Unfiled = no project, or a project that no longer exists. */
  get unfiled(): NotebookMeta[] {
    const ids = this.projectIds();
    return this.notebooks
      .filter((n) => n.projectId === null || !ids.has(n.projectId))
      .sort((a, b) => b.modifiedAt - a.modifiedAt);
  }

  private async saveProjects(): Promise<void> {
    try {
      await ipc.writeLibrary(JSON.stringify({ projects: this.projects }));
    } catch (e) {
      toasts.show(`Couldn't save projects · ${e}`);
    }
  }

  async createProject(name: string): Promise<string> {
    const project: ProjectData = {
      id: crypto.randomUUID(),
      name,
      order: this.projects.length,
      collapsed: false,
      createdAt: Date.now(),
    };
    this.projects.push(project);
    await this.saveProjects();
    return project.id;
  }

  async renameProject(id: string, name: string): Promise<void> {
    const project = this.projects.find((p) => p.id === id);
    if (!project || !name.trim()) return;
    project.name = name.trim();
    await this.saveProjects();
  }

  /** Deleting a project never deletes notebooks — they return to Unfiled. */
  async deleteProject(id: string): Promise<void> {
    for (const nb of this.notebooksIn(id)) {
      await this.moveNotebook(nb.id, null);
    }
    this.projects = this.projects.filter((p) => p.id !== id);
    await this.saveProjects();
  }

  toggleCollapsed(id: string): void {
    const project = this.projects.find((p) => p.id === id);
    if (!project) return;
    project.collapsed = !project.collapsed;
    void this.saveProjects();
  }

  /** New notebooks always start on the default paper — `lastTemplate` is the
   *  sticky choice for adding pages inside a notebook, not for starting one. */
  async createNotebook(
    projectId: string | null,
    template: TemplateKind = DEFAULT_TEMPLATE,
  ): Promise<string | null> {
    const doc = newNotebook({ projectId, template });
    try {
      await ipc.writeNotebook(doc.id, serializeNotebook(doc));
    } catch (e) {
      toasts.show(`Couldn't create notebook · ${e}`);
      return null;
    }
    this.notebooks.push({
      id: doc.id,
      title: doc.title,
      projectId: doc.projectId,
      createdAt: doc.createdAt,
      modifiedAt: doc.modifiedAt,
      pageCount: 1,
    });
    return doc.id;
  }

  private async updateNotebookFile(
    id: string,
    mutate: (doc: NotebookDoc) => void,
  ): Promise<void> {
    const text = await ipc.readNotebook(id);
    const doc = parseNotebook(text);
    mutate(doc);
    doc.modifiedAt = Date.now();
    await ipc.writeNotebook(id, serializeNotebook(doc));
    const meta = this.notebooks.find((n) => n.id === id);
    if (meta) {
      meta.title = doc.title;
      meta.projectId = doc.projectId;
      meta.modifiedAt = doc.modifiedAt;
    }
  }

  async renameNotebook(id: string, title: string): Promise<void> {
    const trimmed = title.trim();
    if (!trimmed) return;
    try {
      await this.updateNotebookFile(id, (doc) => {
        doc.title = trimmed;
      });
    } catch (e) {
      toasts.show(`Couldn't rename · ${e}`);
    }
  }

  async moveNotebook(id: string, projectId: string | null): Promise<void> {
    try {
      await this.updateNotebookFile(id, (doc) => {
        doc.projectId = projectId;
      });
    } catch (e) {
      toasts.show(`Couldn't move notebook · ${e}`);
    }
  }

  async duplicateNotebook(id: string): Promise<void> {
    try {
      const meta = await ipc.duplicateNotebook(id, crypto.randomUUID());
      this.notebooks.push(meta);
      this.thumbs = await ipc.readThumbnails();
    } catch (e) {
      toasts.show(`Couldn't duplicate · ${e}`);
    }
  }

  async deleteNotebook(id: string): Promise<void> {
    try {
      await ipc.deleteNotebook(id);
      this.notebooks = this.notebooks.filter((n) => n.id !== id);
    } catch (e) {
      toasts.show(`Couldn't delete · ${e}`);
    }
  }

  thumbSrc(id: string, dark: boolean): string | null {
    const pair = this.thumbs[id];
    const data = dark ? (pair?.dark ?? pair?.light) : (pair?.light ?? pair?.dark);
    return data ? `data:image/png;base64,${data}` : null;
  }
}

export const library = new LibraryStore();
