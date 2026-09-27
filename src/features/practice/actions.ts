"use server";

import { revalidatePath } from "next/cache";
import { PRACTICE_PATH } from "@/constants";
import { auditIfFailed, formId } from "@/features/audit/failures";
import { getCurrentAccount } from "@/features/authentication/session";
import { RegistryFunctionError } from "@/features/canon/repository";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError } from "@/lib/logger";
import { canPractise } from "@/lib/permissions";
import { PracticeAnswerSchema } from "@/lib/validation/schemas";
import { submitAnswer } from "./repository";
import type { PracticeErrorCode, PracticeSubmitResult } from "./types";

const KNOWN: PracticeErrorCode[] = ["FORBIDDEN", "VALIDATION", "NOT_FOUND"];

/**
 * POST (Server Action) submitPracticeAnswerAction
 * Role required: practice.participate (students).
 * Body: FormData { questionVersionId, subjectId, item[] (item number or "" for the whole task), response:i per item }.
 * The database checks closed items against the effective key, stores the answer for the student's person and
 * only then returns the solution (PDL-018). Open answers are stored for the teacher.
 * Errors: UNAUTHENTICATED, FORBIDDEN, VALIDATION, NOT_FOUND, UNAVAILABLE.
 */
export async function submitPracticeAnswerAction(_previous: PracticeSubmitResult | null, formData: FormData): Promise<PracticeSubmitResult> {
  const result = await submit(formData);
  return auditIfFailed(result, { action: "practice.answer", entityType: "question_version", entityId: formId(formData, "questionVersionId") });
}

async function submit(formData: FormData): Promise<PracticeSubmitResult> {
  const actor = await getCurrentAccount();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  if (!canPractise(actor)) return { success: false, code: "FORBIDDEN" };
  // Items in form order; the response of item i is the field "response:i" (a radio group or a text area).
  const items = formData.getAll("item").map((value) => (typeof value === "string" && value !== "" ? Number(value) : null));
  const responses = items.map((_item, index) => {
    const value = formData.get(`response:${index}`);
    return typeof value === "string" ? value : "";
  });
  const parsed = PracticeAnswerSchema.safeParse({
    questionVersionId: formData.get("questionVersionId"),
    subjectId: formData.get("subjectId"),
    responses: items.map((item, index) => ({ item, response: responses[index] })),
  });
  if (!parsed.success) return { success: false, code: "VALIDATION" };
  try {
    const data = await submitAnswer(createSupabaseAdminClient(), { actorUserId: actor.userId, questionVersionId: parsed.data.questionVersionId, responses: parsed.data.responses });
    revalidatePath(PRACTICE_PATH);
    return { success: true, data };
  } catch (error) {
    const code = error instanceof RegistryFunctionError ? (KNOWN.find((known) => known === error.databaseMessage) ?? "UNAVAILABLE") : "UNAVAILABLE";
    if (code === "UNAVAILABLE") logError("practice/actions.submitPracticeAnswerAction", error);
    return { success: false, code };
  }
}
