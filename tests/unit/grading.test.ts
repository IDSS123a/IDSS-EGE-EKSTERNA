import { describe, expect, it, vi } from "vitest";

// The config reader is server-only; in unit tests the marker import is a no-op.
vi.mock("server-only", () => ({}));

const { pairChoices, poolRange } = await import("@/features/grading/domain/blueprint");
const { blueprintConfig, BLUEPRINT_VERSION } = await import("@/features/grading/blueprint-config");
const { GradesSchema, BlueprintReviewSchema, SetDiscardSchema } = await import("@/lib/validation/schemas");

const ID = "7522b1fc-c34b-4543-bae9-ed303dc5eb51";

describe("blueprint presentation (PDL-026)", () => {
  it("shows a pool as its first and last record key", () => {
    expect(poolRange({ key: "^DEU-4\\.1\\.([0-9]+)$", from: 1, to: 10 })).toEqual({ first: "DEU-4.1.1", last: "DEU-4.1.10" });
    expect(poolRange({ key: "^BHS-KNJ\\.([0-9]+)$", from: 25, to: 32 })).toEqual({ first: "BHS-KNJ.25", last: "BHS-KNJ.32" });
    expect(poolRange({ key: "^MAT-5\\.[0-9]+\\.([0-9]+)$", from: 16, to: 20 })).toEqual({ first: "MAT-5.x.16", last: "MAT-5.x.20" });
  });

  it("offers the numbers of correct pairs of the confirmed rule", () => {
    expect(pairChoices({ "0": 0, "1": 0, "2": 0.5, "3": 0.5, "4": 1 })).toEqual([0, 1, 2, 3, 4]);
    expect(pairChoices(null)).toEqual([]);
  });

  it("identifies each subject's blueprint by a stable SHA-256 of its entry", () => {
    const math = blueprintConfig("mathematics");
    expect(math?.version).toBe(BLUEPRINT_VERSION);
    expect(math?.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(blueprintConfig("mathematics")?.sha256).toBe(math?.sha256);
    expect(blueprintConfig("german")?.sha256).not.toBe(math?.sha256);
    expect(blueprintConfig("history")).toBeNull();
  });
});

describe("grading validation", () => {
  it("takes points or pairs per unit, never both shapes mixed up", () => {
    expect(GradesSchema.safeParse({ examId: ID, subjectId: ID, scores: [{ id: ID, points: 0.5, note: null }] }).success).toBe(true);
    expect(GradesSchema.safeParse({ examId: ID, subjectId: ID, scores: [{ id: ID, pairs: 3, note: "Par 4 nije tačan" }] }).success).toBe(true);
    expect(GradesSchema.safeParse({ examId: ID, subjectId: ID, scores: [{ id: ID, pairs: 2.5, note: null }] }).success).toBe(false);
    expect(GradesSchema.safeParse({ examId: ID, subjectId: ID, scores: [] }).success).toBe(false);
  });

  it("a rejected blueprint and a discarded set need a reason", () => {
    expect(BlueprintReviewSchema.safeParse({ blueprintId: ID, subjectId: ID, decision: "confirmed" }).success).toBe(true);
    expect(BlueprintReviewSchema.safeParse({ blueprintId: ID, subjectId: ID, decision: "rejected", note: " " }).success).toBe(false);
    expect(SetDiscardSchema.safeParse({ examId: ID, subjectId: ID, note: "", newSet: true }).success).toBe(false);
  });
});
