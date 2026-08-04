import { describe, expect, test } from 'vitest';
import { MigrationError, migrateNotebook } from './migrate';
import { FORMAT_VERSION, PAGE_SIZE } from './model';

describe('migrateNotebook', () => {
  test('passes a well-formed v1 document through', () => {
    const raw = {
      formatVersion: 1,
      id: 'nb-1',
      title: 'Systems Design',
      projectId: 'proj-1',
      createdAt: 100,
      modifiedAt: 200,
      lastOpenPage: 1,
      pages: [
        { id: 'p1', template: 'ruled', size: { w: 1240, h: 1754 }, strokes: [] },
        {
          id: 'p2',
          template: 'grid',
          size: { w: 1240, h: 1754 },
          strokes: [
            {
              id: 's1',
              tool: 'pen',
              color: 'ink/black',
              width: 3,
              points: [1, 2, 0.5, 3, 4, 0.6],
            },
          ],
        },
      ],
    };
    const doc = migrateNotebook(raw);
    expect(doc.formatVersion).toBe(FORMAT_VERSION);
    expect(doc.title).toBe('Systems Design');
    expect(doc.lastOpenPage).toBe(1);
    expect(doc.pages[1].strokes[0].points).toEqual([1, 2, 0.5, 3, 4, 0.6]);
  });

  test('fills defaults for missing fields', () => {
    const doc = migrateNotebook({ id: 'x' });
    expect(doc.title).toBe('Untitled');
    expect(doc.projectId).toBeNull();
    expect(doc.pages).toHaveLength(1);
    expect(doc.pages[0].template).toBe('blank');
    expect(doc.pages[0].size).toEqual(PAGE_SIZE);
  });

  test('clamps lastOpenPage into range', () => {
    const doc = migrateNotebook({ id: 'x', lastOpenPage: 99, pages: [{}, {}] });
    expect(doc.lastOpenPage).toBe(1);
  });

  test('drops malformed strokes and truncates ragged point arrays', () => {
    const doc = migrateNotebook({
      id: 'x',
      pages: [
        {
          strokes: [
            { id: 's1', tool: 'pen', color: '#123456', width: 2, points: [1, 2, 0.5, 9] },
            { id: 's2', tool: 'pen', color: 'ink/black', width: 2, points: [] },
            'garbage',
          ],
        },
      ],
    });
    expect(doc.pages[0].strokes).toHaveLength(1);
    expect(doc.pages[0].strokes[0].points).toEqual([1, 2, 0.5]);
  });

  test('rejects documents from a newer format', () => {
    expect(() => migrateNotebook({ formatVersion: FORMAT_VERSION + 1 })).toThrow(
      MigrationError,
    );
  });

  test('rejects non-objects', () => {
    expect(() => migrateNotebook('nope')).toThrow(MigrationError);
    expect(() => migrateNotebook(null)).toThrow(MigrationError);
  });
});
