import { z } from "zod";
import gamification from "../../../config/gamification.json";

/** Approved XP and badge values (config/gamification.json, PDL-029): the defaults when no setting is stored (PDL-040 K5). */
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

/** The values as the database function takes them: the Director's settings (PDL-040 K5) with the daily mission goal. */
export function gamificationValues(settings: { missionGoal: number; gamification: { xp: typeof GAMIFICATION.xp; badges: typeof GAMIFICATION.badges } }): { mission_goal: number; xp: typeof GAMIFICATION.xp; badges: typeof GAMIFICATION.badges } {
  return { mission_goal: settings.missionGoal, xp: settings.gamification.xp, badges: settings.gamification.badges };
}
