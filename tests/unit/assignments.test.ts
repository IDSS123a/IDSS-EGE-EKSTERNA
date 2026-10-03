import { describe, expect, it } from "vitest";
import { answeredPercent, parseKeys, sarajevoLocalToIso } from "@/features/assignments/domain/assignments";

describe("assignment input (PDL-035)", () => {
  it("reads catalogue keys in any separator, upper case, once each", () => {
    expect(parseKeys("mat-5.1.1, MAT-5.1.2;\nmat-5.1.1  DEU-4.3.34")).toEqual(["MAT-5.1.1", "MAT-5.1.2", "DEU-4.3.34"]);
    expect(parseKeys("  ")).toEqual([]);
  });

  it("reads the due date as Europe/Sarajevo time, summer and winter", () => {
    expect(sarajevoLocalToIso("2026-10-10T20:00")).toBe("2026-10-10T18:00:00.000Z");
    expect(sarajevoLocalToIso("2026-12-01T08:30")).toBe("2026-12-01T07:30:00.000Z");
    expect(sarajevoLocalToIso("2026-10-25T12:00")).toBe("2026-10-25T11:00:00.000Z");
  });

  it("refuses an impossible date", () => {
    expect(sarajevoLocalToIso("2026-02-30T10:00")).toBeNull();
    expect(sarajevoLocalToIso("2026-10-10")).toBeNull();
  });

  it("shows progress as a whole percent", () => {
    expect(answeredPercent(1, 3)).toBe(33);
    expect(answeredPercent(0, 0)).toBe(0);
  });
});

describe("assignment and push input schemas (PDL-035, PDL-037)", async () => {
  const { AssignmentSchema, PushSubscriptionSchema } = await import("@/lib/validation/schemas");
  const base = { subject: "mathematics", title: "Ponavljanje", instruction: "", due: "2026-10-10T20:00", content: "keys", keys: ["MAT-5.1.1"], areaId: "", count: "", audience: "all", personIds: [] };

  it("accepts picked keys for all students and an area with a count for chosen students", () => {
    expect(AssignmentSchema.safeParse(base).success).toBe(true);
    expect(AssignmentSchema.safeParse({ ...base, content: "area", keys: [], areaId: "22222222-2222-4222-8222-222222222222", count: "5", audience: "chosen", personIds: ["22222222-2222-4222-8222-22222222222c"] }).success).toBe(true);
  });

  it("refuses missing content, missing students, a bad due date and more than 50 questions", () => {
    expect(AssignmentSchema.safeParse({ ...base, keys: [] }).success).toBe(false);
    expect(AssignmentSchema.safeParse({ ...base, audience: "chosen" }).success).toBe(false);
    expect(AssignmentSchema.safeParse({ ...base, due: "10.10.2026" }).success).toBe(false);
    expect(AssignmentSchema.safeParse({ ...base, content: "area", keys: [], areaId: "22222222-2222-4222-8222-222222222222", count: "51" }).success).toBe(false);
  });

  it("accepts only https push endpoints", () => {
    const subscription = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", p256dh: "p".repeat(87), auth: "a".repeat(22), userAgent: null };
    expect(PushSubscriptionSchema.safeParse(subscription).success).toBe(true);
    expect(PushSubscriptionSchema.safeParse({ ...subscription, endpoint: "http://example.com/x" }).success).toBe(false);
  });
});
