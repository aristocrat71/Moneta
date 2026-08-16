import { describe, expect, test } from 'vitest';
import type { NotebookMeta } from '$lib/ipc';
import { byTitle, sortNotebooks } from './sort';

function nb(title: string, createdAt: number, modifiedAt: number): NotebookMeta {
  return { id: title, title, projectId: null, createdAt, modifiedAt, pageCount: 1 };
}

const LIBRARY = [
  nb('beta', 3, 1),
  nb('Alpha', 1, 3),
  nb('chapter 10', 2, 2),
  nb('chapter 9', 4, 4),
];

const titles = (list: NotebookMeta[]) => list.map((n) => n.title);

describe('byTitle', () => {
  test('ignores case', () => {
    expect(byTitle({ title: 'Alpha' }, { title: 'beta' })).toBeLessThan(0);
  });

  test('counts numbers rather than spelling them', () => {
    expect(byTitle({ title: 'chapter 9' }, { title: 'chapter 10' })).toBeLessThan(0);
  });
});

describe('sortNotebooks', () => {
  test('reverses on the other direction', () => {
    expect(titles(sortNotebooks(LIBRARY, 'edited', 'asc'))).toEqual([
      'beta',
      'chapter 10',
      'Alpha',
      'chapter 9',
    ]);
    expect(titles(sortNotebooks(LIBRARY, 'title', 'desc'))).toEqual([
      'chapter 10',
      'chapter 9',
      'beta',
      'Alpha',
    ]);
  });

  test('each key defaults to the direction that reads right for it', () => {
    expect(titles(sortNotebooks(LIBRARY, 'title'))).toEqual(
      titles(sortNotebooks(LIBRARY, 'title', 'asc')),
    );
    expect(titles(sortNotebooks(LIBRARY, 'edited'))).toEqual(
      titles(sortNotebooks(LIBRARY, 'edited', 'desc')),
    );
  });

  test('orders by last edit, newest first', () => {
    expect(titles(sortNotebooks(LIBRARY, 'edited'))).toEqual([
      'chapter 9',
      'Alpha',
      'chapter 10',
      'beta',
    ]);
  });

  test('orders by creation, newest first', () => {
    expect(titles(sortNotebooks(LIBRARY, 'created'))).toEqual([
      'chapter 9',
      'beta',
      'chapter 10',
      'Alpha',
    ]);
  });

  test('orders by title', () => {
    expect(titles(sortNotebooks(LIBRARY, 'title'))).toEqual([
      'Alpha',
      'beta',
      'chapter 9',
      'chapter 10',
    ]);
  });

  test('same timestamp settles on the title instead of shuffling', () => {
    const tied = [nb('b', 1, 1), nb('a', 1, 1)];
    expect(titles(sortNotebooks(tied, 'edited'))).toEqual(['a', 'b']);
  });

  test('leaves the given list alone', () => {
    const list = [...LIBRARY];
    sortNotebooks(list, 'title');
    expect(titles(list)).toEqual(titles(LIBRARY));
  });
});
