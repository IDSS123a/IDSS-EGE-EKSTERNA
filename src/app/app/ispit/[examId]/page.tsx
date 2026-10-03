import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ForbiddenScreen } from "@/features/accounts/components/forbidden-screen";
import { requireAccount } from "@/features/authentication/session";
import { RegistryFunctionError } from "@/features/canon/repository";
import { ExamScreen } from "@/features/exams/components/exam-screen";
import { examView } from "@/features/exams/repository";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError } from "@/lib/logger";
import { canPractise } from "@/lib/permissions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /app/ispit/[examId] — one mock exam of the student (Sprint 07). Role required: practice.participate; another
 * student's exam is answered like a missing one. Questions arrive only after the start, keys and points only once graded.
 */
export default async function ExamPage({ params }: { params: Promise<{ examId: string }> }): Promise<ReactNode> {
  const account = await requireAccount();
  if (!canPractise(account)) return <ForbiddenScreen />;
  const { examId } = await params;
  if (!UUID.test(examId)) notFound();
  let exam;
  try {
    exam = await examView(createSupabaseAdminClient(), account.userId, examId);
  } catch (error) {
    if (error instanceof RegistryFunctionError && error.databaseMessage === "NOT_FOUND") notFound();
    logError("app/ispit/[examId]/page", error);
    throw error;
  }
  // The key resets the writer's local state when the exam changes state (start, submission, grading).
  return <ExamScreen key={`${exam.id}-${exam.status}`} exam={exam} />;
}
