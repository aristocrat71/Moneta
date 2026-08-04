import { describe, expect, test } from 'vitest';
import { parseNotebook, serializeNotebook } from './serialize';
import { newNotebook, newPage, type NotebookDoc } from './model';
import type { StrokeData, TemplateKind } from '$lib/ink/engine';

// Deterministic PRNG so failures reproduce.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomDoc(seed: number): NotebookDoc {
  const rnd = mulberry32(seed);
  const templates: TemplateKind[] = ['blank', 'ruled', 'grid', 'dotted'];
  const doc = newNotebook({ title: `Notebook ${seed}` });
  doc.pages = [];
  const pageCount = 1 + Math.floor(rnd() * 4);
  for (let p = 0; p < pageCount; p++) {
    const page = newPage(templates[Math.floor(rnd() * 4)]);
    const strokeCount = Math.floor(rnd() * 30);
    for (let s = 0; s < strokeCount; s++) {
      const points: number[] = [];
      const n = 1 + Math.floor(rnd() * 50);
      for (let i = 0; i < n; i++) {
        // Two-decimal values survive the round-trip exactly.
        points.push(
          Math.round(rnd() * 124000) / 100,
          Math.round(rnd() * 175400) / 100,
          Math.round(rnd() * 100) / 100,
        );
      }
      const stroke: StrokeData = {
        id: crypto.randomUUID(),
        tool: rnd() > 0.8 ? 'highlighter' : 'pen',
        color: rnd() > 0.5 ? 'ink/gall' : '#a84a6b',
        width: Math.round((0.5 + rnd() * 20) * 100) / 100,
        points,
      };
      page.strokes.push(stroke);
    }
    doc.pages.push(page);
  }
  doc.lastOpenPage = Math.floor(rnd() * doc.pages.length);
  return doc;
}

describe('serialization round-trip', () => {
  test('random documents survive save → load → deep-equal', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const doc = randomDoc(seed);
      const restored = parseNotebook(serializeNotebook(doc));
      expect(restored).toEqual(doc);
    }
  });

  test('points are rounded to two decimals on write', () => {
    const doc = newNotebook({ title: 'precise' });
    doc.pages[0].strokes.push({
      id: 's1',
      tool: 'pen',
      color: 'ink/black',
      width: 3,
      points: [1.23456, 2.98765, 0.51234],
    });
    const restored = parseNotebook(serializeNotebook(doc));
    expect(restored.pages[0].strokes[0].points).toEqual([1.23, 2.99, 0.51]);
  });
});
