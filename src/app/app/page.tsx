import type { ReactNode } from "react";
import { NOTIFICATIONS_LIMIT } from "@/constants";
import { AccountHome } from "@/features/account/components/account-home";
import { studentAssignments } from "@/features/assignments/repository";
import { studentGifts } from "@/features/gifts/repository";
import { requireAccount } from "@/features/authentication/session";
import { gamificationOverview } from "@/features/gamification/repository";
import { readAppSettings } from "@/features/settings/app-settings";
import { listSubjects } from "@/features/knowledge/repository";
import { listNotifications } from "@/features/notifications/repository";
import { GameHub } from "@/features/practice/components/game-hub";
import { practiceOverview } from "@/features/practice/repository";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { logError } from "@/lib/logger";
import { canGrade, canManageAssignments, canManageSettings, canViewStudentProgress, canOpenReview, canPractise, canViewAccounts, canViewCanon, canViewInstitution } from "@/lib/permissions";

/**
 * GET /app — Role required: any active account. Redirects to /prijava otherwise.
 * Students get the Game Hub (Sprint 06): their own practice counts through practice_overview (migration 017),
 * which re-checks practice.participate, their own notifications (RLS) and XP and badges (migration 025, PDL-029) and their teachers' assignments (migration 029, PDL-035). Staff get the workspace links.
 */
export default async function AppHomePage(): Promise<ReactNode> {
  const account = await requireAccount();
  if (canPractise(account)) {
    let view;
    try {
      const client = await createSupabaseServerClient();
      const admin = createSupabaseAdminClient();
      const settings = await readAppSettings(admin);
      const [overview, notifications, gamification, assignments, gifts] = await Promise.all([
        practiceOverview(admin, account.userId),
        listSubjects(client).then((subjects) => listNotifications(client, subjects, NOTIFICATIONS_LIMIT)),
        gamificationOverview(admin, account.userId, settings),
        studentAssignments(admin, account.userId),
        studentGifts(admin, account.userId),
      ]);
      view = { overview, notifications, gamification, assignments, gifts, settings };
    } catch (error) {
      logError("app/page.practiceOverview", error);
      throw error;
    }
    return <GameHub displayName={account.displayName} overview={view.overview} dailyGoal={view.settings.missionGoal} notifications={view.notifications} gamification={view.gamification} assignments={view.assignments} gifts={view.gifts} badgeRules={{ streakDays: view.settings.gamification.badges.streak_days, answersInSubject: view.settings.gamification.badges.answers_in_subject }} />;
  }
  return <AccountHome account={{ displayName: account.displayName, role: account.role }} canViewAccounts={canViewAccounts(account)} canViewCanon={canViewCanon(account)} canOpenReview={canOpenReview(account)} canManageSettings={canManageSettings(account)} canGrade={canGrade(account)} canMonitor={canViewStudentProgress(account)} canAssign={canManageAssignments(account)} canDirect={canViewInstitution(account)} />;
}
