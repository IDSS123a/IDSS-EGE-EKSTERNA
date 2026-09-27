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
import { canReviewSubject, canReviseAnswerKeys } from "@/lib/permissions";
import { KeyRevisionSchema, QuestionTextRevisionSchema, RecordDecisionSchema } from "@/lib/validation/schemas";
import { reviewErrorFromDatabase } from "./domain/errors";
import { decideRecord, proposeKeyRevision, reviseQuestionText } from "./repository";
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
 * POST (Server Action) proposeKeyRevisionAction
 * Role required: answer_keys.propose_revision for the key's subject.
 * Body: FormData { answerKeyId, subjectId, correctedAnswer, reason, evidence? }.
 * The printed key is never changed (CF-03); the newest revision is the effective key.
 * Errors: UNAUTHENTICATED, FORBIDDEN, VALIDATION, NOT_FOUND, UNAVAILABLE.
 */
export async function proposeKeyRevisionAction(_previous: ReviewActionResult | null, formData: FormData): Promise<ReviewActionResult> {
  const result = await revise(formData);
  return auditIfFailed(result, { action: "review.answer_key_revision", entityType: "answer_key", entityId: formId(formData, "answerKeyId") });
}

async function revise(formData: FormData): Promise<ReviewActionResult> {
  const actor = await getCurrentAccount();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  const parsed = KeyRevisionSchema.safeParse({
    answerKeyId: formData.get("answerKeyId"),
    subjectId: formData.get("subjectId"),
    correctedAnswer: formData.get("correctedAnswer"),
    reason: formData.get("reason"),
    evidence: formData.get("evidence") ?? undefined,
  });
  if (!parsed.success) return { success: false, code: "VALIDATION" };
  if (!canReviseAnswerKeys(actor, parsed.data.subjectId)) return { success: false, code: "FORBIDDEN" };
  try {
    await proposeKeyRevision(createSupabaseAdminClient(), {
      actorUserId: actor.userId,
      answerKeyId: parsed.data.answerKeyId,
      correctedAnswer: parsed.data.correctedAnswer,
      reason: parsed.data.reason,
      evidence: parsed.data.evidence ?? null,
      ipAddress: await requestIp(),
    });
  } catch (error) {
    return failure(error, "review/actions.proposeKeyRevisionAction");
  }
  revalidatePath(REVIEW_PATH, "layout");
  return { success: true, data: { message: "KEY_REVISED" } };
}

/**
 * POST (Server Action) reviseQuestionTextAction
 * Role required: canon.review for the question's subject (or canon.publish).
 * Body: FormData { questionVersionId, subjectId, rawText, stemText?, optionLabel[] + optionText[],
 *   itemNumber[] + itemText[], reason, evidence? }.
 * The trusted version never changes (AMB-19, PDL-021); the newest revision is the text students see.
 * Labels and item numbers must equal the version's; the database refuses any other shape.
 * Errors: UNAUTHENTICATED, FORBIDDEN, VALIDATION, NOT_FOUND, UNAVAILABLE.
 */
export async function reviseQuestionTextAction(_previous: ReviewActionResult | null, formData: FormData): Promise<ReviewActionResult> {
  const result = await reviseText(formData);
  return auditIfFailed(result, { action: "review.question_text_revision", entityType: "question_version", entityId: formId(formData, "questionVersionId") });
}

function strings(formData: FormData, name: string): string[] {
  return formData.getAll(name).filter((value): value is string => typeof value === "string");
}

async function reviseText(formData: FormData): Promise<ReviewActionResult> {
  const actor = await getCurrentAccount();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  const optionLabels = strings(formData, "optionLabel");
  const optionTexts = strings(formData, "optionText");
  const itemNumbers = strings(formData, "itemNumber");
  const itemTexts = strings(formData, "itemText");
  if (optionLabels.length !== optionTexts.length || itemNumbers.length !== itemTexts.length) return { success: false, code: "VALIDATION" };
  const stemText = formData.get("stemText");
  const parsed = QuestionTextRevisionSchema.safeParse({
    questionVersionId: formData.get("questionVersionId"),
    subjectId: formData.get("subjectId"),
    rawText: formData.get("rawText"),
    stemText: typeof stemText === "string" ? stemText : null,
    options: optionLabels.map((label, index) => ({ label, text: optionTexts[index] })),
    scoredItems: itemNumbers.map((itemNumber, index) => ({ itemNumber, rawText: itemTexts[index] })),
    reason: formData.get("reason"),
    evidence: formData.get("evidence") ?? undefined,
  });
  if (!parsed.success) return { success: false, code: "VALIDATION" };
  if (!canReviewSubject(actor, parsed.data.subjectId)) return { success: false, code: "FORBIDDEN" };
  const { questionVersionId, rawText, options, scoredItems, reason, evidence } = parsed.data;
  try {
    await reviseQuestionText(createSupabaseAdminClient(), {
      actorUserId: actor.userId,
      questionVersionId,
      text: { rawText, stemText: parsed.data.stemText, options, scoredItems },
      reason,
      evidence: evidence ?? null,
      ipAddress: await requestIp(),
    });
    logInfo("review/actions.reviseQuestionTextAction", "question text revised");
  } catch (error) {
    return failure(error, "review/actions.reviseQuestionTextAction");
  }
  revalidatePath(REVIEW_PATH, "layout");
  return { success: true, data: { message: "TEXT_REVISED" } };
}
