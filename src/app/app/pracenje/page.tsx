import type { ReactNode } from "react";
import { ForbiddenScreen } from "@/features/accounts/components/forbidden-screen";
import { requireAccount } from "@/features/authentication/session";
import { SupportOverviewScreen } from "@/features/support/components/support-overview-screen";
import { followUps, supportOverview } from "@/features/support/repository";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError } from "@/lib/logger";
import { canMonitorStudents, canWriteSupportNotes, hasCapability } from "@/lib/permissions";

/**
 * GET /app/pracenje — Praćenje učenika (Sprint 09). Role required: unscoped students.view_progress (pedagogue,
 * psychologist, superadministrator); the database re-checks it. Follow-ups only for support_notes.read_write.
 */
export default async function SupportOverviewPage(): Promise<ReactNode> {
  const account = await requireAccount();
  if (!canMonitorStudents(account)) return <ForbiddenScreen />;
  let view;
  try {
    const admin = createSupabaseAdminClient();
    const [students, due] = await Promise.all([
      supportOverview(admin, account.userId),
      canWriteSupportNotes(account) ? followUps(admin, account.userId) : Promise.resolve(null),
    ]);
    view = { students, due };
  } catch (error) {
    logError("app/pracenje/page", error);
    throw error;
  }
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Sarajevo" });
  return <SupportOverviewScreen students={view.students} today={today} followUps={view.due} canExport={hasCapability(account, "reports.export")} />;
}
