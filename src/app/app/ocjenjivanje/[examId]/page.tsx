import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ForbiddenScreen } from "@/features/accounts/components/forbidden-screen";
import { requireAccount } from "@/features/authentication/session";
import { RegistryFunctionError } from "@/features/canon/repository";
import { GradingExamScreen } from "@/features/grading/components/grading-exam-screen";
import { gradingView } from "@/features/grading/repository";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError } from "@/lib/logger";
import { canGrade } from "@/lib/permissions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /app/ocjenjivanje/[examId] — one mock exam for a teacher of its subject (Sprint 07): approval of a set or
 * grading of a submitted exam, with printed keys, errata and open follow-ups. An exam of another subject is answered
 * like a missing one; an exam still being written cannot be opened.
 */
export default async function GradingExamPage({ params }: { params: Promise<{ examId: string }> }): Promise<ReactNode> {
  const account = await requireAccount();
  if (!canGrade(account)) return <ForbiddenScreen />;
  const { examId } = await params;
  if (!UUID.test(examId)) notFound();
  let exam;
  try {
    exam = await gradingView(createSupabaseAdminClient(), account.userId, examId);
  } catch (error) {
    if (error instanceof RegistryFunctionError && ["NOT_FOUND", "FORBIDDEN", "IN_PROGRESS"].includes(error.databaseMessage)) notFound();
    logError("app/ocjenjivanje/[examId]/page", error);
    throw error;
  }
  return <GradingExamScreen key={`${exam.id}-${exam.status}`} exam={exam} />;
}
