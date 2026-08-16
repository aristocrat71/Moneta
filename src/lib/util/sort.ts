// How the library orders notebooks. Pure, so the ordering is testable on its own.

import type { NotebookMeta } from '$lib/ipc';

export type LibrarySort = 'edited' | 'created' | 'title';
export type SortDir = 'asc' | 'desc';

export const SORT_LABELS: Record<LibrarySort, string> = {
  edited: 'Last edited',
  created: 'Created',
  title: 'Title',
};

export const DIR_LABELS: Record<SortDir, string> = {
  asc: 'Ascending',
  desc: 'Descending',
};

/** What each key means unreversed: oldest-first reads wrong for a date. */
export function naturalDir(sort: LibrarySort): SortDir {
  return sort === 'title' ? 'asc' : 'desc';
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** Case- and accent-blind, and "Chapter 10" lands after "Chapter 9". */
export function byTitle(a: { title: string }, b: { title: string }): number {
  return collator.compare(a.title, b.title);
}

/** Ties fall back to the title, so equal timestamps never shuffle between scans. */
export function sortNotebooks(
  list: NotebookMeta[],
  sort: LibrarySort,
  dir: SortDir = naturalDir(sort),
): NotebookMeta[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    if (sort === 'title') return sign * byTitle(a, b);
    const key = sort === 'created' ? 'createdAt' : 'modifiedAt';
    return sign * (a[key] - b[key]) || byTitle(a, b);
  });
}
