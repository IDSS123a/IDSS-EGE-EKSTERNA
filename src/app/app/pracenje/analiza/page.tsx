import type { ReactNode } from "react";
import { ForbiddenScreen } from "@/features/accounts/components/forbidden-screen";
import { requireAccount } from "@/features/authentication/session";
import { GroupAnalysisScreen } from "@/features/support/components/group-analysis-screen";
import { groupPatterns, visibleSubjectCodes } from "@/features/support/repository";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError } from "@/lib/logger";
import { canViewStudentProgress, hasCapability } from "@/lib/permissions";

/** GET /app/pracenje/analiza — group analysis, aggregates only (Sprint 09). Role required: students.view_progress (own subjects for a teacher). */
export default async function GroupAnalysisPage(): Promise<ReactNode> {
  const account = await requireAccount();
  if (!canViewStudentProgress(account)) return <ForbiddenScreen />;
  let patterns, codes;
  try {
    const admin = createSupabaseAdminClient();
    [patterns, codes] = await Promise.all([groupPatterns(admin, account.userId), visibleSubjectCodes(admin, account)]);
  } catch (error) {
    logError("app/pracenje/analiza/page", error);
    throw error;
  }
  return <GroupAnalysisScreen patterns={patterns} codes={codes} canExport={hasCapability(account, "reports.export")} />;
}
