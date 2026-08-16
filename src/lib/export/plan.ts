// Which sheet each part of a compiled project lands on. Pure, so the arithmetic
// the contents page links against is testable.

/** Entries past this fall onto a second contents sheet. */
export const CONTENTS_PER_SHEET = 28;

export interface ProjectPlan {
  /** Sheets the contents runs to: title is 0, contents 1…n. */
  contentsSheets: number;
  /** 0-based sheet index of each notebook's title page, in the given order. */
  starts: number[];
  total: number;
}

export function planProject(pageCounts: number[], perSheet = CONTENTS_PER_SHEET): ProjectPlan {
  const contentsSheets = Math.max(1, Math.ceil(pageCounts.length / perSheet));
  let cursor = 1 + contentsSheets;
  const starts = pageCounts.map((pages) => {
    const at = cursor;
    cursor += 1 + pages;
    return at;
  });
  return { contentsSheets, starts, total: cursor };
}
