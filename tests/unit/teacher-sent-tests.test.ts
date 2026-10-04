import { describe, expect, it } from "vitest";
import { testLabel } from "@/features/exams/domain/exam";
import { SendTestSchema } from "@/lib/validation/schemas";

const SUBJECT = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const PERSON = "0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d";
const base = { subjectId: SUBJECT, kind: "full", positions: [], minutes: null, audience: "all", persons: [], note: "" };

describe("teacher-sent tests (PDL-043)", () => {
  it("labels a part with its positions in order and a whole test plainly", () => {
    const labels = { full: "Cijeli test", part: "Dio testa (pozicije {positions})" };
    expect(testLabel("part", [8, 6, 7], labels)).toBe("Dio testa (pozicije 6, 7, 8)");
    expect(testLabel("full", null, labels)).toBe("Cijeli test");
    expect(testLabel("part", [], labels)).toBe("Cijeli test");
  });

  it("accepts a whole test to all students without positions or minutes", () => {
    expect(SendTestSchema.safeParse(base).success).toBe(true);
  });

  it("requires positions and the teacher's minutes for a part (T2, T3)", () => {
    expect(SendTestSchema.safeParse({ ...base, kind: "part", positions: ["6", "7"], minutes: "25" }).success).toBe(true);
    expect(SendTestSchema.safeParse({ ...base, kind: "part", positions: [], minutes: "25" }).success).toBe(false);
    expect(SendTestSchema.safeParse({ ...base, kind: "part", positions: ["6"], minutes: null }).success).toBe(false);
    expect(SendTestSchema.safeParse({ ...base, kind: "part", positions: ["31"], minutes: "10" }).success).toBe(false);
    expect(SendTestSchema.safeParse({ ...base, kind: "part", positions: ["6"], minutes: "0" }).success).toBe(false);
  });

  it("refuses minutes or positions on a whole test (the catalogue sets its time)", () => {
    expect(SendTestSchema.safeParse({ ...base, minutes: "60" }).success).toBe(false);
    expect(SendTestSchema.safeParse({ ...base, positions: ["1"] }).success).toBe(false);
  });

  it("needs at least one valid student when sending to chosen students", () => {
    expect(SendTestSchema.safeParse({ ...base, audience: "chosen", persons: [] }).success).toBe(false);
    expect(SendTestSchema.safeParse({ ...base, audience: "chosen", persons: ["x"] }).success).toBe(false);
    expect(SendTestSchema.safeParse({ ...base, audience: "chosen", persons: [PERSON] }).success).toBe(true);
  });
});
