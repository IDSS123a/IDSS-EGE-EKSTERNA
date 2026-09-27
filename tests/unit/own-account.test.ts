import { describe, expect, it } from "vitest";
import { changeOwnPasswordSchema } from "@/lib/validation/schemas";

describe("own password change", () => {
  const schema = changeOwnPasswordSchema(12);
  it("accepts a new password of the role minimum typed twice", () => {
    expect(schema.safeParse({ currentPassword: "old-password-1", newPassword: "new-password-12", confirmPassword: "new-password-12" }).success).toBe(true);
  });
  it("rejects a short, mismatched or unchanged password with its reason", () => {
    expect(schema.safeParse({ currentPassword: "x", newPassword: "short", confirmPassword: "short" }).success).toBe(false);
    const mismatch = schema.safeParse({ currentPassword: "x", newPassword: "new-password-12", confirmPassword: "new-password-13" });
    expect(mismatch.success ? null : mismatch.error.issues[0].message).toBe("MISMATCH");
    const unchanged = schema.safeParse({ currentPassword: "same-password-1", newPassword: "same-password-1", confirmPassword: "same-password-1" });
    expect(unchanged.success ? null : unchanged.error.issues[0].message).toBe("UNCHANGED");
  });
  it("requires the current password", () => {
    expect(schema.safeParse({ currentPassword: "", newPassword: "new-password-12", confirmPassword: "new-password-12" }).success).toBe(false);
  });
});
