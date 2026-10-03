"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { EXAM_PATH } from "@/constants";
import { auditIfFailed, formId } from "@/features/audit/failures";
import { clientIpFrom } from "@/features/authentication/domain";
import { getCurrentAccount } from "@/features/authentication/session";
import { RegistryFunctionError } from "@/features/canon/repository";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError, logInfo } from "@/lib/logger";
import { canPractise } from "@/lib/permissions";
import { ExamResponsesSchema } from "@/lib/validation/schemas";
import { beginExam, requestExam, saveExam, submitExam } from "./repository";
import type { ExamActionResult, ExamErrorCode, ExamSaveResult } from "./types";

/**
 * Mock exam Server Actions for students (Sprint 07). Each follows E-6: authenticate, authorise (practice.participate),
 * validate (Zod), execute. The database binds the exam to the student's person and re-checks every state change.
 */

const KNOWN: ExamErrorCode[] = ["FORBIDDEN", "VALIDATION", "NOT_FOUND", "NO_BLUEPRINT", "BLUEPRINT_UNFILLABLE", "NOT_APPROVED", "NO_RULE", "CLOSED"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function failure(error: unknown, location: string): { success: false; code: ExamErrorCode } {
  const code = error instanceof RegistryFunctionError ? (KNOWN.find((known) => known === error.databaseMessage) ?? "UNAVAILABLE") : "UNAVAILABLE";
  if (code === "UNAVAILABLE") logError(location, error);
  return { success: false, code };
}

async function requestIp(): Promise<string | null> {
  return clientIpFrom((await headers()).get("x-forwarded-for"));
}

/**
 * POST (Server Action) requestExamAction
 * Role required: practice.participate. Body: FormData { subjectId }.
 * Returns the open exam of the subject or composes a new set by the confirmed blueprint; the set waits for a teacher.
 * Success: redirect to the exam. Errors: UNAUTHENTICATED, FORBIDDEN, VALIDATION, NO_BLUEPRINT, BLUEPRINT_UNFILLABLE, UNAVAILABLE.
 */
export async function requestExamAction(_previous: ExamActionResult | null, formData: FormData): Promise<ExamActionResult> {
  const result = await request(formData);
  if (!result.success) return auditIfFailed(result, { action: "exam.request", entityType: "subject", entityId: formId(formData, "subjectId") });
  // redirect() throws by design, so it stays outside try/catch.
  redirect(`${EXAM_PATH}/${result.examId}`);
}

async function request(formData: FormData): Promise<{ success: true; examId: string } | { success: false; code: ExamErrorCode }> {
  const actor = await getCurrentAccount();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  if (!canPractise(actor)) return { success: false, code: "FORBIDDEN" };
  const subjectId = formData.get("subjectId");
  if (typeof subjectId !== "string" || !UUID.test(subjectId)) return { success: false, code: "VALIDATION" };
  try {
    const examId = await requestExam(createSupabaseAdminClient(), { actorUserId: actor.userId, subjectId, ipAddress: await requestIp() });
    logInfo("exams/actions.requestExamAction", "exam requested");
    return { success: true, examId };
  } catch (error) {
    return failure(error, "exams/actions.requestExamAction");
  }
}

/**
 * POST (Server Action) beginExamAction
 * Role required: practice.participate (the student's own approved set). Body: FormData { examId }.
 * The official duration runs from now. Errors: UNAUTHENTICATED, FORBIDDEN, VALIDATION, NOT_FOUND, NOT_APPROVED, NO_RULE, UNAVAILABLE.
 */
export async function beginExamAction(_previous: ExamActionResult | null, formData: FormData): Promise<ExamActionResult> {
  const result = await begin(formData);
  return auditIfFailed(result, { action: "exam.begin", entityType: "mock_exam", entityId: formId(formData, "examId") });
}

async function begin(formData: FormData): Promise<ExamActionResult> {
  const actor = await getCurrentAccount();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  if (!canPractise(actor)) return { success: false, code: "FORBIDDEN" };
  const examId = formData.get("examId");
  if (typeof examId !== "string" || !UUID.test(examId)) return { success: false, code: "VALIDATION" };
  try {
    await beginExam(createSupabaseAdminClient(), { actorUserId: actor.userId, examId, ipAddress: await requestIp() });
  } catch (error) {
    return failure(error, "exams/actions.beginExamAction");
  }
  revalidatePath(`${EXAM_PATH}/${examId}`);
  return { success: true };
}

/**
 * POST (Server Action) saveExamAction (autosave while writing)
 * Role required: practice.participate (the student's own exam in progress).
 * Body: { examId, responses: [{ id, response }] }. Answers after the deadline plus 30 s are ignored and the exam is
 * submitted with what was saved. Errors: UNAUTHENTICATED, FORBIDDEN, VALIDATION, NOT_FOUND, CLOSED, UNAVAILABLE.
 */
export async function saveExamAction(input: { examId: string; responses: { id: string; response: string }[] }): Promise<ExamSaveResult> {
  const actor = await getCurrentAccount();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  if (!canPractise(actor)) return { success: false, code: "FORBIDDEN" };
  const parsed = ExamResponsesSchema.safeParse(input);
  if (!parsed.success) return { success: false, code: "VALIDATION" };
  try {
    return { success: true, data: await saveExam(createSupabaseAdminClient(), { actorUserId: actor.userId, ...parsed.data }) };
  } catch (error) {
    return failure(error, "exams/actions.saveExamAction");
  }
}

/**
 * POST (Server Action) submitExamAction
 * Role required: practice.participate (the student's own exam in progress).
 * Body: { examId, responses }. Stores the last answers and submits; the teacher grades, the result follows the release.
 * Errors: UNAUTHENTICATED, FORBIDDEN, VALIDATION, NOT_FOUND, CLOSED, UNAVAILABLE.
 */
export async function submitExamAction(input: { examId: string; responses: { id: string; response: string }[] }): Promise<ExamActionResult> {
  const result = await submit(input);
  return auditIfFailed(result, { action: "exam.submit", entityType: "mock_exam", entityId: typeof input?.examId === "string" ? input.examId.slice(0, 64) : null });
}

async function submit(input: { examId: string; responses: { id: string; response: string }[] }): Promise<ExamActionResult> {
  const actor = await getCurrentAccount();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  if (!canPractise(actor)) return { success: false, code: "FORBIDDEN" };
  const parsed = ExamResponsesSchema.safeParse(input);
  if (!parsed.success) return { success: false, code: "VALIDATION" };
  try {
    await submitExam(createSupabaseAdminClient(), { actorUserId: actor.userId, ...parsed.data, ipAddress: await requestIp() });
    logInfo("exams/actions.submitExamAction", "exam submitted");
  } catch (error) {
    return failure(error, "exams/actions.submitExamAction");
  }
  revalidatePath(`${EXAM_PATH}/${parsed.data.examId}`);
  revalidatePath(EXAM_PATH);
  return { success: true };
}
