import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LOGIN_FAILURE_WINDOW_MINUTES } from "@/constants";
import type { AccountRole, AccountStatus, CurrentAccount } from "./types";

/**
 * Database access for authentication (A-3). No business rules here.
 */

type ProfileRow = { user_id: string; username: string; display_name: string; role: AccountRole; account_status: AccountStatus };

/**
 * Load a profile by auth user id. With a user-scoped client, RLS returns only the caller's own row.
 * @returns the account or null when no profile exists
 */
export async function findProfileByUserId(client: SupabaseClient, userId: string): Promise<CurrentAccount | null> {
  const { data, error } = await client
    .from("profiles")
    .select("user_id, username, display_name, role, account_status")
    .eq("user_id", userId)
    .maybeSingle<ProfileRow>();
  if (error) throw new Error(`findProfileByUserId failed: ${error.message}`);
  if (!data) return null;
  return { userId: data.user_id, username: data.username, displayName: data.display_name, role: data.role, status: data.account_status };
}

/**
 * Count recent failed logins for a username hash and for an IP (admin client — security_events has no client read policy).
 */
export async function countRecentLoginFailures(
  admin: SupabaseClient,
  usernameSha256: string,
  ipAddress: string | null,
): Promise<{ forUsername: number; forIp: number }> {
  const since = new Date(Date.now() - LOGIN_FAILURE_WINDOW_MINUTES * 60_000).toISOString();
  const byUsername = await admin
    .from("security_events")
    .select("id", { count: "exact", head: true })
    .eq("kind", "login_failed")
    .eq("username_sha256", usernameSha256)
    .gte("occurred_at", since);
  if (byUsername.error) throw new Error(`countRecentLoginFailures(username) failed: ${byUsername.error.message}`);
  let forIp = 0;
  if (ipAddress) {
    const byIp = await admin
      .from("security_events")
      .select("id", { count: "exact", head: true })
      .eq("kind", "login_failed")
      .eq("ip_address", ipAddress)
      .gte("occurred_at", since);
    if (byIp.error) throw new Error(`countRecentLoginFailures(ip) failed: ${byIp.error.message}`);
    forIp = byIp.count ?? 0;
  }
  return { forUsername: byUsername.count ?? 0, forIp };
}

/** Append a security event (append-only table, migration 003). */
export async function insertSecurityEvent(
  admin: SupabaseClient,
  event: { kind: "login_failed" | "login_locked"; usernameSha256: string; userId?: string; ipAddress: string | null; details?: Record<string, string> },
): Promise<void> {
  const { error } = await admin.from("security_events").insert({
    kind: event.kind,
    username_sha256: event.usernameSha256,
    user_id: event.userId ?? null,
    ip_address: event.ipAddress,
    details: event.details ?? {},
  });
  if (error) throw new Error(`insertSecurityEvent failed: ${error.message}`);
}

/** Append an audit record (append-only table, migration 003). */
export async function insertAuditLog(
  admin: SupabaseClient,
  entry: { actorUserId: string; action: string; entityType: string; entityId?: string; ipAddress: string | null; details?: Record<string, string> },
): Promise<void> {
  const { error } = await admin.from("audit_logs").insert({
    actor_user_id: entry.actorUserId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    ip_address: entry.ipAddress,
    details: entry.details ?? {},
  });
  if (error) throw new Error(`insertAuditLog failed: ${error.message}`);
}
