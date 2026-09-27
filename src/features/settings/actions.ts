"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { SETTINGS_PATH } from "@/constants";
import { auditIfFailed } from "@/features/audit/failures";
import { clientIpFrom } from "@/features/authentication/domain";
import { getCurrentAccount } from "@/features/authentication/session";
import { RegistryFunctionError } from "@/features/canon/repository";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError, logInfo } from "@/lib/logger";
import { canManageSettings } from "@/lib/permissions";
import { SplashPaletteSchema } from "@/lib/validation/schemas";
import { saveSplashPalette } from "./repository";
import type { SettingsActionResult } from "./types";

/**
 * POST (Server Action) saveSplashPaletteAction
 * Role required: settings.manage (Superadmin).
 * Body: FormData { red, yellow, blue, sky } in percent, 0 to 100, adding up to 100.
 * The database validates again and writes the audit row with before and after (migration 012).
 * Errors: UNAUTHENTICATED, FORBIDDEN, VALIDATION, UNAVAILABLE.
 */
export async function saveSplashPaletteAction(_previous: SettingsActionResult | null, formData: FormData): Promise<SettingsActionResult> {
  const result = await save(formData);
  return auditIfFailed(result, { action: "settings.splash_palette", entityType: "system_setting", entityId: "splash.palette" });
}

async function save(formData: FormData): Promise<SettingsActionResult> {
  const actor = await getCurrentAccount();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  if (!canManageSettings(actor)) return { success: false, code: "FORBIDDEN" };
  const parsed = SplashPaletteSchema.safeParse({ red: formData.get("red"), yellow: formData.get("yellow"), blue: formData.get("blue"), sky: formData.get("sky") });
  if (!parsed.success) return { success: false, code: "VALIDATION" };
  try {
    await saveSplashPalette(createSupabaseAdminClient(), { actorUserId: actor.userId, shares: parsed.data, ipAddress: clientIpFrom((await headers()).get("x-forwarded-for")) });
    logInfo("settings/actions.saveSplashPaletteAction", "splash palette saved", { red: parsed.data.red });
  } catch (error) {
    const code = error instanceof RegistryFunctionError && (error.databaseMessage === "FORBIDDEN" || error.databaseMessage === "VALIDATION") ? error.databaseMessage : "UNAVAILABLE";
    if (code === "UNAVAILABLE") logError("settings/actions.saveSplashPaletteAction", error);
    return { success: false, code };
  }
  revalidatePath(SETTINGS_PATH);
  return { success: true, data: { message: "SAVED" } };
}
