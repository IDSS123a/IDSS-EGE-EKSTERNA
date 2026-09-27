import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicSupabaseEnv } from "@/lib/env";

/**
 * A throw-away Supabase client that keeps no session and sets no cookies. Used only to check a password the
 * signed-in user re-enters (own password change), so the user's real session is never touched.
 */
export function createSupabaseVerifierClient(): SupabaseClient {
  const { url, anonKey } = getPublicSupabaseEnv();
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
