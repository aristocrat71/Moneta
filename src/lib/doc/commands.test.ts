import { describe, expect, test } from 'vitest';
import {
  History,
  cmdAddPage,
  cmdAddStroke,
  cmdDeletePage,
  cmdEraseStrokes,
  cmdRecolorStrokes,
  cmdReorderPages,
  cmdSplitStrokes,
  cmdTransformStrokes,
  transformPoints,
  widthScale,
} from './commands';
import { newNotebook, newPage, type NotebookDoc } from './model';
import type { StrokeData } from '$lib/ink/engine';

function stroke(id: string, points = [0, 0, 0.5, 10, 10, 0.5]): StrokeData {
  return { id, tool: 'pen', color: 'ink/black', width: 3, points };
}

function docWithStrokes(): { doc: NotebookDoc; pageId: string } {
  const doc = newNotebook({ title: 't' });
  const pageId = doc.pages[0].id;
  doc.pages[0].strokes.push(stroke('a'), stroke('b'), stroke('c'));
  return { doc, pageId };
}

function snapshot(doc: NotebookDoc): string {
  return JSON.stringify(doc.pages);
}

describe('command inverses', () => {
  test('add stroke round-trips', () => {
    const { doc, pageId } = docWithStrokes();
    const before = snapshot(doc);
    const h = new History();
    h.push(doc, cmdAddStroke(pageId, stroke('d')));
    expect(doc.pages[0].strokes).toHaveLength(4);
    h.undo(doc);
    expect(snapshot(doc)).toBe(before);
    h.redo(doc);
    expect(doc.pages[0].strokes.map((s) => s.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  test('erase restores strokes at their original indices', () => {
    const { doc, pageId } = docWithStrokes();
    const before = snapshot(doc);
    const h = new History();
    h.push(doc, cmdEraseStrokes(pageId, ['a', 'c']));
    expect(doc.pages[0].strokes.map((s) => s.id)).toEqual(['b']);
    h.undo(doc);
    expect(snapshot(doc)).toBe(before);
  });

  test('split (partial erase) replaces in place and round-trips', () => {
    const { doc, pageId } = docWithStrokes();
    const before = snapshot(doc);
    const h = new History();
    const seg1 = stroke('b1', [0, 0, 0.5, 4, 4, 0.5]);
    const seg2 = stroke('b2', [8, 8, 0.5, 10, 10, 0.5]);
    h.push(
      doc,
      cmdSplitStrokes(pageId, [
        { before: doc.pages[0].strokes[1], after: [seg1, seg2] }, // b → two runs
        { before: doc.pages[0].strokes[2], after: [] }, // c → fully erased
      ]),
    );
    expect(doc.pages[0].strokes.map((s) => s.id)).toEqual(['a', 'b1', 'b2']);
    h.undo(doc);
    expect(snapshot(doc)).toBe(before);
    h.redo(doc);
    expect(doc.pages[0].strokes.map((s) => s.id)).toEqual(['a', 'b1', 'b2']);
    h.undo(doc);
    expect(snapshot(doc)).toBe(before);
  });

  test('transform round-trips losslessly (stored old points)', () => {
    const { doc, pageId } = docWithStrokes();
    const before = snapshot(doc);
    const h = new History();
    const rot = Math.PI / 7;
    const m = {
      a: Math.cos(rot) * 1.7,
      b: Math.sin(rot) * 1.7,
      c: -Math.sin(rot) * 1.7,
      d: Math.cos(rot) * 1.7,
      e: 12.3,
      f: -4.5,
    };
    h.push(doc, cmdTransformStrokes(pageId, ['a', 'b'], m));
    expect(snapshot(doc)).not.toBe(before);
    expect(doc.pages[0].strokes[0].width).toBeCloseTo(3 * widthScale(m));
    h.undo(doc);
    // Exact equality — undo restores the original arrays, no float drift.
    expect(snapshot(doc)).toBe(before);
    h.redo(doc);
    h.undo(doc);
    expect(snapshot(doc)).toBe(before);
  });

  test('recolor stores and restores previous colors', () => {
    const { doc, pageId } = docWithStrokes();
    doc.pages[0].strokes[1].color = 'ink/red';
    const before = snapshot(doc);
    const h = new History();
    h.push(doc, cmdRecolorStrokes(pageId, ['a', 'b'], 'ink/gall'));
    expect(doc.pages[0].strokes.map((s) => s.color)).toEqual([
      'ink/gall',
      'ink/gall',
      'ink/black',
    ]);
    h.undo(doc);
    expect(snapshot(doc)).toBe(before);
  });

  test('page add/delete/reorder round-trip', () => {
    const doc = newNotebook({ title: 't' });
    const h = new History();
    h.push(doc, cmdAddPage(1, newPage('grid')));
    h.push(doc, cmdAddPage(2, newPage('dotted')));
    const ids = doc.pages.map((p) => p.id);
    h.push(doc, cmdReorderPages(0, 2));
    expect(doc.pages.map((p) => p.id)).toEqual([ids[1], ids[2], ids[0]]);
    h.undo(doc);
    expect(doc.pages.map((p) => p.id)).toEqual(ids);
    h.push(doc, cmdDeletePage(ids[1]));
    expect(doc.pages.map((p) => p.id)).toEqual([ids[0], ids[2]]);
    h.undo(doc);
    expect(doc.pages.map((p) => p.id)).toEqual(ids);
  });
});

describe('history', () => {
  test('500-step undo torture test', () => {
    const { doc, pageId } = docWithStrokes();
    const before = snapshot(doc);
    const h = new History();
    for (let i = 0; i < History.CAP; i++) {
      h.push(doc, cmdAddStroke(pageId, stroke(`t${i}`)));
    }
    expect(doc.pages[0].strokes).toHaveLength(3 + History.CAP);
    let undone = 0;
    while (h.canUndo) {
      h.undo(doc);
      undone++;
    }
    expect(undone).toBe(History.CAP);
    expect(snapshot(doc)).toBe(before);
    while (h.canRedo) h.redo(doc);
    expect(doc.pages[0].strokes).toHaveLength(3 + History.CAP);
  });

  test('cap evicts the oldest entries', () => {
    const { doc, pageId } = docWithStrokes();
    const h = new History();
    for (let i = 0; i < History.CAP + 50; i++) {
      h.push(doc, cmdAddStroke(pageId, stroke(`t${i}`)));
    }
    let undone = 0;
    while (h.canUndo) {
      h.undo(doc);
      undone++;
    }
    expect(undone).toBe(History.CAP);
    // The 50 evicted strokes stay applied.
    expect(doc.pages[0].strokes).toHaveLength(3 + 50);
  });

  test('a new command clears the redo stack', () => {
    const { doc, pageId } = docWithStrokes();
    const h = new History();
    h.push(doc, cmdAddStroke(pageId, stroke('x')));
    h.undo(doc);
    expect(h.canRedo).toBe(true);
    h.push(doc, cmdAddStroke(pageId, stroke('y')));
    expect(h.canRedo).toBe(false);
  });
});

describe('transform math', () => {
  test('transformPoints applies the affine map and preserves pressure', () => {
    const out = transformPoints([1, 2, 0.7], { a: 2, b: 0, c: 0, d: 3, e: 10, f: 20 });
    expect(out).toEqual([12, 26, 0.7]);
  });
  test('widthScale is √|det|', () => {
    expect(widthScale({ a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 })).toBeCloseTo(2);
    expect(widthScale({ a: 0, b: 1, c: -1, d: 0, e: 0, f: 0 })).toBeCloseTo(1);
  });
});
