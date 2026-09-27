import { createHash } from "node:crypto";
import {
  LOGIN_MAX_FAILURES_PER_IP,
  LOGIN_MAX_FAILURES_PER_USERNAME,
  STUDENT_AUTH_EMAIL_DOMAIN,
} from "@/constants";
import type { AccountStatus } from "./types";

/**
 * Authentication business rules (framework-free, M-5).
 */

/**
 * Map a login username to the Supabase Auth e-mail identity (PDL-003).
 * Staff usernames are their official e-mail; student usernames get a reserved,
 * non-routable domain so no personal e-mail is required (AMB-06).
 * @param username normalised (trimmed, lower-case) username
 * @returns the e-mail used by Supabase Auth
 */
export function usernameToAuthEmail(username: string): string {
  return username.includes("@") ? username : `${username}@${STUDENT_AUTH_EMAIL_DOMAIN}`;
}

/**
 * Only active accounts may sign in; every other lifecycle state is refused with the same
 * message as a wrong password, so account state cannot be probed (E-4 uniform answers).
 * @param status account status from the database
 */
export function canSignIn(status: AccountStatus | null): boolean {
  return status === "active";
}

/**
 * Brute-force / credential-stuffing guard (mandate §7A.5).
 * @param failuresForUsername failed attempts for this username inside the window
 * @param failuresForIp failed attempts from this IP inside the window
 * @returns true when another attempt must be refused without contacting Supabase Auth
 */
export function isLoginLocked(failuresForUsername: number, failuresForIp: number): boolean {
  return failuresForUsername >= LOGIN_MAX_FAILURES_PER_USERNAME || failuresForIp >= LOGIN_MAX_FAILURES_PER_IP;
}

/**
 * SHA-256 of the attempted username. Security events store the hash, never the raw guess,
 * so the log does not become a list of mistyped passwords or other people's names (E-8).
 */
export function hashUsername(username: string): string {
  return createHash("sha256").update(username).digest("hex");
}

/**
 * Extract a client IP from proxy headers, accepting only syntactically valid IPv4/IPv6.
 * @param forwardedFor value of x-forwarded-for
 * @returns the first IP or null
 */
export function clientIpFrom(forwardedFor: string | null): string | null {
  const candidate = forwardedFor?.split(",")[0]?.trim() ?? "";
  const ipv4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
  const ipv6 = /^[0-9a-f:]+$/i;
  return ipv4.test(candidate) || (candidate.includes(":") && ipv6.test(candidate)) ? candidate : null;
}
