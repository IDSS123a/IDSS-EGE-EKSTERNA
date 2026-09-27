import type { AreaProgress } from "../types";

/**
 * Game Hub arithmetic (PDL-024), framework-free. These are learning signals, never grades (P-7): mastery is the share
 * of a scope's trusted questions whose latest answer was correct; the streak counts consecutive practice days.
 */

/** Consecutive practice days ending today, or ending yesterday when today has no practice yet (dates YYYY-MM-DD). */
export function streakDays(days: readonly string[], today: string): number {
  const set = new Set(days);
  const step = (date: string, delta: number): string => {
    const value = new Date(`${date}T12:00:00Z`);
    value.setUTCDate(value.getUTCDate() + delta);
    return value.toISOString().slice(0, 10);
  };
  let cursor = set.has(today) ? today : step(today, -1);
  let count = 0;
  while (set.has(cursor)) {
    count += 1;
    cursor = step(cursor, -1);
  }
  return count;
}

/** Totals of several areas (a subject, or everything). */
export function sumProgress(areas: readonly AreaProgress[]): { total: number; answered: number; correct: number; awaiting: number } {
  return areas.reduce(
    (sum, area) => ({ total: sum.total + area.total, answered: sum.answered + area.answered, correct: sum.correct + area.correct, awaiting: sum.awaiting + area.awaiting }),
    { total: 0, answered: 0, correct: 0, awaiting: 0 },
  );
}

/** Whole percent of a part, 0 when the whole is empty. */
export function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/** Progress of the daily mission: answers today against the goal, capped at the goal. */
export function missionProgress(today: number, goal: number): { done: number; goal: number; complete: boolean } {
  return { done: Math.min(today, goal), goal, complete: today >= goal };
}
