import type { ReactNode } from "react";
import { DAILY_MISSION_GOAL, NOTIFICATIONS_LIMIT } from "@/constants";
import { AccountHome } from "@/features/account/components/account-home";
import { requireAccount } from "@/features/authentication/session";
import { listSubjects } from "@/features/knowledge/repository";
import { listNotifications } from "@/features/notifications/repository";
import { GameHub } from "@/features/practice/components/game-hub";
import { practiceOverview } from "@/features/practice/repository";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { logError } from "@/lib/logger";
import { canGrade, canManageSettings, canOpenReview, canPractise, canViewAccounts, canViewCanon } from "@/lib/permissions";

/**
 * GET /app — Role required: any active account. Redirects to /prijava otherwise.
 * Students get the Game Hub (Sprint 06): their own practice counts through practice_overview (migration 017),
 * which re-checks practice.participate, and their own notifications (RLS). Staff get the workspace links.
 */
export default async function AppHomePage(): Promise<ReactNode> {
  const account = await requireAccount();
  if (canPractise(account)) {
    let view;
    try {
      const client = await createSupabaseServerClient();
      const [overview, notifications] = await Promise.all([
        practiceOverview(createSupabaseAdminClient(), account.userId),
        listSubjects(client).then((subjects) => listNotifications(client, subjects, NOTIFICATIONS_LIMIT)),
      ]);
      view = { overview, notifications };
    } catch (error) {
      logError("app/page.practiceOverview", error);
      throw error;
    }
    return <GameHub displayName={account.displayName} overview={view.overview} dailyGoal={DAILY_MISSION_GOAL} notifications={view.notifications} />;
  }
  return <AccountHome account={{ displayName: account.displayName, role: account.role }} canViewAccounts={canViewAccounts(account)} canViewCanon={canViewCanon(account)} canOpenReview={canOpenReview(account)} canManageSettings={canManageSettings(account)} canGrade={canGrade(account)} />;
}
