import { describe, expect, it } from "vitest";
import { STAFF_PASSWORD_MIN_LENGTH, STUDENT_PASSWORD_MIN_LENGTH } from "@/constants";
import { authBanFor, needsPersonRecord } from "@/features/accounts/domain";
import type { CurrentAccount } from "@/features/authentication/types";
import { canChangeAccount, canManageAccounts, canResetPasswords, canViewAccounts } from "@/lib/permissions";
import { BundleChangeSchema, ChangeStatusSchema, createAccountSchema } from "@/lib/validation/schemas";

function account(role: CurrentAccount["role"], capabilities: string[], userId = "00000000-0000-0000-0000-00000000000a"): CurrentAccount {
  return { userId, username: "x", displayName: "X", role, status: "active", capabilities: new Set(capabilities) };
}
const superadmin = account("superadmin", ["accounts.manage", "accounts.view", "accounts.reset_password"]);
const staffViewer = account("administrator", ["accounts.view"], "00000000-0000-0000-0000-00000000000b");
const student = account("student", ["practice.participate"], "00000000-0000-0000-0000-00000000000c");

describe("permissions", () => {
  it("only accounts.manage may manage; accounts.view may only view", () => {
    expect(canManageAccounts(superadmin)).toBe(true);
    expect(canManageAccounts(staffViewer)).toBe(false);
    expect(canViewAccounts(staffViewer)).toBe(true);
    expect(canViewAccounts(student)).toBe(false);
    expect(canResetPasswords(staffViewer)).toBe(false);
  });
  it("a manager cannot change their own account or any Superadministrator", () => {
    expect(canChangeAccount(superadmin, { userId: superadmin.userId, role: "superadmin" })).toBe(false);
    expect(canChangeAccount(superadmin, { userId: "00000000-0000-0000-0000-0000000000ff", role: "superadmin" })).toBe(false);
    expect(canChangeAccount(superadmin, { userId: student.userId, role: "student" })).toBe(true);
    expect(canChangeAccount(staffViewer, { userId: student.userId, role: "student" })).toBe(false);
  });
});

describe("account lifecycle", () => {
  it("bans every non-active state at the auth provider and lifts the ban on activation", () => {
    expect(authBanFor("active")).toBe("none");
    for (const status of ["suspended", "blocked", "deactivated", "archived", "invited"] as const) {
      expect(authBanFor(status)).not.toBe("none");
    }
  });
  it("creates a longitudinal person record for students only", () => {
    expect(needsPersonRecord("student")).toBe(true);
    expect(needsPersonRecord("administrator")).toBe(false);
  });
});

describe("account schemas", () => {
  const schema = createAccountSchema(12);
  it("requires an e-mail username for administrators and forbids it for students", () => {
    expect(schema.safeParse({ username: "haris.test@idss.ba", displayName: "A", role: "administrator", password: "x".repeat(12) }).success).toBe(true);
    expect(schema.safeParse({ username: "ana.test", displayName: "A", role: "administrator", password: "x".repeat(12) }).success).toBe(false);
    expect(schema.safeParse({ username: "ana@x.ba", displayName: "A", role: "student", password: "x".repeat(12) }).success).toBe(false);
    expect(schema.safeParse({ username: "ana.test", displayName: "A", role: "student", password: "x".repeat(12) }).success).toBe(true);
  });
  it("uses 10 characters for students and 12 for staff (AMB-15)", () => {
    expect(STUDENT_PASSWORD_MIN_LENGTH).toBe(10);
    expect(STAFF_PASSWORD_MIN_LENGTH).toBe(12);
    const studentSchema = createAccountSchema(STUDENT_PASSWORD_MIN_LENGTH);
    expect(studentSchema.safeParse({ username: "ana.test", displayName: "A", role: "student", password: "x".repeat(10) }).success).toBe(true);
    expect(studentSchema.safeParse({ username: "ana.test", displayName: "A", role: "student", password: "x".repeat(9) }).success).toBe(false);
  });
  it("never allows creating a Superadministrator and enforces the password minimum", () => {
    expect(schema.safeParse({ username: "boss@idss.ba", displayName: "A", role: "superadmin", password: "x".repeat(12) }).success).toBe(false);
    expect(schema.safeParse({ username: "ana.test", displayName: "A", role: "student", password: "x".repeat(11) }).success).toBe(false);
  });
  it("rejects unknown statuses, bundles and malformed ids", () => {
    expect(ChangeStatusSchema.safeParse({ userId: "not-a-uuid", status: "active" }).success).toBe(false);
    expect(ChangeStatusSchema.safeParse({ userId: "00000000-0000-4000-8000-000000000001", status: "invited" }).success).toBe(false);
    expect(BundleChangeSchema.safeParse({ userId: "00000000-0000-4000-8000-000000000001", bundle: "subject_teacher", grant: "grant" }).success).toBe(false);
    expect(BundleChangeSchema.safeParse({ userId: "00000000-0000-4000-8000-000000000001", bundle: "pedagogue", grant: "grant" }).success).toBe(true);
  });
});
