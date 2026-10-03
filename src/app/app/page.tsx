import type { ReactNode } from "react";
import { DAILY_MISSION_GOAL } from "@/constants";
import { AccountHome } from "@/features/account/components/account-home";
import { requireAccount } from "@/features/authentication/session";
import { GameHub } from "@/features/practice/components/game-hub";
import { practiceOverview } from "@/features/practice/repository";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError } from "@/lib/logger";
import { canGrade, canManageSettings, canOpenReview, canPractise, canViewAccounts, canViewCanon } from "@/lib/permissions";

/**
 * GET /app — Role required: any active account. Redirects to /prijava otherwise.
 * Students get the Game Hub (Sprint 06): their own practice counts through practice_overview (migration 017),
 * which re-checks practice.participate. Staff get the workspace links.
 */
export default async function AppHomePage(): Promise<ReactNode> {
  const account = await requireAccount();
  if (canPractise(account)) {
    let overview;
    try {
      overview = await practiceOverview(createSupabaseAdminClient(), account.userId);
    } catch (error) {
      logError("app/page.practiceOverview", error);
      throw error;
    }
    return <GameHub displayName={account.displayName} overview={overview} dailyGoal={DAILY_MISSION_GOAL} />;
  }
  return <AccountHome account={{ displayName: account.displayName, role: account.role }} canViewAccounts={canViewAccounts(account)} canViewCanon={canViewCanon(account)} canOpenReview={canOpenReview(account)} canManageSettings={canManageSettings(account)} canGrade={canGrade(account)} />;
}
