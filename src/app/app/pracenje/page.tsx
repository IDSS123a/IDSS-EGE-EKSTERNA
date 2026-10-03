import type { ReactNode } from "react";
import { ForbiddenScreen } from "@/features/accounts/components/forbidden-screen";
import { requireAccount } from "@/features/authentication/session";
import { SupportOverviewScreen } from "@/features/support/components/support-overview-screen";
import { followUps, supportOverview, visibleSubjectCodes } from "@/features/support/repository";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError } from "@/lib/logger";
import { canViewStudentProgress, canWriteSupportNotes, hasCapability } from "@/lib/permissions";

/**
 * GET /app/pracenje — Praćenje učenika (Sprint 09). Role required: students.view_progress, unscoped (pedagogue,
 * psychologist, superadministrator) or scoped to the own subjects (subject teacher); the database re-checks it and
 * narrows the data to the scope (migration 027). Follow-ups only for support_notes.read_write.
 */
export default async function SupportOverviewPage(): Promise<ReactNode> {
  const account = await requireAccount();
  if (!canViewStudentProgress(account)) return <ForbiddenScreen />;
  let view;
  try {
    const admin = createSupabaseAdminClient();
    const [students, codes, due] = await Promise.all([
      supportOverview(admin, account.userId),
      visibleSubjectCodes(admin, account),
      canWriteSupportNotes(account) ? followUps(admin, account.userId) : Promise.resolve(null),
    ]);
    view = { students, codes, due };
  } catch (error) {
    logError("app/pracenje/page", error);
    throw error;
  }
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Sarajevo" });
  return <SupportOverviewScreen students={view.students} codes={view.codes} today={today} followUps={view.due} canExport={hasCapability(account, "reports.export")} />;
}
