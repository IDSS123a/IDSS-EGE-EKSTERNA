import type { ReactNode } from "react";
import { ForbiddenScreen } from "@/features/accounts/components/forbidden-screen";
import { requireAccount } from "@/features/authentication/session";
import { PracticeReviewScreen } from "@/features/grading/components/practice-review-screen";
import { practiceReviewQueue } from "@/features/grading/repository";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError } from "@/lib/logger";
import { canGrade } from "@/lib/permissions";

/**
 * GET /app/ocjenjivanje/vjezba — practice answers waiting for the teacher (Sprint 08, migration 021).
 * Role required: exams.grade; the database returns only answers of subjects the teacher grades.
 */
export default async function PracticeReviewPage(): Promise<ReactNode> {
  const account = await requireAccount();
  if (!canGrade(account)) return <ForbiddenScreen />;
  let entries;
  try {
    entries = await practiceReviewQueue(createSupabaseAdminClient(), account.userId);
  } catch (error) {
    logError("app/ocjenjivanje/vjezba/page", error);
    throw error;
  }
  return <PracticeReviewScreen entries={entries} />;
}
