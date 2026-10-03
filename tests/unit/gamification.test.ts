import { describe, expect, it } from "vitest";
import { GAMIFICATION, gamificationValues } from "@/features/gamification/config";
import { xpTotal } from "@/features/gamification/domain/xp";
import { DAILY_MISSION_GOAL } from "@/constants";

describe("XP and badges (PDL-029)", () => {
  it("holds exactly the values the Director approved", () => {
    expect(GAMIFICATION.xp).toEqual({
      answer_correct: 10,
      answer_partly_correct: 5,
      answer_incorrect: 2,
      mission_completed: 20,
      practice_day: 5,
      mock_exam_submitted: 30,
      mock_exam_point: 10,
      mock_exam_points_cap: 100,
    });
    expect(GAMIFICATION.badges).toEqual({ streak_days: 7, answers_in_subject: 50 });
  });

  it("passes the daily mission goal with the values", () => {
    expect(gamificationValues().mission_goal).toBe(DAILY_MISSION_GOAL);
  });

  it("adds XP of all sources", () => {
    expect(xpTotal({ answers: 114, missions: 20, practiceDays: 5, examsSubmitted: 30, examsGraded: 75 })).toBe(244);
  });
});
