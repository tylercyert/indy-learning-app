import { describe, expect, it } from 'vitest';
import { PLANNING_LINES, shouldAnnounce, statusIndexAt } from './status-ticker';

describe('status ticker timing', () => {
  it('advances one line per interval and holds the last line', () => {
    expect(statusIndexAt(0, 7000, 6)).toBe(0);
    expect(statusIndexAt(6999, 7000, 6)).toBe(0);
    expect(statusIndexAt(7000, 7000, 6)).toBe(1);
    expect(statusIndexAt(35_000, 7000, 6)).toBe(5);
    expect(statusIndexAt(120_000, 7000, 6)).toBe(5);
  });

  it('never indexes past the list or before it', () => {
    expect(statusIndexAt(-500, 7000, 6)).toBe(0);
    expect(statusIndexAt(5000, 7000, 0)).toBe(0);
    expect(statusIndexAt(5000, 0, 3)).toBe(2);
  });

  it('announces every other line so the wait is not narrated tick by tick', () => {
    expect([0, 1, 2, 3, 4, 5].map((i) => shouldAnnounce(i, 2))).toEqual([true, false, true, false, true, false]);
    expect(shouldAnnounce(3, 0)).toBe(true);
  });

  it('covers the planning wait with short lines', () => {
    for (const lines of Object.values(PLANNING_LINES)) {
      expect(lines.length).toBeGreaterThanOrEqual(4);
      expect(lines.length).toBeLessThanOrEqual(6);
      for (const line of lines) expect(line.length).toBeLessThanOrEqual(40);
    }
  });
});
