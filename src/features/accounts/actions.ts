"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { ACCOUNTS_PATH, STAFF_PASSWORD_MIN_LENGTH, STUDENT_PASSWORD_MIN_LENGTH } from "@/constants";
import { clientIpFrom, usernameToAuthEmail } from "@/features/authentication/domain";
import { auditIfFailed, formId } from "@/features/audit/failures";
import { insertAuditLog } from "@/features/authentication/repository";
import { getCurrentAccount } from "@/features/authentication/session";
import type { CurrentAccount } from "@/features/authentication/types";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError, logInfo } from "@/lib/logger";
import { canChangeAccount, canManageAccounts, canResetPasswords } from "@/lib/permissions";
import { BundleChangeSchema, ChangeStatusSchema, createAccountSchema, resetPasswordSchema } from "@/lib/validation/schemas";
import { authBanFor, needsPersonRecord } from "./domain";
import { subjectExists } from "@/features/knowledge/repository";
import { findAccountTarget, grantBundle, insertPerson, insertProfile, revokeBundle, updateAccountStatus, usernameExists } from "./repository";
import type { AccountActionResult } from "./types";

/**
 * Account administration Server Actions. Each follows E-6:
 * authenticate → authorise (lib/permissions.ts) → validate (Zod) → execute → standard result.
 * Every write is audited; passwords are never logged or stored outside Supabase Auth.
 */

async function requestIp(): Promise<string | null> {
  return clientIpFrom((await headers()).get("x-forwarded-for"));
}

async function authenticated(): Promise<CurrentAccount | null> {
  return getCurrentAccount();
}

/**
 * POST (Server Action) createAccountAction
 * Role required: capability accounts.manage.
 * Body: FormData { username, displayName, role: administrator|student, password }.
 * Response: { success: true, data: { message: "CREATED" } } or { success: false, code }.
 * Errors: UNAUTHENTICATED, FORBIDDEN, VALIDATION, USERNAME_ROLE_MISMATCH, USERNAME_TAKEN, UNAVAILABLE.
 */
async function createAccount(_previous: AccountActionResult | null, formData: FormData): Promise<AccountActionResult> {
  const actor = await authenticated();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  if (!canManageAccounts(actor)) return { success: false, code: "FORBIDDEN" };

  const role = formData.get("role");
  const minLength = role === "student" ? STUDENT_PASSWORD_MIN_LENGTH : STAFF_PASSWORD_MIN_LENGTH;
  const parsed = createAccountSchema(minLength).safeParse({
    username: formData.get("username"),
    displayName: formData.get("displayName"),
    role,
    password: formData.get("password"),
  });
  if (!parsed.success) {
    const mismatch = parsed.error.issues.some((issue) => issue.message === "USERNAME_ROLE_MISMATCH");
    return { success: false, code: mismatch ? "USERNAME_ROLE_MISMATCH" : "VALIDATION" };
  }
  const input = parsed.data;

  let admin: ReturnType<typeof createSupabaseAdminClient> | null = null;
  let createdUserId: string | null = null;
  try {
    admin = createSupabaseAdminClient();
    if (await usernameExists(admin, input.username)) return { success: false, code: "USERNAME_TAKEN" };
    const created = await admin.auth.admin.createUser({ email: usernameToAuthEmail(input.username), password: input.password, email_confirm: true });
    if (created.error || !created.data.user) {
      const duplicate = created.error?.message.toLowerCase().includes("already") ?? false;
      if (duplicate) return { success: false, code: "USERNAME_TAKEN" };
      throw new Error(`auth.admin.createUser failed: ${created.error?.message ?? "no user"}`);
    }
    createdUserId = created.data.user.id;
    await insertProfile(admin, { userId: createdUserId, username: input.username, displayName: input.displayName, role: input.role, status: "active" });
    if (needsPersonRecord(input.role)) await insertPerson(admin, createdUserId);
    await insertAuditLog(admin, {
      actorUserId: actor.userId,
      action: "account.created",
      entityType: "profile",
      entityId: createdUserId,
      ipAddress: await requestIp(),
      details: { role: input.role },
    });
    logInfo("accounts/actions.createAccountAction", "account created", { role: input.role });
  } catch (error) {
    logError("accounts/actions.createAccountAction", error);
    if (admin && createdUserId) {
      // Remove the half-created auth user so the username can be used again (DONE checklist: cleanup checks errors).
      const cleanup = await admin.auth.admin.deleteUser(createdUserId);
      if (cleanup.error) logError("accounts/actions.createAccountAction.cleanup", cleanup.error, { userId: createdUserId });
    }
    return { success: false, code: "UNAVAILABLE" };
  }
  revalidatePath(ACCOUNTS_PATH);
  return { success: true, data: { message: "CREATED" } };
}

