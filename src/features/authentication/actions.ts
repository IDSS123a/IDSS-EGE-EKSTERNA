"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APP_HOME_PATH, LOGIN_PATH } from "@/constants";
import { ConfigurationError } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { logError, logInfo } from "@/lib/logger";
import { LoginSchema } from "@/lib/validation/schemas";
import { canSignIn, clientIpFrom, hashUsername, isLoginLocked, usernameToAuthEmail } from "./domain";
import { countRecentLoginFailures, findProfileByUserId, insertAuditLog, insertSecurityEvent } from "./repository";
import type { LoginResult } from "./types";

/**
 * POST (Server Action) loginAction
 * Role required: none (public) — rate limited per username and per IP.
 * Body: FormData { username, password } validated by LoginSchema.
 * Response: redirect to /app on success; otherwise { success: false, code } where code is
 *   VALIDATION | INVALID_CREDENTIALS | LOCKED | UNAVAILABLE.
 * Unknown user, wrong password and inactive account all return INVALID_CREDENTIALS
 * (no account enumeration, E-4). Every failure is a security event; every success is audited.
 */
export async function loginAction(_previous: LoginResult | null, formData: FormData): Promise<LoginResult> {
  const parsed = LoginSchema.safeParse({ username: formData.get("username"), password: formData.get("password") });
  if (!parsed.success) {
    const typed = formData.get("username");
    return { success: false, code: "VALIDATION", username: typeof typed === "string" ? typed.slice(0, 120) : undefined };
  }
  const { username, password } = parsed.data;
  const usernameSha256 = hashUsername(username);
  const ipAddress = clientIpFrom((await headers()).get("x-forwarded-for"));

  try {
    const admin = createSupabaseAdminClient();
    const failures = await countRecentLoginFailures(admin, usernameSha256, ipAddress);
    if (isLoginLocked(failures.forUsername, failures.forIp)) {
      await insertSecurityEvent(admin, { kind: "login_locked", usernameSha256, ipAddress });
      return { success: false, code: "LOCKED", username };
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email: usernameToAuthEmail(username), password });
    const account = !error && data.user ? await findProfileByUserId(supabase, data.user.id) : null;
    if (!data.user || !account || !canSignIn(account.status)) {
      if (data.user) await supabase.auth.signOut();
      await insertSecurityEvent(admin, {
        kind: "login_failed",
        usernameSha256,
        userId: data.user?.id,
        ipAddress,
        details: { reason: error ? "credentials" : account ? `status_${account.status}` : "no_profile" },
      });
      return { success: false, code: "INVALID_CREDENTIALS", username };
    }

    await insertAuditLog(admin, { actorUserId: account.userId, action: "auth.login", entityType: "profile", entityId: account.userId, ipAddress });
    logInfo("authentication/actions.loginAction", "login succeeded", { role: account.role });
  } catch (error) {
    logError("authentication/actions.loginAction", error, { configuration: error instanceof ConfigurationError });
    return { success: false, code: "UNAVAILABLE", username };
  }
  // redirect() throws by design, so it stays outside try/catch.
  redirect(APP_HOME_PATH);
}

/**
 * POST (Server Action) logoutAction
 * Role required: any signed-in account. Ends the Supabase session, audits it, returns to login.
 */
export async function logoutAction(): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    await supabase.auth.signOut();
    if (data.user) {
      const ipAddress = clientIpFrom((await headers()).get("x-forwarded-for"));
      await insertAuditLog(createSupabaseAdminClient(), { actorUserId: data.user.id, action: "auth.logout", entityType: "profile", entityId: data.user.id, ipAddress });
    }
  } catch (error) {
    logError("authentication/actions.logoutAction", error);
  }
  redirect(LOGIN_PATH);
}
