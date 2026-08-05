// Undo/redo. Every stroke-mutating action is a Command with a stored inverse;
// UI code never mutates the document directly.

import type { DocPage, NotebookDoc } from './model';
import type { Mat, StrokeData, StrokeEdit, TemplateKind } from '$lib/ink/engine';

export interface Command {
  label: string;
  /** Pages whose pixels changed — the shell repaints these. */
  pageIds: string[];
  /** True when the page list itself changed (add/delete/reorder). */
  structural?: boolean;
  do(doc: NotebookDoc): void;
  undo(doc: NotebookDoc): void;
}

export class History {
  static readonly CAP = 500;
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  push(doc: NotebookDoc, cmd: Command): void {
    cmd.do(doc);
    this.undoStack.push(cmd);
    if (this.undoStack.length > History.CAP) this.undoStack.shift();
    this.redoStack = [];
  }

  undo(doc: NotebookDoc): Command | null {
    const cmd = this.undoStack.pop();
    if (!cmd) return null;
    cmd.undo(doc);
    this.redoStack.push(cmd);
    return cmd;
  }

  redo(doc: NotebookDoc): Command | null {
    const cmd = this.redoStack.pop();
    if (!cmd) return null;
    cmd.do(doc);
    this.undoStack.push(cmd);
    return cmd;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}

function mustPage(doc: NotebookDoc, pageId: string): DocPage {
  const page = doc.pages.find((p) => p.id === pageId);
  if (!page) throw new Error(`unknown page ${pageId}`);
  return page;
}

/** Apply an affine matrix to flat [x, y, p] triples — a new array, so caches
 *  keyed on array identity invalidate. */
export function transformPoints(points: number[], m: Mat): number[] {
  const out = new Array<number>(points.length);
  for (let i = 0; i + 2 < points.length; i += 3) {
    const x = points[i];
    const y = points[i + 1];
    out[i] = m.a * x + m.c * y + m.e;
    out[i + 1] = m.b * x + m.d * y + m.f;
    out[i + 2] = points[i + 2];
  }
  return out;
}

/** Uniform width factor of an affine transform (√|det|). */
export function widthScale(m: Mat): number {
  return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
}

export function cmdAddStroke(pageId: string, stroke: StrokeData): Command {
  return {
    label: 'Draw',
    pageIds: [pageId],
    do(doc) {
      mustPage(doc, pageId).strokes.push(stroke);
    },
    undo(doc) {
      const page = mustPage(doc, pageId);
      page.strokes = page.strokes.filter((s) => s.id !== stroke.id);
    },
  };
}

export function cmdAddStrokes(pageId: string, strokes: StrokeData[], label = 'Paste'): Command {
  const ids = new Set(strokes.map((s) => s.id));
  return {
    label,
    pageIds: [pageId],
    do(doc) {
      mustPage(doc, pageId).strokes.push(...strokes);
    },
    undo(doc) {
      const page = mustPage(doc, pageId);
      page.strokes = page.strokes.filter((s) => !ids.has(s.id));
    },
  };
}

export function cmdEraseStrokes(pageId: string, ids: string[], label = 'Erase'): Command {
  const idSet = new Set(ids);
  let saved: { index: number; stroke: StrokeData }[] | null = null;
  return {
    label,
    pageIds: [pageId],
    do(doc) {
      const page = mustPage(doc, pageId);
      if (!saved) {
        saved = [];
        page.strokes.forEach((stroke, index) => {
          if (idSet.has(stroke.id)) saved!.push({ index, stroke });
        });
      }
      page.strokes = page.strokes.filter((s) => !idSet.has(s.id));
    },
    undo(doc) {
      const page = mustPage(doc, pageId);
      // Re-insert at original indices, ascending, so ordering round-trips.
      for (const { index, stroke } of saved ?? []) {
        page.strokes.splice(Math.min(index, page.strokes.length), 0, stroke);
      }
    },
  };
}

/** Partial erase: strokes replaced in place by their surviving segments. */
export function cmdSplitStrokes(pageId: string, edits: StrokeEdit[], label = 'Erase'): Command {
  const replaceMap = new Map(edits.map((e) => [e.before.id, e.after]));
  const afterIds = new Set(edits.flatMap((e) => e.after.map((s) => s.id)));
  let saved: { index: number; stroke: StrokeData }[] | null = null;
  return {
    label,
    pageIds: [pageId],
    do(doc) {
      const page = mustPage(doc, pageId);
      if (!saved) {
        saved = [];
        page.strokes.forEach((stroke, index) => {
          if (replaceMap.has(stroke.id)) saved!.push({ index, stroke });
        });
      }
      page.strokes = page.strokes.flatMap((s) => replaceMap.get(s.id) ?? [s]);
    },
    undo(doc) {
      const page = mustPage(doc, pageId);
      page.strokes = page.strokes.filter((s) => !afterIds.has(s.id));
      for (const { index, stroke } of saved ?? []) {
        page.strokes.splice(Math.min(index, page.strokes.length), 0, stroke);
      }
    },
  };
}

export function cmdTransformStrokes(pageId: string, ids: string[], m: Mat): Command {
  const idSet = new Set(ids);
  let saved: { id: string; points: number[]; width: number }[] | null = null;
  const k = widthScale(m);
  return {
    label: 'Transform selection',
    pageIds: [pageId],
    do(doc) {
      const page = mustPage(doc, pageId);
      if (!saved) {
        saved = page.strokes
          .filter((s) => idSet.has(s.id))
          .map((s) => ({ id: s.id, points: s.points, width: s.width }));
      }
      for (const entry of saved) {
        const stroke = page.strokes.find((s) => s.id === entry.id);
        if (!stroke) continue;
        stroke.points = transformPoints(entry.points, m);
        stroke.width = Math.max(0.3, entry.width * k);
      }
    },
    undo(doc) {
      const page = mustPage(doc, pageId);
      for (const entry of saved ?? []) {
        const stroke = page.strokes.find((s) => s.id === entry.id);
        if (!stroke) continue;
        stroke.points = entry.points;
        stroke.width = entry.width;
      }
    },
  };
}

export function cmdRecolorStrokes(pageId: string, ids: string[], color: string): Command {
  const idSet = new Set(ids);
  let saved: { id: string; color: string }[] | null = null;
  return {
    label: 'Recolor',
    pageIds: [pageId],
    do(doc) {
      const page = mustPage(doc, pageId);
      if (!saved) {
        saved = page.strokes
          .filter((s) => idSet.has(s.id))
          .map((s) => ({ id: s.id, color: s.color }));
      }
      for (const stroke of page.strokes) {
        if (idSet.has(stroke.id)) stroke.color = color;
      }
    },
    undo(doc) {
      const page = mustPage(doc, pageId);
      for (const entry of saved ?? []) {
        const stroke = page.strokes.find((s) => s.id === entry.id);
        if (stroke) stroke.color = entry.color;
      }
    },
  };
}

/** Page background: one command over every page, so undo restores the old mix. */
export function cmdSetTemplate(pageIds: string[], template: TemplateKind): Command {
  const idSet = new Set(pageIds);
  let saved: { id: string; template: TemplateKind }[] | null = null;
  return {
    label: 'Change background',
    pageIds: [...idSet],
    do(doc) {
      if (!saved) {
        saved = doc.pages
          .filter((p) => idSet.has(p.id))
          .map((p) => ({ id: p.id, template: p.template }));
      }
      for (const page of doc.pages) {
        if (idSet.has(page.id)) page.template = template;
      }
    },
    undo(doc) {
      for (const entry of saved ?? []) {
        const page = doc.pages.find((p) => p.id === entry.id);
        if (page) page.template = entry.template;
      }
    },
  };
}

export function cmdAddPage(index: number, page: DocPage): Command {
  return {
    label: 'Add page',
    pageIds: [page.id],
    structural: true,
    do(doc) {
      doc.pages.splice(Math.min(index, doc.pages.length), 0, page);
    },
    undo(doc) {
      doc.pages = doc.pages.filter((p) => p.id !== page.id);
    },
  };
}

export function cmdDeletePage(pageId: string): Command {
  let saved: { index: number; page: DocPage } | null = null;
  return {
    label: 'Delete page',
    pageIds: [pageId],
    structural: true,
    do(doc) {
      const index = doc.pages.findIndex((p) => p.id === pageId);
      if (index < 0) return;
      saved = { index, page: doc.pages[index] };
      doc.pages.splice(index, 1);
    },
    undo(doc) {
      if (saved) doc.pages.splice(Math.min(saved.index, doc.pages.length), 0, saved.page);
    },
  };
}

export function cmdReorderPages(from: number, to: number): Command {
  return {
    label: 'Reorder pages',
    pageIds: [],
    structural: true,
    do(doc) {
      const [page] = doc.pages.splice(from, 1);
      if (page) doc.pages.splice(to, 0, page);
    },
    undo(doc) {
      const [page] = doc.pages.splice(to, 1);
      if (page) doc.pages.splice(from, 0, page);
    },
  };
}
