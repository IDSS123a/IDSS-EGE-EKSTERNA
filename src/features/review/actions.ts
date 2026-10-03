"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { REVIEW_PATH } from "@/constants";
import { auditIfFailed, formId } from "@/features/audit/failures";
import { clientIpFrom } from "@/features/authentication/domain";
import { getCurrentAccount } from "@/features/authentication/session";
import { RegistryFunctionError } from "@/features/canon/repository";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError, logInfo } from "@/lib/logger";
import { canReviewSubject } from "@/lib/permissions";
import { ErratumSchema, ErratumWithdrawalSchema, FollowUpResolutionSchema, FollowUpSchema, RecordDecisionSchema } from "@/lib/validation/schemas";
import { reviewErrorFromDatabase } from "./domain/errors";
import { decideRecord, openFollowUp, recordErratum, resolveFollowUp, withdrawErratum } from "./repository";
import type { ReviewActionResult } from "./types";

/**
 * Review Server Actions (Sprint 04). Each follows E-6: authenticate, authorise (lib/permissions.ts,
 * subject scope), validate (Zod), execute. The form's subjectId is only a pre-check: the database
 * functions re-check the actor against the record's or key's own subject and write the audit row.
 */

async function requestIp(): Promise<string | null> {
  return clientIpFrom((await headers()).get("x-forwarded-for"));
}

function failure(error: unknown, location: string): ReviewActionResult {
  const code = error instanceof RegistryFunctionError ? reviewErrorFromDatabase(error.databaseMessage) : "UNAVAILABLE";
  if (code === "UNAVAILABLE") logError(location, error);
  return { success: false, code };
}

/**
 * POST (Server Action) decideRecordAction
 * Role required: canon.review for the record's subject (or canon.publish).
 * Body: FormData { recordId, subjectId, decision: accepted|returned, taskType (accepted), reason (returned) }.
 * Accepting creates the trusted question version with its printed keys in the same transaction.
 * Errors: UNAUTHENTICATED, FORBIDDEN, VALIDATION, NOT_FOUND, SUBJECT_MISSING, STALE_RECORD,
 *   ALREADY_ACCEPTED, NOT_ACCEPTABLE, UNAVAILABLE.
 */
export async function decideRecordAction(_previous: ReviewActionResult | null, formData: FormData): Promise<ReviewActionResult> {
  const result = await decide(formData);
  return auditIfFailed(result, { action: "review.record_decision", entityType: "ingested_record", entityId: formId(formData, "recordId") });
}

async function decide(formData: FormData): Promise<ReviewActionResult> {
  const actor = await getCurrentAccount();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  const subjectId = formData.get("subjectId");
  if (typeof subjectId !== "string" || !canReviewSubject(actor, subjectId)) return { success: false, code: "FORBIDDEN" };
  const parsed = RecordDecisionSchema.safeParse({
    recordId: formData.get("recordId"),
    decision: formData.get("decision"),
    taskType: formData.get("taskType") ?? undefined,
    reason: formData.get("reason") ?? undefined,
  });
  if (!parsed.success) return { success: false, code: "VALIDATION" };
  const { recordId, decision, taskType, reason } = parsed.data;
  try {
    await decideRecord(createSupabaseAdminClient(), {
      actorUserId: actor.userId,
      recordId,
      decision,
      taskType: decision === "accepted" ? (taskType ?? null) : null,
      reason: reason ?? null,
      ipAddress: await requestIp(),
    });
    logInfo("review/actions.decideRecordAction", "record reviewed", { decision });
  } catch (error) {
    return failure(error, "review/actions.decideRecordAction");
  }
  revalidatePath(REVIEW_PATH, "layout");
  return { success: true, data: { message: decision === "accepted" ? "ACCEPTED" : "RETURNED" } };
}

/**
 * POST (Server Action) recordErratumAction
 * Role required: canon.review for the question's subject (or canon.publish).
 * Body: FormData { questionVersionId, subjectId, itemNumber?, description, evidence }.
 * The printed task and key never change (P-15, PDL-027): the erratum is a notice shown to students
 * (existence before answering, description after) and to teachers.
 * Errors: UNAUTHENTICATED, FORBIDDEN, VALIDATION, NOT_FOUND, UNAVAILABLE.
 */
export async function recordErratumAction(_previous: ReviewActionResult | null, formData: FormData): Promise<ReviewActionResult> {
  const result = await recordErratumFrom(formData);
  return auditIfFailed(result, { action: "review.erratum", entityType: "question_version", entityId: formId(formData, "questionVersionId") });
}

async function recordErratumFrom(formData: FormData): Promise<ReviewActionResult> {
  const actor = await getCurrentAccount();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  const parsed = ErratumSchema.safeParse({
    questionVersionId: formData.get("questionVersionId"),
    subjectId: formData.get("subjectId"),
    itemNumber: formData.get("itemNumber"),
    description: formData.get("description"),
    evidence: formData.get("evidence"),
  });
  if (!parsed.success) return { success: false, code: "VALIDATION" };
  if (!canReviewSubject(actor, parsed.data.subjectId)) return { success: false, code: "FORBIDDEN" };
  try {
    await recordErratum(createSupabaseAdminClient(), { actorUserId: actor.userId, ...parsed.data, itemNumber: parsed.data.itemNumber ?? null, ipAddress: await requestIp() });
    logInfo("review/actions.recordErratumAction", "erratum recorded");
  } catch (error) {
    return failure(error, "review/actions.recordErratumAction");
  }
  revalidatePath(REVIEW_PATH, "layout");
  return { success: true, data: { message: "ERRATUM_RECORDED" } };
}

