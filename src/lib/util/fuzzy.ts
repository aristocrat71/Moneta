/** Fuzzy matcher for ⌘K: subsequence match scored by compactness and word starts. */
export function fuzzyScore(query: string, target: string): number | null {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (q.length === 0) return 0;
  let score = 0;
  let ti = 0;
  let lastHit = -1;
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi];
    let found = -1;
    while (ti < t.length) {
      if (t[ti] === ch) {
        found = ti;
        ti++;
        break;
      }
      ti++;
    }
    if (found === -1) return null;
    if (found === 0 || t[found - 1] === ' ' || t[found - 1] === '-') score += 8;
    if (lastHit >= 0 && found === lastHit + 1) score += 5;
    score -= (found - lastHit) * 0.4;
    lastHit = found;
  }
  score -= t.length * 0.05;
  return score;
}
