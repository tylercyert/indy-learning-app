import type { StreakV1 } from '../contracts';

/** YYYY-MM-DD in the learner's local calendar. */
export function toLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dayDiff(from: string, to: string): number {
  const a = Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10)));
  const b = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10)));
  return Math.round((b - a) / 86_400_000);
}

/**
 * Called when meaningful learning activity happens (a lesson completed).
 * Same day: unchanged. Next day: +1. Any gap: back to 1. Never decrements on its own.
 */
export function recordActivity(streak: StreakV1, today: string): StreakV1 {
  if (!streak.lastActiveDate) return { count: 1, lastActiveDate: today };
  const gap = dayDiff(streak.lastActiveDate, today);
  if (gap <= 0) return streak;
  if (gap === 1) return { count: streak.count + 1, lastActiveDate: today };
  return { count: 1, lastActiveDate: today };
}

/** For display: a streak is "alive" today or yesterday; older than that shows as 0 until activity. */
export function displayedStreak(streak: StreakV1, today: string): number {
  if (!streak.lastActiveDate) return 0;
  return dayDiff(streak.lastActiveDate, today) <= 1 ? streak.count : 0;
}