/**
 * POST (Server Action) changeAccountStatusAction
 * Role required: accounts.manage; never on the caller's own account or a Superadministrator.
 * Body: FormData { userId, status }. Also bans/unbans the identity at Supabase Auth.
 * Errors: UNAUTHENTICATED, FORBIDDEN, VALIDATION, NOT_FOUND, UNAVAILABLE.
 */
async function changeAccountStatus(_previous: AccountActionResult | null, formData: FormData): Promise<AccountActionResult> {
  const actor = await authenticated();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  if (!canManageAccounts(actor)) return { success: false, code: "FORBIDDEN" };
  const parsed = ChangeStatusSchema.safeParse({ userId: formData.get("userId"), status: formData.get("status") });
  if (!parsed.success) return { success: false, code: "VALIDATION" };

  try {
    const admin = createSupabaseAdminClient();
    const target = await findAccountTarget(admin, parsed.data.userId);
    if (!target) return { success: false, code: "NOT_FOUND" };
    if (!canChangeAccount(actor, target)) return { success: false, code: "FORBIDDEN" };
    if (!(await updateAccountStatus(admin, target.userId, parsed.data.status))) return { success: false, code: "NOT_FOUND" };
    const banned = await admin.auth.admin.updateUserById(target.userId, { ban_duration: authBanFor(parsed.data.status) });
    if (banned.error) throw new Error(`auth ban update failed: ${banned.error.message}`);
    await insertAuditLog(admin, {
      actorUserId: actor.userId,
      action: "account.status_changed",
      entityType: "profile",
      entityId: target.userId,
      ipAddress: await requestIp(),
      details: { from: target.status, to: parsed.data.status },
    });
  } catch (error) {
    logError("accounts/actions.changeAccountStatusAction", error);
    return { success: false, code: "UNAVAILABLE" };
  }
  revalidatePath(ACCOUNTS_PATH);
  return { success: true, data: { message: "STATUS_CHANGED" } };
}

/**
 * POST (Server Action) changeBundleAction
 * Role required: accounts.manage; not on self or a Superadministrator; administrators only.
 * Body: FormData { userId, bundle: pedagogue|psychologist|admin_operations|subject_teacher,
 *   subjectId (required for subject_teacher only), grant: grant|revoke }.
 * Errors: UNAUTHENTICATED, FORBIDDEN, VALIDATION, NOT_FOUND, UNAVAILABLE.
 */
async function changeBundle(_previous: AccountActionResult | null, formData: FormData): Promise<AccountActionResult> {
  const actor = await authenticated();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  if (!canManageAccounts(actor)) return { success: false, code: "FORBIDDEN" };
  const parsed = BundleChangeSchema.safeParse({
    userId: formData.get("userId"),
    bundle: formData.get("bundle"),
    subjectId: formData.get("subjectId") ?? undefined,
    grant: formData.get("grant"),
  });
  if (!parsed.success) return { success: false, code: "VALIDATION" };

  try {
    const admin = createSupabaseAdminClient();
    const target = await findAccountTarget(admin, parsed.data.userId);
    if (!target) return { success: false, code: "NOT_FOUND" };
    // Staff bundles are for administrators only — a student can never receive staff capabilities.
    if (!canChangeAccount(actor, target) || target.role !== "administrator") return { success: false, code: "FORBIDDEN" };
    const subjectId = parsed.data.subjectId ?? null;
    if (subjectId && !(await subjectExists(admin, subjectId))) return { success: false, code: "NOT_FOUND" };
    if (parsed.data.grant === "grant") await grantBundle(admin, target.userId, parsed.data.bundle, actor.userId, subjectId);
    else await revokeBundle(admin, target.userId, parsed.data.bundle, subjectId);
    await insertAuditLog(admin, {
      actorUserId: actor.userId,
      action: parsed.data.grant === "grant" ? "account.bundle_granted" : "account.bundle_revoked",
      entityType: "profile",
      entityId: target.userId,
      ipAddress: await requestIp(),
      details: parsed.data.subjectId ? { bundle: parsed.data.bundle, subject_id: parsed.data.subjectId } : { bundle: parsed.data.bundle },
    });
  } catch (error) {
    logError("accounts/actions.changeBundleAction", error);
    return { success: false, code: "UNAVAILABLE" };
  }
  revalidatePath(ACCOUNTS_PATH);
  return { success: true, data: { message: "BUNDLE_CHANGED" } };
}

