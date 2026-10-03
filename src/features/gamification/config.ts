import { z } from "zod";
import gamification from "../../../config/gamification.json";
import { DAILY_MISSION_GOAL } from "@/constants";

/** Approved XP and badge values (config/gamification.json, PDL-029), checked at load. */
const ValuesSchema = z.object({
  version: z.string(),
  xp: z.object({
    answer_correct: z.number().min(0),
    answer_partly_correct: z.number().min(0),
    answer_incorrect: z.number().min(0),
    mission_completed: z.number().min(0),
    practice_day: z.number().min(0),
    mock_exam_submitted: z.number().min(0),
    mock_exam_point: z.number().min(0),
    mock_exam_points_cap: z.number().min(0),
  }),
  badges: z.object({ streak_days: z.number().int().positive(), answers_in_subject: z.number().int().positive() }),
});

export const GAMIFICATION = ValuesSchema.parse(gamification);

/** The values as the database function takes them, with the daily mission goal (PDL-024). */
export function gamificationValues(): { mission_goal: number; xp: typeof GAMIFICATION.xp; badges: typeof GAMIFICATION.badges } {
  return { mission_goal: DAILY_MISSION_GOAL, xp: GAMIFICATION.xp, badges: GAMIFICATION.badges };
}
