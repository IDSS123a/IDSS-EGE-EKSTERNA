import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccountRole, AccountStatus } from "@/features/authentication/types";
import type { AccountSummary } from "./types";

/**
 * Database access for account administration (A-3).
 * Reads use the user-scoped client (RLS decides visibility); writes use the service-role
 * client and are only called after the action has authorised the caller.
 */

type ProfileRow = { user_id: string; username: string; display_name: string; role: AccountRole; account_status: AccountStatus; created_at: string };

/** Accounts visible to the caller (RLS: managers see all), newest first, bounded (A-3 limit). */
export async function listAccounts(client: SupabaseClient, limit: number): Promise<AccountSummary[]> {
  const profiles = await client
    .from("profiles")
    .select("user_id, username, display_name, role, account_status, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<ProfileRow[]>();
  if (profiles.error) throw new Error(`listAccounts failed: ${profiles.error.message}`);
  const bundles = await client.from("profile_bundles").select("profile_user_id, bundle_code, scope_subject_id");
  if (bundles.error) throw new Error(`listAccounts(bundles) failed: ${bundles.error.message}`);
  const byUser = new Map<string, string[]>();
  const subjectsByUser = new Map<string, string[]>();
  for (const row of bundles.data as { profile_user_id: string; bundle_code: string; scope_subject_id: string | null }[]) {
    if (row.scope_subject_id) subjectsByUser.set(row.profile_user_id, [...(subjectsByUser.get(row.profile_user_id) ?? []), row.scope_subject_id]);
    else byUser.set(row.profile_user_id, [...(byUser.get(row.profile_user_id) ?? []), row.bundle_code]);
  }
  return (profiles.data ?? []).map((row) => ({
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    status: row.account_status,
    bundles: (byUser.get(row.user_id) ?? []).sort(),
    teachesSubjectIds: subjectsByUser.get(row.user_id) ?? [],
    createdAt: row.created_at,
  }));
}

/** Target account for a lifecycle change (service role; caller already authorised). */
export async function findAccountTarget(admin: SupabaseClient, userId: string): Promise<{ userId: string; role: AccountRole; status: AccountStatus } | null> {
  const { data, error } = await admin
    .from("profiles")
    .select("user_id, role, account_status")
    .eq("user_id", userId)
    .maybeSingle<{ user_id: string; role: AccountRole; account_status: AccountStatus }>();
  if (error) throw new Error(`findAccountTarget failed: ${error.message}`);
  return data ? { userId: data.user_id, role: data.role, status: data.account_status } : null;
}

/** True when a profile with this username exists (usernames are stored lower-case; exact match avoids LIKE wildcards). */
export async function usernameExists(admin: SupabaseClient, username: string): Promise<boolean> {
  const { count, error } = await admin.from("profiles").select("user_id", { count: "exact", head: true }).eq("username", username);
  if (error) throw new Error(`usernameExists failed: ${error.message}`);
  return (count ?? 0) > 0;
}

/** Insert a profile; returns false when no row was written. */
export async function insertProfile(
  admin: SupabaseClient,
  profile: { userId: string; username: string; displayName: string; role: AccountRole; status: AccountStatus },
): Promise<void> {
  const { data, error } = await admin
    .from("profiles")
    .insert({ user_id: profile.userId, username: profile.username, display_name: profile.displayName, role: profile.role, account_status: profile.status })
    .select("user_id")
    .maybeSingle();
  if (error || !data) throw new Error(`insertProfile failed: ${error?.message ?? "0 rows"}`);
}

/** Longitudinal person record for a student (§7A.4). */
export async function insertPerson(admin: SupabaseClient, userId: string): Promise<void> {
  const { data, error } = await admin.from("persons").insert({ profile_user_id: userId }).select("id").maybeSingle();
  if (error || !data) throw new Error(`insertPerson failed: ${error?.message ?? "0 rows"}`);
}

/** Update status; checks the affected row (A-3: a by-id write that touched nothing is a failure). */
export async function updateAccountStatus(admin: SupabaseClient, userId: string, status: AccountStatus): Promise<boolean> {
  const { data, error } = await admin
    .from("profiles")
    .update({ account_status: status, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .select("user_id")
    .maybeSingle();
  if (error) throw new Error(`updateAccountStatus failed: ${error.message}`);
  return data !== null;
}

/** Grant a bundle, unscoped (subjectId null) or for one subject (idempotent). */
export async function grantBundle(admin: SupabaseClient, userId: string, bundle: string, grantedBy: string, subjectId: string | null = null): Promise<void> {
  let check = admin.from("profile_bundles").select("id").eq("profile_user_id", userId).eq("bundle_code", bundle);
  check = subjectId ? check.eq("scope_subject_id", subjectId) : check.is("scope_subject_id", null);
  const existing = await check.maybeSingle();
  if (existing.error) throw new Error(`grantBundle(check) failed: ${existing.error.message}`);
  if (existing.data) return;
  const { error } = await admin.from("profile_bundles").insert({ profile_user_id: userId, bundle_code: bundle, granted_by: grantedBy, scope_subject_id: subjectId });
  if (error) throw new Error(`grantBundle failed: ${error.message}`);
}

/** Revoke a bundle, unscoped (subjectId null) or for one subject. */
export async function revokeBundle(admin: SupabaseClient, userId: string, bundle: string, subjectId: string | null = null): Promise<void> {
  let query = admin.from("profile_bundles").delete().eq("profile_user_id", userId).eq("bundle_code", bundle);
  query = subjectId ? query.eq("scope_subject_id", subjectId) : query.is("scope_subject_id", null);
  const { error } = await query;
  if (error) throw new Error(`revokeBundle failed: ${error.message}`);
}
