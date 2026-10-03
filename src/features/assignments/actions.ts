"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { ASSIGNMENTS_PATH } from "@/constants";
import { auditIfFailed, formId } from "@/features/audit/failures";
import { clientIpFrom } from "@/features/authentication/domain";
import { getCurrentAccount } from "@/features/authentication/session";
import { RegistryFunctionError } from "@/features/canon/repository";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError } from "@/lib/logger";
import { canManageAssignments } from "@/lib/permissions";
import { AssignmentSchema, AssignmentWithdrawalSchema } from "@/lib/validation/schemas";
import { parseKeys, sarajevoLocalToIso } from "./domain/assignments";
import { createAssignment, withdrawAssignment } from "./repository";
import type { AssignmentActionResult, AssignmentErrorCode } from "./types";
import { notifyAssignment } from "@/features/push/send";

const KNOWN: AssignmentErrorCode[] = ["FORBIDDEN", "VALIDATION", "UNKNOWN_KEYS", "NO_STUDENTS", "NOT_FOUND", "ALREADY_WITHDRAWN"];

function codeOf(error: unknown): AssignmentErrorCode {
  return error instanceof RegistryFunctionError ? (KNOWN.find((known) => known === error.databaseMessage) ?? "UNAVAILABLE") : "UNAVAILABLE";
}

/**
 * POST (Server Action) createAssignmentAction
 * Role required: assignments.manage for the subject (subject teacher in the own subject, superadministrator); the
 * database re-checks it (migration 029, PDL-035).
 * Body: FormData { subject, title, instruction?, due (Europe/Sarajevo, YYYY-MM-DDTHH:MM), content: keys|area, keys?,
 *   areaId?, count?, audience: all|chosen, personIds[] }.
 * Errors: UNAUTHENTICATED, FORBIDDEN, VALIDATION, UNKNOWN_KEYS, NO_STUDENTS, UNAVAILABLE.
 */
export async function createAssignmentAction(_previous: AssignmentActionResult | null, formData: FormData): Promise<AssignmentActionResult> {
  const result = await create(formData);
  return auditIfFailed(result, { action: "assignment.create", entityType: "assignments", entityId: null });
}

async function create(formData: FormData): Promise<AssignmentActionResult> {
  const actor = await getCurrentAccount();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  if (!canManageAssignments(actor)) return { success: false, code: "FORBIDDEN" };
  const content = formData.get("content");
  const parsed = AssignmentSchema.safeParse({
    subject: formData.get("subject"),
    title: formData.get("title"),
    instruction: formData.get("instruction") ?? "",
    due: formData.get("due"),
    content,
    keys: content === "keys" ? parseKeys(String(formData.get("keys") ?? "")) : [],
    areaId: content === "area" ? (formData.get("areaId") ?? "") : "",
    count: content === "area" ? (formData.get("count") ?? "") : "",
    audience: formData.get("audience"),
    personIds: formData.get("audience") === "chosen" ? formData.getAll("personIds") : [],
  });
  if (!parsed.success) return { success: false, code: "VALIDATION" };
  const dueAt = sarajevoLocalToIso(parsed.data.due);
  if (!dueAt) return { success: false, code: "VALIDATION" };
  let id: string;
  try {
    id = await createAssignment(createSupabaseAdminClient(), {
      actorUserId: actor.userId,
      subject: parsed.data.subject,
      title: parsed.data.title,
      instruction: parsed.data.instruction,
      dueAt,
      keys: parsed.data.content === "keys" ? parsed.data.keys : null,
      areaId: parsed.data.content === "area" ? parsed.data.areaId : null,
      count: parsed.data.content === "area" ? parsed.data.count : null,
      personIds: parsed.data.audience === "chosen" ? parsed.data.personIds : null,
      ipAddress: clientIpFrom((await headers()).get("x-forwarded-for")),
    });
  } catch (error) {
    const code = codeOf(error);
    if (code === "UNAVAILABLE") logError("assignments/actions.createAssignmentAction", error);
    return { success: false, code };
  }
  // Web Push to recipients who allowed it (PDL-035 Z6); never blocks or fails the assignment.
  await notifyAssignment(id).catch((error: unknown) => logError("assignments/actions.notifyAssignment", error));
  revalidatePath(ASSIGNMENTS_PATH);
  return { success: true, data: { message: "CREATED", id } };
}

/**
 * POST (Server Action) withdrawAssignmentAction
 * Role required: assignments.manage for the assignment's subject. Body: FormData { assignmentId, reason }.
 * Errors: UNAUTHENTICATED, FORBIDDEN, VALIDATION, NOT_FOUND, ALREADY_WITHDRAWN, UNAVAILABLE.
 */
export async function withdrawAssignmentAction(_previous: AssignmentActionResult | null, formData: FormData): Promise<AssignmentActionResult> {
  const result = await withdraw(formData);
  return auditIfFailed(result, { action: "assignment.withdraw", entityType: "assignments", entityId: formId(formData, "assignmentId") });
}

async function withdraw(formData: FormData): Promise<AssignmentActionResult> {
  const actor = await getCurrentAccount();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  if (!canManageAssignments(actor)) return { success: false, code: "FORBIDDEN" };
  const parsed = AssignmentWithdrawalSchema.safeParse({ assignmentId: formData.get("assignmentId"), reason: formData.get("reason") });
  if (!parsed.success) return { success: false, code: "VALIDATION" };
  try {
    await withdrawAssignment(createSupabaseAdminClient(), { actorUserId: actor.userId, ...parsed.data, ipAddress: clientIpFrom((await headers()).get("x-forwarded-for")) });
  } catch (error) {
    const code = codeOf(error);
    if (code === "UNAVAILABLE") logError("assignments/actions.withdrawAssignmentAction", error);
    return { success: false, code };
  }
  revalidatePath(ASSIGNMENTS_PATH);
  revalidatePath(`${ASSIGNMENTS_PATH}/${parsed.data.assignmentId}`);
  return { success: true, data: { message: "WITHDRAWN", id: parsed.data.assignmentId } };
}
