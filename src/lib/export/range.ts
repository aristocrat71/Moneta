// Which pages an export covers. Kept out of index.ts so the arithmetic is
// testable without a DOM or the IPC layer behind it.

/** Inclusive, 1-based page numbers — the same numbers the export sheet shows. */
export interface PageRange {
  from: number;
  to: number;
}

function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.min(hi, Math.max(lo, Math.round(v)));
}

/**
 * Fits a requested range onto a notebook of `total` pages. No range means the
 * whole notebook. A backwards or out-of-bounds one is pulled back inside
 * rather than refused: the sheet lets you type freely and snaps on the way
 * out, so this must always name real pages.
 */
export function resolveRange(total: number, range?: PageRange | null): PageRange {
  const last = Math.max(1, Math.floor(total));
  if (!range) return { from: 1, to: last };
  const from = clamp(range.from, 1, last);
  return { from, to: clamp(range.to, from, last) };
}

/** Names the slice in the filename, so exporting part of a notebook never
 *  silently overwrites the whole one. Empty when the range is everything. */
export function rangeSuffix(range: PageRange, total: number): string {
  if (range.from <= 1 && range.to >= total) return '';
  return range.from === range.to
    ? ` (page ${range.from})`
    : ` (pages ${range.from}-${range.to})`;
}
