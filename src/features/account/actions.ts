"use server";

import { headers } from "next/headers";
import { STAFF_PASSWORD_MIN_LENGTH, STUDENT_PASSWORD_MIN_LENGTH } from "@/constants";
import { auditIfFailed } from "@/features/audit/failures";
import { clientIpFrom, hashUsername, isLoginLocked, usernameToAuthEmail } from "@/features/authentication/domain";
import { countRecentLoginFailures, insertAuditLog, insertSecurityEvent } from "@/features/authentication/repository";
import { getCurrentAccount } from "@/features/authentication/session";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { createSupabaseVerifierClient } from "@/lib/db/supabase-verifier";
import { logError, logInfo } from "@/lib/logger";
import { changeOwnPasswordSchema } from "@/lib/validation/schemas";

/** Machine codes of the own-password action; the UI localises them (AMB-11). */
export type OwnPasswordErrorCode = "UNAUTHENTICATED" | "VALIDATION" | "MISMATCH" | "UNCHANGED" | "WRONG_PASSWORD" | "LOCKED" | "UNAVAILABLE";
export type OwnPasswordResult = { success: true; data: { message: "PASSWORD_CHANGED" } } | { success: false; code: OwnPasswordErrorCode };

/**
 * POST (Server Action) changeOwnPasswordAction
 * Role required: any active account, for its own password only (no user id is accepted).
 * Body: FormData { currentPassword, newPassword, confirmPassword }; minimum length by role (staff / student).
 * The current password is verified with a session-less client; a wrong one counts as a failed sign-in and
 * feeds the same lockout as the login. Passwords go to Supabase Auth only and are never logged.
 * Errors: UNAUTHENTICATED, VALIDATION, MISMATCH, UNCHANGED, WRONG_PASSWORD, LOCKED, UNAVAILABLE.
 */
export async function changeOwnPasswordAction(_previous: OwnPasswordResult | null, formData: FormData): Promise<OwnPasswordResult> {
  const result = await changeOwnPassword(formData);
  return auditIfFailed(result, { action: "account.own_password_change", entityType: "profile" });
}

async function changeOwnPassword(formData: FormData): Promise<OwnPasswordResult> {
  const actor = await getCurrentAccount();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  const minLength = actor.role === "student" ? STUDENT_PASSWORD_MIN_LENGTH : STAFF_PASSWORD_MIN_LENGTH;
  const parsed = changeOwnPasswordSchema(minLength).safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message;
    return { success: false, code: message === "MISMATCH" || message === "UNCHANGED" ? message : "VALIDATION" };
  }
  const ipAddress = clientIpFrom((await headers()).get("x-forwarded-for"));
  const usernameSha256 = hashUsername(actor.username);
  try {
    const admin = createSupabaseAdminClient();
    const failures = await countRecentLoginFailures(admin, usernameSha256, ipAddress);
    if (isLoginLocked(failures.forUsername, failures.forIp)) return { success: false, code: "LOCKED" };
    const check = await createSupabaseVerifierClient().auth.signInWithPassword({ email: usernameToAuthEmail(actor.username), password: parsed.data.currentPassword });
    if (check.error || check.data.user?.id !== actor.userId) {
      await insertSecurityEvent(admin, { kind: "login_failed", usernameSha256, userId: actor.userId, ipAddress, details: { context: "own_password_change" } });
      return { success: false, code: "WRONG_PASSWORD" };
    }
    const updated = await admin.auth.admin.updateUserById(actor.userId, { password: parsed.data.newPassword });
    if (updated.error) throw new Error(`auth password update failed: ${updated.error.message}`);
    await insertAuditLog(admin, { actorUserId: actor.userId, action: "account.own_password_changed", entityType: "profile", entityId: actor.userId, ipAddress });
    logInfo("account/actions.changeOwnPasswordAction", "own password changed", {});
  } catch (error) {
    logError("account/actions.changeOwnPasswordAction", error);
    return { success: false, code: "UNAVAILABLE" };
  }
  return { success: true, data: { message: "PASSWORD_CHANGED" } };
}
