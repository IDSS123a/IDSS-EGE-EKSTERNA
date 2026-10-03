import { describe, expect, it } from "vitest";
import { TeacherNoteSchema } from "@/lib/validation/schemas";

const personId = "22222222-2222-4222-8222-22222222222c";

describe("teacher note input (migration 028, PDL-034)", () => {
  it("accepts a note for one of the three exam subjects and trims it", () => {
    const parsed = TeacherNoteSchema.parse({ personId, subject: "mathematics", body: "  Razlomci ponoviti  " });
    expect(parsed.body).toBe("Razlomci ponoviti");
  });

  it("refuses an empty note, an unknown subject and a note longer than 4000 characters", () => {
    expect(TeacherNoteSchema.safeParse({ personId, subject: "mathematics", body: "   " }).success).toBe(false);
    expect(TeacherNoteSchema.safeParse({ personId, subject: "english", body: "x" }).success).toBe(false);
    expect(TeacherNoteSchema.safeParse({ personId, subject: "german", body: "x".repeat(4001) }).success).toBe(false);
    expect(TeacherNoteSchema.safeParse({ personId: "x", subject: "german", body: "x" }).success).toBe(false);
  });
});
