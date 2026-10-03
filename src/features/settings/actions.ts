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
import { AppSettingSchema, SplashPaletteSchema } from "@/lib/validation/schemas";
import { saveSetting } from "./app-settings";
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

const XP_FIELDS = ["answer_correct", "answer_partly_correct", "answer_incorrect", "mission_completed", "practice_day", "mock_exam_submitted", "mock_exam_point", "mock_exam_points_cap"] as const;

/**
 * POST (Server Action) saveAppSettingAction
 * Role required: settings.manage (the Director). Body: FormData { key: mission.daily_goal | privacy.min_group |
 * gamification.values, value | xp.* and badges.* }. The database validates again and audits before and after
 * (migration 033, PDL-040 K5). Exam rules and scoring are canon and never settings (P-15).
 * Errors: UNAUTHENTICATED, FORBIDDEN, VALIDATION, UNAVAILABLE.
 */
export async function saveAppSettingAction(_previous: SettingsActionResult | null, formData: FormData): Promise<SettingsActionResult> {
  const result = await saveApp(formData);
  return auditIfFailed(result, { action: "settings.change", entityType: "system_setting", entityId: String(formData.get("key") ?? "") });
}

async function saveApp(formData: FormData): Promise<SettingsActionResult> {
  const actor = await getCurrentAccount();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  if (!canManageSettings(actor)) return { success: false, code: "FORBIDDEN" };
  const key = formData.get("key");
  const parsed = AppSettingSchema.safeParse(
    key === "gamification.values"
      ? {
          key,
          xp: Object.fromEntries(XP_FIELDS.map((field) => [field, formData.get(`xp.${field}`)])),
          badges: { streak_days: formData.get("badges.streak_days"), answers_in_subject: formData.get("badges.answers_in_subject") },
        }
      : { key, value: formData.get("value") },
  );
  if (!parsed.success) return { success: false, code: "VALIDATION" };
  const value = parsed.data.key === "gamification.values" ? { xp: parsed.data.xp, badges: parsed.data.badges } : { value: parsed.data.value };
  try {
    await saveSetting(createSupabaseAdminClient(), { actorUserId: actor.userId, key: parsed.data.key, value, ipAddress: clientIpFrom((await headers()).get("x-forwarded-for")) });
    logInfo("settings/actions.saveAppSettingAction", "setting saved", { key: parsed.data.key });
  } catch (error) {
    const code = error instanceof RegistryFunctionError && (error.databaseMessage === "FORBIDDEN" || error.databaseMessage === "VALIDATION") ? error.databaseMessage : "UNAVAILABLE";
    if (code === "UNAVAILABLE") logError("settings/actions.saveAppSettingAction", error);
    return { success: false, code };
  }
  revalidatePath(SETTINGS_PATH);
  return { success: true, data: { message: "SAVED" } };
}
