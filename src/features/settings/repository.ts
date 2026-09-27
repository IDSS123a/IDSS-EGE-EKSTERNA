import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RegistryFunctionError } from "@/features/canon/repository";
import { DEFAULT_SPLASH_SHARES, type SplashShares, validShares } from "@/features/splash/palette";

/**
 * Database access for application settings (A-3). The splash palette is read with the service role (the splash is
 * public and pre-authentication; only this one key is read); it is written only through set_splash_palette
 * (migration 012) after the action has authorised the caller.
 */

const SPLASH_PALETTE_KEY = "splash.palette";

/** The stored splash palette, or the default when none is stored or it is malformed. */
export async function readSplashPalette(admin: SupabaseClient): Promise<SplashShares> {
  const { data, error } = await admin.from("system_settings").select("value").eq("key", SPLASH_PALETTE_KEY).maybeSingle<{ value: SplashShares }>();
  if (error) throw new Error(`readSplashPalette failed: ${error.message}`);
  return data && validShares(data.value) ? data.value : DEFAULT_SPLASH_SHARES;
}

/**
 * set_splash_palette: validated in the database again, audited with before and after.
 * @throws RegistryFunctionError with the database's machine message
 */
export async function saveSplashPalette(admin: SupabaseClient, input: { actorUserId: string; shares: SplashShares; ipAddress: string | null }): Promise<void> {
  const { error } = await admin.rpc("set_splash_palette", { p_actor: input.actorUserId, p_value: input.shares, p_ip: input.ipAddress });
  if (error) throw new RegistryFunctionError(error.message);
}