/**
 * POST (Server Action) resetPasswordAction
 * Role required: accounts.reset_password; not on self (own password is changed by the owner) or a Superadministrator.
 * Body: FormData { userId, password }. The password is sent to Supabase Auth only; never logged.
 * Errors: UNAUTHENTICATED, FORBIDDEN, VALIDATION, NOT_FOUND, UNAVAILABLE.
 */
async function resetPassword(_previous: AccountActionResult | null, formData: FormData): Promise<AccountActionResult> {
  const actor = await authenticated();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  if (!canResetPasswords(actor)) return { success: false, code: "FORBIDDEN" };

  try {
    const admin = createSupabaseAdminClient();
    const userId = formData.get("userId");
    const target = typeof userId === "string" ? await findAccountTarget(admin, userId).catch(() => null) : null;
    if (!target) return { success: false, code: "NOT_FOUND" };
    if (actor.userId === target.userId || target.role === "superadmin") return { success: false, code: "FORBIDDEN" };
    const minLength = target.role === "student" ? STUDENT_PASSWORD_MIN_LENGTH : STAFF_PASSWORD_MIN_LENGTH;
    const parsed = resetPasswordSchema(minLength).safeParse({ userId, password: formData.get("password") });
    if (!parsed.success) return { success: false, code: "VALIDATION" };
    const updated = await admin.auth.admin.updateUserById(target.userId, { password: parsed.data.password });
    if (updated.error) throw new Error(`auth password update failed: ${updated.error.message}`);
    await insertAuditLog(admin, {
      actorUserId: actor.userId,
      action: "account.password_reset",
      entityType: "profile",
      entityId: target.userId,
      ipAddress: await requestIp(),
    });
  } catch (error) {
    logError("accounts/actions.resetPasswordAction", error);
    return { success: false, code: "UNAVAILABLE" };
  }
  return { success: true, data: { message: "PASSWORD_RESET" } };
}

// Exported actions: the implementations above, plus an audit row for every failed attempt (auditIfFailed).

/** Server Action; see createAccount above. Failed attempts are audited as `account.create_failed`. */
export async function createAccountAction(previous: AccountActionResult | null, formData: FormData): Promise<AccountActionResult> {
  return auditIfFailed(await createAccount(previous, formData), { action: "account.create", entityType: "profile", entityId: null });
}

/** Server Action; see changeAccountStatus above. Failed attempts are audited as `account.status_change_failed`. */
export async function changeAccountStatusAction(previous: AccountActionResult | null, formData: FormData): Promise<AccountActionResult> {
  return auditIfFailed(await changeAccountStatus(previous, formData), { action: "account.status_change", entityType: "profile", entityId: formId(formData, "userId") });
}

/** Server Action; see changeBundle above. Failed attempts are audited as `account.bundle_change_failed`. */
export async function changeBundleAction(previous: AccountActionResult | null, formData: FormData): Promise<AccountActionResult> {
  return auditIfFailed(await changeBundle(previous, formData), { action: "account.bundle_change", entityType: "profile", entityId: formId(formData, "userId") });
}

/** Server Action; see resetPassword above. Failed attempts are audited as `account.password_reset_failed`. */
export async function resetPasswordAction(previous: AccountActionResult | null, formData: FormData): Promise<AccountActionResult> {
  return auditIfFailed(await resetPassword(previous, formData), { action: "account.password_reset", entityType: "profile", entityId: formId(formData, "userId") });
}
