import type { ReactNode } from "react";
import { ForbiddenScreen } from "@/features/accounts/components/forbidden-screen";
import { requireAccount } from "@/features/authentication/session";
import { DailySummaryScreen } from "@/features/support/components/daily-summary-screen";
import { summaryDay } from "@/features/support/domain/indicators";
import { dailySummary } from "@/features/support/repository";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError } from "@/lib/logger";
import { canGrade, canViewStudentProgress } from "@/lib/permissions";

/**
 * GET /app/pracenje/dan?d=YYYY-MM-DD — daily summary (PDL-018 item 3, Sprint 09). Role required: students.view_progress;
 * a subject teacher sees the own subjects only (migration 027). Default day: yesterday (Europe/Sarajevo), at most 30
 * days back. Facts only: who practised, who did not and since when, areas of that day, open work.
 */
export default async function DailySummaryPage({ searchParams }: { searchParams: Promise<{ d?: string }> }): Promise<ReactNode> {
  const account = await requireAccount();
  if (!canViewStudentProgress(account)) return <ForbiddenScreen />;
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Sarajevo" });
  const day = summaryDay((await searchParams).d, today);
  let summary;
  try {
    summary = await dailySummary(createSupabaseAdminClient(), account.userId, day);
  } catch (error) {
    logError("app/pracenje/dan/page", error);
    throw error;
  }
  return <DailySummaryScreen summary={summary} canGrade={canGrade(account)} />;
}
