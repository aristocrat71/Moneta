// Thin typed wrappers over the Rust commands. All filesystem access flows
// through here — the webview never touches the FS directly.

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export interface NotebookMeta {
  id: string;
  title: string;
  projectId: string | null;
  createdAt: number;
  modifiedAt: number;
  pageCount: number;
}

export interface ProjectData {
  id: string;
  name: string;
  order: number;
  collapsed?: boolean;
}

export interface LibrarySnapshot {
  projects: ProjectData[];
  notebooks: NotebookMeta[];
  root: string;
}

export interface ThumbPair {
  light: string | null;
  dark: string | null;
}

export const ipc = {
  libraryScan: () => invoke<LibrarySnapshot>('library_scan'),
  readNotebook: (id: string) => invoke<string>('read_notebook', { id }),
  writeNotebook: (id: string, contents: string) =>
    invoke<void>('write_notebook', { id, contents }),
  deleteNotebook: (id: string) => invoke<void>('delete_notebook', { id }),
  duplicateNotebook: (id: string, newId: string) =>
    invoke<NotebookMeta>('duplicate_notebook', { id, newId }),
  writeLibrary: (contents: string) => invoke<void>('write_library', { contents }),
  readSettings: () => invoke<string | null>('read_settings'),
  writeSettings: (contents: string) => invoke<void>('write_settings', { contents }),
  writeThumbnail: (id: string, dark: boolean, data: string) =>
    invoke<void>('write_thumbnail', { id, dark, data }),
  readThumbnails: () => invoke<Record<string, ThumbPair>>('read_thumbnails'),
  exportFile: (name: string, data: string) => invoke<string>('export_file', { name, data }),
  storagePath: () => invoke<string>('storage_path'),
  onLibraryChanged: (cb: () => void): Promise<UnlistenFn> => listen('library-changed', cb),
};