/**
 * POST (Server Action) withdrawErratumAction
 * Role required: canon.review for the erratum's subject (or canon.publish).
 * Body: FormData { erratumId, subjectId, reason }. Withdrawal is a new row; nothing is deleted.
 * Errors: UNAUTHENTICATED, FORBIDDEN, VALIDATION, NOT_FOUND, UNAVAILABLE.
 */
export async function withdrawErratumAction(_previous: ReviewActionResult | null, formData: FormData): Promise<ReviewActionResult> {
  const result = await withdrawErratumFrom(formData);
  return auditIfFailed(result, { action: "review.erratum_withdrawal", entityType: "catalogue_erratum", entityId: formId(formData, "erratumId") });
}

async function withdrawErratumFrom(formData: FormData): Promise<ReviewActionResult> {
  const actor = await getCurrentAccount();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  const parsed = ErratumWithdrawalSchema.safeParse({ erratumId: formData.get("erratumId"), subjectId: formData.get("subjectId"), reason: formData.get("reason") });
  if (!parsed.success) return { success: false, code: "VALIDATION" };
  if (!canReviewSubject(actor, parsed.data.subjectId)) return { success: false, code: "FORBIDDEN" };
  try {
    await withdrawErratum(createSupabaseAdminClient(), { actorUserId: actor.userId, erratumId: parsed.data.erratumId, reason: parsed.data.reason, ipAddress: await requestIp() });
  } catch (error) {
    return failure(error, "review/actions.withdrawErratumAction");
  }
  revalidatePath(REVIEW_PATH, "layout");
  return { success: true, data: { message: "ERRATUM_WITHDRAWN" } };
}

/**
 * POST (Server Action) openFollowUpAction
 * Role required: canon.review for the question's subject (or canon.publish).
 * Body: FormData { questionVersionId, subjectId, assignee, note }: a named person must still check the question.
 * Errors: UNAUTHENTICATED, FORBIDDEN, VALIDATION, NOT_FOUND, UNAVAILABLE.
 */
export async function openFollowUpAction(_previous: ReviewActionResult | null, formData: FormData): Promise<ReviewActionResult> {
  const result = await openFollowUpFrom(formData);
  return auditIfFailed(result, { action: "review.follow_up", entityType: "question_version", entityId: formId(formData, "questionVersionId") });
}

async function openFollowUpFrom(formData: FormData): Promise<ReviewActionResult> {
  const actor = await getCurrentAccount();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  const parsed = FollowUpSchema.safeParse({
    questionVersionId: formData.get("questionVersionId"),
    subjectId: formData.get("subjectId"),
    assignee: formData.get("assignee"),
    note: formData.get("note"),
  });
  if (!parsed.success) return { success: false, code: "VALIDATION" };
  if (!canReviewSubject(actor, parsed.data.subjectId)) return { success: false, code: "FORBIDDEN" };
  try {
    await openFollowUp(createSupabaseAdminClient(), { actorUserId: actor.userId, ...parsed.data, ipAddress: await requestIp() });
  } catch (error) {
    return failure(error, "review/actions.openFollowUpAction");
  }
  revalidatePath(REVIEW_PATH, "layout");
  return { success: true, data: { message: "FOLLOW_UP_OPENED" } };
}

/**
 * POST (Server Action) resolveFollowUpAction
 * Role required: canon.review for the follow-up's subject (or canon.publish).
 * Body: FormData { followUpId, subjectId, note }.
 * Errors: UNAUTHENTICATED, FORBIDDEN, VALIDATION, NOT_FOUND, UNAVAILABLE.
 */
export async function resolveFollowUpAction(_previous: ReviewActionResult | null, formData: FormData): Promise<ReviewActionResult> {
  const result = await resolveFollowUpFrom(formData);
  return auditIfFailed(result, { action: "review.follow_up_resolution", entityType: "canon_follow_up", entityId: formId(formData, "followUpId") });
}

async function resolveFollowUpFrom(formData: FormData): Promise<ReviewActionResult> {
  const actor = await getCurrentAccount();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  const parsed = FollowUpResolutionSchema.safeParse({ followUpId: formData.get("followUpId"), subjectId: formData.get("subjectId"), note: formData.get("note") });
  if (!parsed.success) return { success: false, code: "VALIDATION" };
  if (!canReviewSubject(actor, parsed.data.subjectId)) return { success: false, code: "FORBIDDEN" };
  try {
    await resolveFollowUp(createSupabaseAdminClient(), { actorUserId: actor.userId, followUpId: parsed.data.followUpId, note: parsed.data.note, ipAddress: await requestIp() });
  } catch (error) {
    return failure(error, "review/actions.resolveFollowUpAction");
  }
  revalidatePath(REVIEW_PATH, "layout");
  return { success: true, data: { message: "FOLLOW_UP_RESOLVED" } };
}
