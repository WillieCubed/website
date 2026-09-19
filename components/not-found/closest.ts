/**
 * Edit distance between two strings, counting insertions, deletions, and
 * substitutions as one step each.
 */
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      diagonal = above;
    }
  }
  return row[b.length];
}

/**
 * The routed path nearest to one that failed, or null when nothing is
 * near enough to be a likely typo. "Near enough" is at most a third of
 * the path's length in edits, so /writing/project-superblom finds the
 * post while /about-me does not land on an unrelated page.
 */
export function closestPath(path: string, candidates: string[]): string | null {
  const target = path.toLowerCase().replace(/\/+$/, '') || '/';
  let best: string | null = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const d = distance(target, candidate.toLowerCase());
    if (d < bestDistance) {
      best = candidate;
      bestDistance = d;
    }
  }
  if (best === null || bestDistance === 0) return null;
  return bestDistance <= Math.max(2, Math.floor(target.length / 3))
    ? best
    : null;
}
