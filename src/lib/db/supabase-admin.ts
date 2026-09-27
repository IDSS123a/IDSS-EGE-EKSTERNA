import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicSupabaseEnv, getServiceRoleKey } from "@/lib/env";

/**
 * Service-role client — bypasses RLS. Used ONLY after the caller has been authenticated and
 * authorised in application code (E-6), for writes RLS deliberately forbids to clients:
 * audit/security events and account administration (A-8).
 */
export function createSupabaseAdminClient(): SupabaseClient {
  const { url } = getPublicSupabaseEnv();
  return createClient(url, getServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
