/**
 * Pure timing for the planning-wait status ticker: which line shows after `elapsedMs`, and whether
 * that line is read out to assistive tech. The last line holds; a long wait never cycles back.
 * Announcing every other line keeps a screen reader from narrating the whole wait.
 */
export function statusIndexAt(elapsedMs: number, intervalMs: number, count: number): number {
  if (count <= 0) return 0;
  const tick = Math.floor(Math.max(0, elapsedMs) / Math.max(1, intervalMs));
  return Math.min(tick, count - 1);
}

export function shouldAnnounce(index: number, every: number): boolean {
  return index % Math.max(1, every) === 0;
}

/** Status lines for the ~60 s planning wait; a new course and a new skill tree read differently. */
export const PLANNING_LINES = {
  course: ['Reading your answers…', 'Sketching the path…', 'Picking your companion…', 'Naming the lessons…', 'Writing the first lesson…', 'Almost there…'],
  tree: ['Reading your answers…', 'Sketching the new branch…', 'Finding where it joins the path…', 'Writing its first lesson…', 'Almost there…'],
} as const;
