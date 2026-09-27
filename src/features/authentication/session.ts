import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { LOGIN_PATH } from "@/constants";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { logError } from "@/lib/logger";
import { canSignIn } from "./domain";
import { findProfileByUserId } from "./repository";
import type { CurrentAccount } from "./types";

/**
 * Data Access Layer: the signed-in, ACTIVE account for this request, or null.
 * `auth.getUser()` verifies the token with Supabase Auth — never trust a decoded cookie
 * (E-4 named pitfall). Role and status come from the database on every request.
 * Memoised per render pass with React `cache`.
 */
export const getCurrentAccount = cache(async (): Promise<CurrentAccount | null> => {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    const account = await findProfileByUserId(supabase, data.user.id);
    return account && canSignIn(account.status) ? account : null;
  } catch (error) {
    logError("authentication/session.getCurrentAccount", error);
    return null;
  }
});

/**
 * Require an active account or redirect to the login page. Use at the top of every
 * protected page and Server Action (proxy.ts redirects are only an optimistic pre-filter).
 */
export async function requireAccount(): Promise<CurrentAccount> {
  const account = await getCurrentAccount();
  if (!account) redirect(LOGIN_PATH);
  return account;
}
