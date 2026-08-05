import { describe, expect, test } from 'vitest';
import { rangeSuffix, resolveRange } from './range';

describe('resolveRange', () => {
  test('no range means the whole notebook', () => {
    expect(resolveRange(12)).toEqual({ from: 1, to: 12 });
    expect(resolveRange(12, null)).toEqual({ from: 1, to: 12 });
  });

  test('keeps a range that already fits', () => {
    expect(resolveRange(12, { from: 3, to: 7 })).toEqual({ from: 3, to: 7 });
  });

  test('pulls an out-of-bounds range back inside', () => {
    expect(resolveRange(12, { from: 0, to: 99 })).toEqual({ from: 1, to: 12 });
    expect(resolveRange(12, { from: 40, to: 60 })).toEqual({ from: 12, to: 12 });
  });

  test('a backwards range collapses onto its start', () => {
    expect(resolveRange(12, { from: 8, to: 3 })).toEqual({ from: 8, to: 8 });
  });

  test('half-typed input never names a page that is not there', () => {
    expect(resolveRange(12, { from: NaN, to: 5 })).toEqual({ from: 1, to: 5 });
    expect(resolveRange(12, { from: 4, to: NaN })).toEqual({ from: 4, to: 4 });
    expect(resolveRange(12, { from: 2.6, to: 4.2 })).toEqual({ from: 3, to: 4 });
  });

  test('a notebook always has a page to export', () => {
    expect(resolveRange(0)).toEqual({ from: 1, to: 1 });
  });
});

describe('rangeSuffix', () => {
  test('the whole notebook keeps its plain name', () => {
    expect(rangeSuffix({ from: 1, to: 12 }, 12)).toBe('');
  });

  test('a slice names itself so it cannot overwrite the whole export', () => {
    expect(rangeSuffix({ from: 2, to: 5 }, 12)).toBe(' (pages 2-5)');
    expect(rangeSuffix({ from: 3, to: 3 }, 12)).toBe(' (page 3)');
  });

  test('a one-page notebook exported whole is not a slice', () => {
    expect(rangeSuffix({ from: 1, to: 1 }, 1)).toBe('');
  });
});
