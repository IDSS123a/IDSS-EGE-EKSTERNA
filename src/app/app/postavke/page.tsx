import type { ReactNode } from "react";
import { ForbiddenScreen } from "@/features/accounts/components/forbidden-screen";
import { requireAccount } from "@/features/authentication/session";
import { SettingsScreen } from "@/features/settings/components/settings-screen";
import { readSplashPalette } from "@/features/settings/repository";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError } from "@/lib/logger";
import { canManageSettings } from "@/lib/permissions";

/**
 * GET /app/postavke — application settings (PDL-020).
 * Role required: settings.manage (Superadmin). The palette is read with the service role after the check.
 */
export default async function SettingsPage(): Promise<ReactNode> {
  const account = await requireAccount();
  if (!canManageSettings(account)) return <ForbiddenScreen />;
  let palette;
  try {
    palette = await readSplashPalette(createSupabaseAdminClient());
  } catch (error) {
    logError("app/postavke/page", error);
    throw error;
  }
  return <SettingsScreen palette={palette} />;
}
