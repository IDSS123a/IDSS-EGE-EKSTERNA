import type { AccountStatus } from "@/features/authentication/types";

/**
 * Account lifecycle rules (mandate §7A.4), framework-free.
 */

/** Supabase Auth ban length used for every non-active state (effectively permanent until lifted). */
export const AUTH_BAN_DURATION = "876000h";

/**
 * Defence in depth: non-active accounts are also banned at the Auth provider, so no new
 * session can be issued even outside this app. Active accounts are unbanned.
 * @returns the Supabase `ban_duration` value for the target status
 */
export function authBanFor(status: AccountStatus): string {
  return status === "active" ? "none" : AUTH_BAN_DURATION;
}

/**
 * Students get a longitudinal person record at creation (§7A.4) so their learning history
 * survives account archival and school-year changes.
 */
export function needsPersonRecord(role: "administrator" | "student"): boolean {
  return role === "student";
}
