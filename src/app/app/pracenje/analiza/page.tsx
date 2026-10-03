import type { ReactNode } from "react";
import { ForbiddenScreen } from "@/features/accounts/components/forbidden-screen";
import { requireAccount } from "@/features/authentication/session";
import { GroupAnalysisScreen } from "@/features/support/components/group-analysis-screen";
import { groupPatterns } from "@/features/support/repository";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError } from "@/lib/logger";
import { canMonitorStudents } from "@/lib/permissions";

/** GET /app/pracenje/analiza — group analysis, aggregates only (Sprint 09). Role required: unscoped students.view_progress. */
export default async function GroupAnalysisPage(): Promise<ReactNode> {
  const account = await requireAccount();
  if (!canMonitorStudents(account)) return <ForbiddenScreen />;
  let patterns;
  try {
    patterns = await groupPatterns(createSupabaseAdminClient(), account.userId);
  } catch (error) {
    logError("app/pracenje/analiza/page", error);
    throw error;
  }
  return <GroupAnalysisScreen patterns={patterns} />;
}
