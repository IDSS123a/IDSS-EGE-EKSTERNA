import type { ReactNode } from "react";
import { ForbiddenScreen } from "@/features/accounts/components/forbidden-screen";
import { requireAccount } from "@/features/authentication/session";
import { ExamOverviewScreen } from "@/features/exams/components/exam-overview-screen";
import { examOverview } from "@/features/exams/repository";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError } from "@/lib/logger";
import { canPractise } from "@/lib/permissions";

/**
 * GET /app/ispit — the student's mock exams (Sprint 07): per subject the open exam or a request for a new set, then
 * earlier exams. Role required: practice.participate. The database returns only the student's own exams.
 */
export default async function ExamsPage(): Promise<ReactNode> {
  const account = await requireAccount();
  if (!canPractise(account)) return <ForbiddenScreen />;
  let overview;
  try {
    overview = await examOverview(createSupabaseAdminClient(), account.userId);
  } catch (error) {
    logError("app/ispit/page", error);
    throw error;
  }
  return <ExamOverviewScreen overview={overview} />;
}
