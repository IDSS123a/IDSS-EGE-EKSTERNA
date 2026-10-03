import type { ReactNode } from "react";
import { ForbiddenScreen } from "@/features/accounts/components/forbidden-screen";
import { requireAccount } from "@/features/authentication/session";
import { SettingsScreen } from "@/features/settings/components/settings-screen";
import { readAppSettings, settingHistory, SETTING_KEYS } from "@/features/settings/app-settings";
import { readSplashPalette } from "@/features/settings/repository";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError } from "@/lib/logger";
import { canManageSettings } from "@/lib/permissions";

/**
 * GET /app/postavke — application settings (PDL-020, PDL-040 K5).
 * Role required: settings.manage (Superadmin). The palette is read with the service role after the check.
 */
export default async function SettingsPage(): Promise<ReactNode> {
  const account = await requireAccount();
  if (!canManageSettings(account)) return <ForbiddenScreen />;
  let palette, app;
  try {
    const admin = createSupabaseAdminClient();
    const [splash, settings, mission, group, points] = await Promise.all([
      readSplashPalette(admin),
      readAppSettings(admin),
      settingHistory(admin, account.userId, SETTING_KEYS.missionGoal),
      settingHistory(admin, account.userId, SETTING_KEYS.minGroup),
      settingHistory(admin, account.userId, SETTING_KEYS.gamification),
    ]);
    palette = splash;
    app = { missionGoal: settings.missionGoal, minGroup: settings.minGroup, gamification: settings.gamification, history: { "mission.daily_goal": mission, "privacy.min_group": group, "gamification.values": points } };
  } catch (error) {
    logError("app/postavke/page", error);
    throw error;
  }
  return <SettingsScreen palette={palette} app={app} />;
}
