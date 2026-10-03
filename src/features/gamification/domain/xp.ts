import type { XpBreakdown } from "../types";

/** Total XP of all sources (framework-free, M-5). */
export function xpTotal(xp: XpBreakdown): number {
  return xp.answers + xp.missions + xp.practiceDays + xp.examsSubmitted + xp.examsGraded;
}
