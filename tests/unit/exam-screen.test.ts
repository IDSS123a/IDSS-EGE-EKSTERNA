import { describe, expect, it } from "vitest";
import { answeredCount, clockOffsetMs, formatClock, formatPoints, groupByPosition, remainingMs } from "@/features/exams/domain/exam";
import type { ExamUnit } from "@/features/exams/types";

const unit = (id: string, position: number, sequence: number, questionVersionId: string, item: number | null = null): ExamUnit => ({
  id,
  position,
  sequence,
  questionVersionId,
  item,
  format: item === null ? "choice" : "task",
  scoring: item === null ? "single" : "per_item",
  mode: "choice",
  maxPoints: 1,
  allowedPoints: [0, 1],
  response: "",
  finalPoints: null,
  correctPairs: null,
  note: null,
  solution: null,
});

describe("mock exam clock (server time is the authority)", () => {
  it("measures the offset between server and browser clocks", () => {
    expect(clockOffsetMs("2026-10-03T10:00:05.000Z", Date.parse("2026-10-03T10:00:00.000Z"))).toBe(5000);
    expect(clockOffsetMs("not a date", 0)).toBe(0);
  });

  it("counts down on the server clock and never below zero", () => {
    const now = Date.parse("2026-10-03T10:00:00.000Z");
    expect(remainingMs("2026-10-03T11:30:00.000Z", now, 0)).toBe(90 * 60_000);
    // The browser clock is 5 s behind the server: 5 s less remain.
    expect(remainingMs("2026-10-03T10:01:00.000Z", now, 5000)).toBe(55_000);
    expect(remainingMs("2026-10-03T09:59:00.000Z", now, 0)).toBe(0);
  });

  it("formats the countdown", () => {
    expect(formatClock(90 * 60_000)).toBe("1:30:00");
    expect(formatClock(59 * 60_000 + 1)).toBe("59:01");
    expect(formatClock(4_000)).toBe("00:04");
    expect(formatClock(-10)).toBe("00:00");
  });
});

describe("mock exam layout", () => {
  it("groups units by position, then by question, in sequence order", () => {
    const groups = groupByPosition([unit("c", 2, 3, "q2", 2), unit("a", 1, 1, "q1"), unit("b", 2, 2, "q2", 1), unit("d", 2, 4, "q3", 1)]);
    expect(groups.map((group) => group.position)).toEqual([1, 2]);
    expect(groups[1].questions.map((question) => [question.questionVersionId, question.units.map((entry) => entry.id)])).toEqual([
      ["q2", ["b", "c"]],
      ["q3", ["d"]],
    ]);
  });

  it("counts answered units and formats points per locale", () => {
    expect(answeredCount({ a: "b", b: "  ", c: "1 c, 2 a" })).toBe(2);
    expect(formatPoints(0.5, "bs")).toBe("0,5");
    expect(formatPoints(18, "en")).toBe("18");
  });
});
