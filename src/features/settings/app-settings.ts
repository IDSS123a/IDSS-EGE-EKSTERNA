import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { DAILY_MISSION_GOAL, MIN_GROUP_DEFAULT } from "@/constants";
import { RegistryFunctionError } from "@/features/canon/repository";
import { GAMIFICATION } from "@/features/gamification/config";

/**
 * The settings the Director owns (PDL-040, K5): the daily mission goal, the IDSS points and badge values and the
 * minimum group for aggregates. Stored in system_settings (migration 033); read with the service role after the page
 * has authorised the caller, written only through set_setting (validated and audited in the database). When a value is
 * missing or malformed the approved default from the code applies (PDL-024, PDL-029, K2).
 */

export const SETTING_KEYS = { missionGoal: "mission.daily_goal", gamification: "gamification.values", minGroup: "privacy.min_group" } as const;
export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

const IntValue = z.object({ value: z.number().int().min(1) });
export const GamificationValuesSchema = z.object({ xp: z.object({
  answer_correct: z.number().min(0).max(1000),
  answer_partly_correct: z.number().min(0).max(1000),
  answer_incorrect: z.number().min(0).max(1000),
  mission_completed: z.number().min(0).max(1000),
  practice_day: z.number().min(0).max(1000),
  mock_exam_submitted: z.number().min(0).max(1000),
  mock_exam_point: z.number().min(0).max(1000),
  mock_exam_points_cap: z.number().min(0).max(1000),
}), badges: z.object({ streak_days: z.number().int().min(1).max(1000), answers_in_subject: z.number().int().min(1).max(1000) }) });
export type GamificationValues = z.infer<typeof GamificationValuesSchema>;

export type AppSettings = { missionGoal: number; gamification: GamificationValues; minGroup: number };

export const DEFAULT_APP_SETTINGS: AppSettings = {
  missionGoal: DAILY_MISSION_GOAL,
  gamification: { xp: GAMIFICATION.xp, badges: GAMIFICATION.badges },
  minGroup: MIN_GROUP_DEFAULT,
};

/** The Director's settings, each falling back to its approved default. */
export async function readAppSettings(admin: SupabaseClient): Promise<AppSettings> {
  const { data, error } = await admin.from("system_settings").select("key, value").in("key", Object.values(SETTING_KEYS)).returns<{ key: string; value: unknown }[]>();
  if (error) throw new Error(`readAppSettings failed: ${error.message}`);
  const value = (key: string) => data?.find((row) => row.key === key)?.value;
  const goal = IntValue.safeParse(value(SETTING_KEYS.missionGoal));
  const game = GamificationValuesSchema.safeParse(value(SETTING_KEYS.gamification));
  const group = IntValue.safeParse(value(SETTING_KEYS.minGroup));
  return {
    missionGoal: goal.success ? goal.data.value : DEFAULT_APP_SETTINGS.missionGoal,
    gamification: game.success ? game.data : DEFAULT_APP_SETTINGS.gamification,
    minGroup: group.success ? group.data.value : DEFAULT_APP_SETTINGS.minGroup,
  };
}

/** set_setting: validated in the database again, audited with before and after (migration 033). */
export async function saveSetting(admin: SupabaseClient, input: { actorUserId: string; key: SettingKey; value: unknown; ipAddress: string | null }): Promise<void> {
  const { error } = await admin.rpc("set_setting", { p_actor: input.actorUserId, p_key: input.key, p_value: input.value, p_ip: input.ipAddress });
  if (error) throw new RegistryFunctionError(error.message);
}

export type SettingChange = { at: string; by: string | null; before: unknown; after: unknown };

/** settings_history: the last 20 changes of one setting. */
export async function settingHistory(admin: SupabaseClient, actorUserId: string, key: SettingKey): Promise<SettingChange[]> {
  const { data, error } = await admin.rpc("settings_history", { p_actor: actorUserId, p_key: key });
  if (error) throw new RegistryFunctionError(error.message);
  return (data ?? []) as SettingChange[];
}
