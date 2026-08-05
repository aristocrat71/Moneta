// Which pages an export covers — kept pure so the arithmetic is testable.

/** Inclusive, 1-based page numbers — the same numbers the export sheet shows. */
export interface PageRange {
  from: number;
  to: number;
}

function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.min(hi, Math.max(lo, Math.round(v)));
}

/** Fits a range onto a notebook of `total` pages. No range means all of them; a
 *  backwards or out-of-bounds one is pulled inside rather than refused. */
export function resolveRange(total: number, range?: PageRange | null): PageRange {
  const last = Math.max(1, Math.floor(total));
  if (!range) return { from: 1, to: last };
  const from = clamp(range.from, 1, last);
  return { from, to: clamp(range.to, from, last) };
}

/** Names a partial export in the filename so it can't overwrite the whole one. */
export function rangeSuffix(range: PageRange, total: number): string {
  if (range.from <= 1 && range.to >= total) return '';
  return range.from === range.to
    ? ` (page ${range.from})`
    : ` (pages ${range.from}-${range.to})`;
}
