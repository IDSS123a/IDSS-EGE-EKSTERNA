"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { GRADING_PATH } from "@/constants";
import { auditIfFailed, formId } from "@/features/audit/failures";
import { clientIpFrom } from "@/features/authentication/domain";
import { getCurrentAccount } from "@/features/authentication/session";
import { RegistryFunctionError } from "@/features/canon/repository";
import type { SubjectCode } from "@/features/knowledge/types";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError, logInfo } from "@/lib/logger";
import { canGrade, canGradeSubject, canPublishCanon, canReviewSubject } from "@/lib/permissions";
import { BlueprintReviewSchema, GradesSchema, PracticeVerdictSchema, SetDiscardSchema } from "@/lib/validation/schemas";
import { blueprintConfig } from "./blueprint-config";
import { approveSet, confirmGrades, discardSet, loadBlueprint, reviewBlueprint, reviewPracticeAnswer, saveGrades } from "./repository";
import type { GradingActionResult, GradingErrorCode } from "./types";

/**
 * Teachers' Server Actions (Sprint 07). Each follows E-6: authenticate, authorise (lib/permissions.ts with the
 * subject scope), validate (Zod), execute. The form's subjectId is only a pre-check: the database functions re-check
 * the actor against the exam's or blueprint's own subject and write the audit row.
 */

