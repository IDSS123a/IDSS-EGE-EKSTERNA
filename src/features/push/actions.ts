"use server";

import { getCurrentAccount } from "@/features/authentication/session";
import { RegistryFunctionError } from "@/features/canon/repository";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError } from "@/lib/logger";
import { PushSubscriptionSchema } from "@/lib/validation/schemas";

export type PushActionResult = { success: true } | { success: false; code: "UNAUTHENTICATED" | "VALIDATION" | "FORBIDDEN" | "UNAVAILABLE" };

/**
 * POST (Server Action) savePushSubscriptionAction
 * Role required: any active account (its own browser only). Body: { endpoint, p256dh, auth, userAgent }.
 * Stores the browser's push subscription (migration 031, PDL-037). Errors: UNAUTHENTICATED, VALIDATION, FORBIDDEN, UNAVAILABLE.
 */
export async function savePushSubscriptionAction(input: unknown): Promise<PushActionResult> {
  const actor = await getCurrentAccount();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  const parsed = PushSubscriptionSchema.safeParse(input);
  if (!parsed.success) return { success: false, code: "VALIDATION" };
  try {
    const { error } = await createSupabaseAdminClient().rpc("push_subscribe", { p_actor: actor.userId, p_endpoint: parsed.data.endpoint, p_p256dh: parsed.data.p256dh, p_auth: parsed.data.auth, p_user_agent: parsed.data.userAgent });
    if (error) throw new RegistryFunctionError(error.message);
  } catch (error) {
    if (error instanceof RegistryFunctionError && (error.databaseMessage === "FORBIDDEN" || error.databaseMessage === "VALIDATION")) return { success: false, code: error.databaseMessage };
    logError("push/actions.savePushSubscriptionAction", error);
    return { success: false, code: "UNAVAILABLE" };
  }
  return { success: true };
}

/**
 * POST (Server Action) removePushSubscriptionAction
 * Role required: any account (removes only its own row for this browser). Body: { endpoint }.
 */
export async function removePushSubscriptionAction(endpoint: unknown): Promise<PushActionResult> {
  const actor = await getCurrentAccount();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://") || endpoint.length > 1000) return { success: false, code: "VALIDATION" };
  const { error } = await createSupabaseAdminClient().rpc("push_unsubscribe", { p_actor: actor.userId, p_endpoint: endpoint });
  if (error) {
    logError("push/actions.removePushSubscriptionAction", error);
    return { success: false, code: "UNAVAILABLE" };
  }
  return { success: true };
}
