import { describe, expect, it } from "vitest";
import { csvCell, daysSince, droppedAgainstOwnPrevious, readinessPercent, share, toCsv, withoutPracticeFor } from "@/features/support/domain/indicators";
import type { OverviewStudent } from "@/features/support/types";

const student = (lastActivity: string | null, exams: number[] = []): OverviewStudent => ({
  personId: "p",
  name: "A.B.",
  lastActivity,
  days7: 0,
  days30: 0,
  subjects: [{ code: "mathematics", total: 200, answered: 10, mastered: 4, checked30: 8, correct30: 4, exams: exams.map((points) => ({ points, max: 10, gradedAt: "2026-10-01T10:00:00Z" })), open: 0, readiness: { state: "not_available", exams: 0, errors: 0 } }],
});

describe("support monitoring facts (SUPPORT_MONITORING.md, P-4)", () => {
  it("shows no percentage when nothing was checked", () => {
    expect(share(9, 24)).toBe(38);
    expect(share(0, 0)).toBeNull();
  });

  it("counts days since the last activity and filters by the user's N", () => {
    expect(daysSince("2026-09-27T22:34:19Z", "2026-10-03")).toBe(6);
    expect(daysSince(null, "2026-10-03")).toBeNull();
    expect(withoutPracticeFor(student("2026-09-27T22:34:19Z"), 7, "2026-10-03")).toBe(false);
    expect(withoutPracticeFor(student("2026-09-27T22:34:19Z"), 5, "2026-10-03")).toBe(true);
    expect(withoutPracticeFor(student(null), 30, "2026-10-03")).toBe(true);
  });

  it("compares a student only with the student's own previous mock exam", () => {
    expect(droppedAgainstOwnPrevious(student(null, [6, 8]))).toBe(true);
    expect(droppedAgainstOwnPrevious(student(null, [8, 6]))).toBe(false);
    expect(droppedAgainstOwnPrevious(student(null, [6]))).toBe(false);
  });

  it("maps the readiness scale to a percentage only where the scale has one (PDL-032)", () => {
    expect(readinessPercent({ state: "100", exams: 3, errors: 0 })).toBe(100);
    expect(readinessPercent({ state: "90", exams: 3, errors: 2 })).toBe(90);
    expect(readinessPercent({ state: "80", exams: 3, errors: 3 })).toBe(80);
    expect(readinessPercent({ state: "below_80", exams: 3, errors: 5 })).toBeNull();
    expect(readinessPercent({ state: "not_available", exams: 1, errors: 0 })).toBeNull();
  });
});

describe("CSV export", () => {
  it("neutralises formula injection and quotes every cell", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+1")).toBe("\"'+1\"");
    expect(csvCell("-1")).toBe("\"'-1\"");
    expect(csvCell("@SUM(A1)")).toBe("\"'@SUM(A1)\"");
    expect(csvCell("A.B.")).toBe("\"A.B.\"");
    expect(csvCell(null)).toBe("\"\"");
  });

  it("writes a UTF-8 BOM, semicolons and CRLF", () => {
    expect(toCsv([["Učenik", 5], ["A.B.", null]])).toBe("﻿\"Učenik\";\"5\"\r\n\"A.B.\";\"\"\r\n");
  });
});
