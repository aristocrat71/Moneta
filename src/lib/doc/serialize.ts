// .moneta (de)serialization. Points are rounded to 2 decimals on write —
// page-unit precision far below a pixel — to keep files compact.

import { migrateNotebook } from './migrate';
import type { NotebookDoc } from './model';

export function serializeNotebook(doc: NotebookDoc): string {
  return JSON.stringify(doc, (key, value) => {
    if (key === 'points' && Array.isArray(value)) {
      return value.map((v: number) => Math.round(v * 100) / 100);
    }
    return value;
  });
}

export function parseNotebook(text: string): NotebookDoc {
  return migrateNotebook(JSON.parse(text));
}