const KNOWN: GradingErrorCode[] = ["FORBIDDEN", "VALIDATION", "NOT_FOUND", "CLOSED", "UNGRADED", "IN_PROGRESS", "NO_BLUEPRINT", "BLUEPRINT_UNFILLABLE", "POINTS_MISMATCH", "VERSION_EXISTS"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SUBJECT_CODES: SubjectCode[] = ["bhs_language_literature", "mathematics", "german"];

function failure(error: unknown, location: string): { success: false; code: GradingErrorCode } {
  const code = error instanceof RegistryFunctionError ? (KNOWN.find((known) => known === error.databaseMessage) ?? "UNAVAILABLE") : "UNAVAILABLE";
  if (code === "UNAVAILABLE") logError(location, error);
  return { success: false, code };
}

async function requestIp(): Promise<string | null> {
  return clientIpFrom((await headers()).get("x-forwarded-for"));
}

function examIdOf(formData: FormData): { examId: string; subjectId: string } | null {
  const examId = formData.get("examId");
  const subjectId = formData.get("subjectId");
  return typeof examId === "string" && UUID.test(examId) && typeof subjectId === "string" && UUID.test(subjectId) ? { examId, subjectId } : null;
}

/**
 * POST (Server Action) loadBlueprintAction
 * Role required: canon.publish. Body: FormData { subjectCode }.
 * Stores the subject's entry of config/exam-blueprints.json with its SHA-256; the database checks the shape and that
 * the points add up to the confirmed total. A reviewer of the subject must then confirm it.
 * Errors: UNAUTHENTICATED, FORBIDDEN, VALIDATION, NO_CONFIG, POINTS_MISMATCH, VERSION_EXISTS, UNAVAILABLE.
 */
export async function loadBlueprintAction(_previous: GradingActionResult | null, formData: FormData): Promise<GradingActionResult> {
  const result = await load(formData);
  return auditIfFailed(result, { action: "exam.blueprint_load", entityType: "subject", entityId: formId(formData, "subjectCode") });
}

async function load(formData: FormData): Promise<GradingActionResult> {
  const actor = await getCurrentAccount();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  if (!canPublishCanon(actor)) return { success: false, code: "FORBIDDEN" };
  const subjectCode = SUBJECT_CODES.find((code) => code === formData.get("subjectCode"));
  if (!subjectCode) return { success: false, code: "VALIDATION" };
  const config = blueprintConfig(subjectCode);
  if (!config) return { success: false, code: "NO_CONFIG" };
  try {
    await loadBlueprint(createSupabaseAdminClient(), { actorUserId: actor.userId, subjectCode, version: config.version, content: config.content, sha256: config.sha256, ipAddress: await requestIp() });
    logInfo("grading/actions.loadBlueprintAction", "blueprint loaded", { subject: subjectCode, version: config.version });
  } catch (error) {
    return failure(error, "grading/actions.loadBlueprintAction");
  }
  revalidatePath(GRADING_PATH);
  return { success: true, data: { message: "BLUEPRINT_LOADED" } };
}

/**
 * POST (Server Action) reviewBlueprintAction
 * Role required: canon.review for the blueprint's subject (or canon.publish).
 * Body: FormData { blueprintId, subjectId, decision: confirmed|rejected, note (required when rejected) }.
 * Students get mock exams of a subject only by its newest confirmed blueprint.
 * Errors: UNAUTHENTICATED, FORBIDDEN, VALIDATION, NOT_FOUND, UNAVAILABLE.
 */
export async function reviewBlueprintAction(_previous: GradingActionResult | null, formData: FormData): Promise<GradingActionResult> {
  const result = await review(formData);
  return auditIfFailed(result, { action: "exam.blueprint_review", entityType: "exam_blueprint", entityId: formId(formData, "blueprintId") });
}

async function review(formData: FormData): Promise<GradingActionResult> {
  const actor = await getCurrentAccount();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  const parsed = BlueprintReviewSchema.safeParse({
    blueprintId: formData.get("blueprintId"),
    subjectId: formData.get("subjectId"),
    decision: formData.get("decision"),
    note: formData.get("note") ?? undefined,
  });
  if (!parsed.success) return { success: false, code: "VALIDATION" };
  if (!canReviewSubject(actor, parsed.data.subjectId)) return { success: false, code: "FORBIDDEN" };
  try {
    await reviewBlueprint(createSupabaseAdminClient(), { actorUserId: actor.userId, blueprintId: parsed.data.blueprintId, decision: parsed.data.decision, note: parsed.data.note ?? null, ipAddress: await requestIp() });
  } catch (error) {
    return failure(error, "grading/actions.reviewBlueprintAction");
  }
  revalidatePath(GRADING_PATH);
  return { success: true, data: { message: parsed.data.decision === "confirmed" ? "BLUEPRINT_CONFIRMED" : "BLUEPRINT_REJECTED" } };
}

/**
 * POST (Server Action) approveSetAction
 * Role required: exams.grade for the exam's subject. Body: FormData { examId, subjectId }.
 * The teacher has seen every question with its printed key; the student may now start.
 * Errors: UNAUTHENTICATED, FORBIDDEN, VALIDATION, NOT_FOUND, CLOSED, UNAVAILABLE.
 */
export async function approveSetAction(_previous: GradingActionResult | null, formData: FormData): Promise<GradingActionResult> {
  const result = await approve(formData);
  return auditIfFailed(result, { action: "exam.set_approve", entityType: "mock_exam", entityId: formId(formData, "examId") });
}

async function approve(formData: FormData): Promise<GradingActionResult> {
  const actor = await getCurrentAccount();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  const ids = examIdOf(formData);
  if (!ids) return { success: false, code: "VALIDATION" };
  if (!canGradeSubject(actor, ids.subjectId)) return { success: false, code: "FORBIDDEN" };
  try {
    await approveSet(createSupabaseAdminClient(), { actorUserId: actor.userId, examId: ids.examId, ipAddress: await requestIp() });
  } catch (error) {
    return failure(error, "grading/actions.approveSetAction");
  }
  revalidatePath(GRADING_PATH, "layout");
  return { success: true, data: { message: "SET_APPROVED" } };
}

/**
 * POST (Server Action) discardSetAction
 * Role required: exams.grade for the exam's subject.
 * Body: FormData { examId, subjectId, note, newSet ("on" to compose a new set for the same student at once) }.
 * Errors: UNAUTHENTICATED, FORBIDDEN, VALIDATION, NOT_FOUND, CLOSED, NO_BLUEPRINT, BLUEPRINT_UNFILLABLE, UNAVAILABLE.
 */
export async function discardSetAction(_previous: GradingActionResult | null, formData: FormData): Promise<GradingActionResult> {
  const result = await discard(formData);
  return auditIfFailed(result, { action: "exam.set_discard", entityType: "mock_exam", entityId: formId(formData, "examId") });
}

async function discard(formData: FormData): Promise<GradingActionResult> {
  const actor = await getCurrentAccount();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  const parsed = SetDiscardSchema.safeParse({ examId: formData.get("examId"), subjectId: formData.get("subjectId"), note: formData.get("note"), newSet: formData.get("newSet") === "on" });
  if (!parsed.success) return { success: false, code: "VALIDATION" };
  if (!canGradeSubject(actor, parsed.data.subjectId)) return { success: false, code: "FORBIDDEN" };
  try {
    await discardSet(createSupabaseAdminClient(), { actorUserId: actor.userId, examId: parsed.data.examId, note: parsed.data.note, newSet: parsed.data.newSet, ipAddress: await requestIp() });
  } catch (error) {
    return failure(error, "grading/actions.discardSetAction");
  }
  revalidatePath(GRADING_PATH, "layout");
  return { success: true, data: { message: parsed.data.newSet ? "SET_REPLACED" : "SET_DISCARDED" } };
}

/**
 * POST (Server Action) saveGradesAction
 * Role required: exams.grade for the exam's subject.
 * Body: FormData { examId, subjectId, unit[] (unit ids), points:<id> or pairs:<id> ("" keeps the unit as it is), note:<id> }.
 * Points must be values the unit allows; matching units take the number of correct pairs, converted by the rule.
 * Errors: UNAUTHENTICATED, FORBIDDEN, VALIDATION, NOT_FOUND, CLOSED, UNAVAILABLE.
 */
export async function saveGradesAction(_previous: GradingActionResult | null, formData: FormData): Promise<GradingActionResult> {
  const result = await grade(formData);
  return auditIfFailed(result, { action: "exam.grade", entityType: "mock_exam", entityId: formId(formData, "examId") });
}

async function grade(formData: FormData): Promise<GradingActionResult> {
  const actor = await getCurrentAccount();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  const units = formData.getAll("unit").filter((value): value is string => typeof value === "string");
  type Score = { id: string; note: string | null } & ({ points: number } | { pairs: number });
  const scores = units.flatMap((id): Score[] => {
    const note = formData.get(`note:${id}`);
    const cleanNote = typeof note === "string" && note.trim() !== "" ? note.trim() : null;
    const points = formData.get(`points:${id}`);
    const pairs = formData.get(`pairs:${id}`);
    if (typeof points === "string" && points !== "") return [{ id, points: Number(points), note: cleanNote }];
    if (typeof pairs === "string" && pairs !== "") return [{ id, pairs: Number(pairs), note: cleanNote }];
    return [];
  });
  const parsed = GradesSchema.safeParse({ examId: formData.get("examId"), subjectId: formData.get("subjectId"), scores });
  if (!parsed.success) return { success: false, code: "VALIDATION" };
  if (!canGradeSubject(actor, parsed.data.subjectId)) return { success: false, code: "FORBIDDEN" };
  try {
    await saveGrades(createSupabaseAdminClient(), { actorUserId: actor.userId, examId: parsed.data.examId, scores: parsed.data.scores, ipAddress: await requestIp() });
  } catch (error) {
    return failure(error, "grading/actions.saveGradesAction");
  }
  revalidatePath(`${GRADING_PATH}/${parsed.data.examId}`);
  return { success: true, data: { message: "GRADES_SAVED" } };
}

/**
 * POST (Server Action) confirmGradesAction
 * Role required: exams.grade for the exam's subject. Body: FormData { examId, subjectId }.
 * Every unit needs a grade or a pre-scored proposal; proposals become final, the exam is frozen and the student is
 * notified. Errors: UNAUTHENTICATED, FORBIDDEN, VALIDATION, NOT_FOUND, CLOSED, UNGRADED, UNAVAILABLE.
 */
export async function confirmGradesAction(_previous: GradingActionResult | null, formData: FormData): Promise<GradingActionResult> {
  const result = await confirm(formData);
  return auditIfFailed(result, { action: "exam.result_confirm", entityType: "mock_exam", entityId: formId(formData, "examId") });
}

async function confirm(formData: FormData): Promise<GradingActionResult> {
  const actor = await getCurrentAccount();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  const ids = examIdOf(formData);
  if (!ids) return { success: false, code: "VALIDATION" };
  if (!canGradeSubject(actor, ids.subjectId)) return { success: false, code: "FORBIDDEN" };
  try {
    await confirmGrades(createSupabaseAdminClient(), { actorUserId: actor.userId, examId: ids.examId, ipAddress: await requestIp() });
    logInfo("grading/actions.confirmGradesAction", "result confirmed");
  } catch (error) {
    return failure(error, "grading/actions.confirmGradesAction");
  }
  revalidatePath(GRADING_PATH, "layout");
  return { success: true, data: { message: "RESULT_CONFIRMED" } };
}

/**
 * POST (Server Action) reviewPracticeAnswerAction
 * Role required: exams.grade (the database checks the answer's own subject).
 * Body: FormData { answerId, verdict: correct|partly_correct|incorrect, note? }.
 * The verdict counts for the student's practice progress only, never for a mock exam score.
 * Errors: UNAUTHENTICATED, FORBIDDEN, VALIDATION, NOT_FOUND, UNAVAILABLE.
 */
export async function reviewPracticeAnswerAction(_previous: GradingActionResult | null, formData: FormData): Promise<GradingActionResult> {
  const result = await reviewAnswer(formData);
  return auditIfFailed(result, { action: "practice.answer_review", entityType: "practice_answer", entityId: formId(formData, "answerId") });
}

async function reviewAnswer(formData: FormData): Promise<GradingActionResult> {
  const actor = await getCurrentAccount();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  if (!canGrade(actor)) return { success: false, code: "FORBIDDEN" };
  const parsed = PracticeVerdictSchema.safeParse({ answerId: formData.get("answerId"), verdict: formData.get("verdict"), note: formData.get("note") ?? undefined });
  if (!parsed.success) return { success: false, code: "VALIDATION" };
  try {
    await reviewPracticeAnswer(createSupabaseAdminClient(), { actorUserId: actor.userId, answerId: parsed.data.answerId, verdict: parsed.data.verdict, note: parsed.data.note ?? null, ipAddress: await requestIp() });
  } catch (error) {
    return failure(error, "grading/actions.reviewPracticeAnswerAction");
  }
  revalidatePath(GRADING_PATH, "layout");
  return { success: true, data: { message: "ANSWER_REVIEWED" } };
}
