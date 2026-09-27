import { describe, expect, it } from "vitest";
import { missionProgress, percent, streakDays, sumProgress } from "@/features/practice/domain/progress";
import type { AreaProgress } from "@/features/practice/types";
import { PracticeAnswerSchema } from "@/lib/validation/schemas";

/** Game Hub arithmetic (PDL-024): learning signals, never grades (P-7). */
describe("practice progress", () => {
  it("counts consecutive practice days up to today or yesterday", () => {
    expect(streakDays(["2026-09-27", "2026-09-26", "2026-09-25", "2026-09-22"], "2026-09-27")).toBe(3);
    expect(streakDays(["2026-09-26", "2026-09-25"], "2026-09-27")).toBe(2);
    expect(streakDays(["2026-09-24"], "2026-09-27")).toBe(0);
    expect(streakDays([], "2026-09-27")).toBe(0);
    expect(streakDays(["2026-03-01", "2026-02-28"], "2026-03-01")).toBe(2);
  });

  it("sums areas and computes whole percent", () => {
    const area = (total: number, answered: number, correct: number, awaiting: number): AreaProgress => ({ subjectId: "s", subjectCode: "mathematics", areaId: "a", area: "A", ordinal: 1, total, answered, correct, awaiting });
    expect(sumProgress([area(20, 5, 3, 1), area(20, 2, 2, 0)])).toEqual({ total: 40, answered: 7, correct: 5, awaiting: 1 });
    expect(percent(5, 40)).toBe(13);
    expect(percent(0, 0)).toBe(0);
  });

  it("caps the daily mission at its goal", () => {
    expect(missionProgress(3, 5)).toEqual({ done: 3, goal: 5, complete: false });
    expect(missionProgress(8, 5)).toEqual({ done: 5, goal: 5, complete: true });
  });

  it("accepts one text response per item and nothing else", () => {
    const base = { questionVersionId: "11111111-1111-4111-8111-111111111111", subjectId: "22222222-2222-4222-8222-222222222222" };
    expect(PracticeAnswerSchema.safeParse({ ...base, responses: [{ item: null, response: "b" }] }).success).toBe(true);
    expect(PracticeAnswerSchema.safeParse({ ...base, responses: [{ item: 1, response: "r" }, { item: 2, response: "f" }] }).success).toBe(true);
    expect(PracticeAnswerSchema.safeParse({ ...base, responses: [] }).success).toBe(false);
    expect(PracticeAnswerSchema.safeParse({ ...base, responses: [{ item: 0, response: "r" }] }).success).toBe(false);
    expect(PracticeAnswerSchema.safeParse({ ...base, responses: [{ item: null, response: "x".repeat(4001) }] }).success).toBe(false);
  });
});
