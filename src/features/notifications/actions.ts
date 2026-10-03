"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { APP_HOME_PATH, GRADING_PATH } from "@/constants";
import { getCurrentAccount } from "@/features/authentication/session";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError } from "@/lib/logger";
import { markNotificationsRead } from "./repository";

const IdsSchema = z.array(z.uuid()).min(1).max(200);

/**
 * POST (Server Action) markNotificationsReadAction
 * Role required: any active account (own notifications only; the database function filters by the caller).
 * Body: { ids: uuid[] }. Response: { success: true } or { success: false, code }.
 * Errors: UNAUTHENTICATED, VALIDATION, UNAVAILABLE.
 */
export async function markNotificationsReadAction(ids: string[]): Promise<{ success: true } | { success: false; code: "UNAUTHENTICATED" | "VALIDATION" | "UNAVAILABLE" }> {
  const actor = await getCurrentAccount();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  const parsed = IdsSchema.safeParse(ids);
  if (!parsed.success) return { success: false, code: "VALIDATION" };
  try {
    await markNotificationsRead(createSupabaseAdminClient(), actor.userId, parsed.data);
  } catch (error) {
    logError("notifications/actions.markNotificationsReadAction", error);
    return { success: false, code: "UNAVAILABLE" };
  }
  revalidatePath(APP_HOME_PATH);
  revalidatePath(GRADING_PATH);
  return { success: true };
}
