// The .moneta document model (format v1).

import type { PageSize, StrokeData, TemplateKind } from '$lib/ink/engine';

export const FORMAT_VERSION = 1;

/** Page units ≈ A4 @ 150dpi. */
export const PAGE_SIZE: PageSize = { w: 1240, h: 1754 };

/** What a new notebook is made of. Dots guide handwriting without ruling it. */
export const DEFAULT_TEMPLATE: TemplateKind = 'dotted';

export interface DocPage {
  id: string;
  template: TemplateKind;
  size: PageSize;
  strokes: StrokeData[];
}

/** Where the viewport sat at the last edit: the page, plus the point under its
 *  top-left corner — in page units, so it survives a resize or a new zoom. */
export interface ViewAnchor {
  page: number;
  x: number;
  y: number;
}

export interface NotebookDoc {
  formatVersion: number;
  id: string;
  title: string;
  projectId: string | null;
  createdAt: number;
  modifiedAt: number;
  lastOpenPage: number;
  /** Reopening lands here — the spot of the last edit, not the top of a sheet. */
  lastView: ViewAnchor | null;
  pages: DocPage[];
}

export function newPage(template: TemplateKind): DocPage {
  return {
    id: crypto.randomUUID(),
    template,
    size: { ...PAGE_SIZE },
    strokes: [],
  };
}

export function newNotebook(args: {
  id?: string;
  title?: string;
  projectId?: string | null;
  template?: TemplateKind;
}): NotebookDoc {
  const now = Date.now();
  return {
    formatVersion: FORMAT_VERSION,
    id: args.id ?? crypto.randomUUID(),
    title: args.title ?? 'Untitled',
    projectId: args.projectId ?? null,
    createdAt: now,
    modifiedAt: now,
    lastOpenPage: 0,
    lastView: null,
    pages: [newPage(args.template ?? DEFAULT_TEMPLATE)],
  };
}

export function findPage(doc: NotebookDoc, pageId: string): DocPage | undefined {
  return doc.pages.find((p) => p.id === pageId);
}
