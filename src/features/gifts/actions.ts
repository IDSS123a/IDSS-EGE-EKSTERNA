"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { SUPPORT_PATH, VITRINA_PATH } from "@/constants";
import { auditIfFailed, formId } from "@/features/audit/failures";
import { clientIpFrom } from "@/features/authentication/domain";
import { getCurrentAccount } from "@/features/authentication/session";
import { RegistryFunctionError } from "@/features/canon/repository";
import { notifyGift } from "@/features/push/send";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError } from "@/lib/logger";
import { canGiveGifts, canPractise } from "@/lib/permissions";
import { GiftSchema } from "@/lib/validation/schemas";
import { giveGift, openGift } from "./repository";
import type { GiftActionResult, GiftErrorCode } from "./types";

const KNOWN: GiftErrorCode[] = ["FORBIDDEN", "VALIDATION", "NOT_FOUND"];
const codeOf = (error: unknown): GiftErrorCode =>
  error instanceof RegistryFunctionError ? (KNOWN.find((known) => known === error.databaseMessage) ?? "UNAVAILABLE") : "UNAVAILABLE";

/**
 * POST (Server Action) giveGiftAction
 * Role required: subject teacher (G1); the database re-checks it (migration 032, PDL-039).
 * Body: FormData { personId, code (one of six), message (1 to 200) }. No limit (G3), no IDSS points (G4).
 * Errors: UNAUTHENTICATED, FORBIDDEN, VALIDATION, NOT_FOUND, UNAVAILABLE.
 */
export async function giveGiftAction(_previous: GiftActionResult | null, formData: FormData): Promise<GiftActionResult> {
  const result = await give(formData);
  return auditIfFailed(result, { action: "gift.give", entityType: "persons", entityId: formId(formData, "personId") });
}

async function give(formData: FormData): Promise<GiftActionResult> {
  const actor = await getCurrentAccount();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  if (!canGiveGifts(actor)) return { success: false, code: "FORBIDDEN" };
  const parsed = GiftSchema.safeParse({ personId: formData.get("personId"), code: formData.get("code"), message: formData.get("message") });
  if (!parsed.success) return { success: false, code: "VALIDATION" };
  let id: string;
  try {
    id = await giveGift(createSupabaseAdminClient(), { actorUserId: actor.userId, ...parsed.data, ipAddress: clientIpFrom((await headers()).get("x-forwarded-for")) });
  } catch (error) {
    const code = codeOf(error);
    if (code === "UNAVAILABLE") logError("gifts/actions.giveGiftAction", error);
    return { success: false, code };
  }
  await notifyGift(id).catch((error: unknown) => logError("gifts/actions.notifyGift", error));
  revalidatePath(`${SUPPORT_PATH}/${parsed.data.personId}`);
  return { success: true, data: { id } };
}

/**
 * POST (Server Action) openGiftAction
 * Role required: the student who received the gift (practice.participate; the database checks ownership).
 * Records the first opening after the unboxing. Errors: UNAUTHENTICATED, FORBIDDEN, VALIDATION, NOT_FOUND, UNAVAILABLE.
 */
export async function openGiftAction(giftId: unknown): Promise<GiftActionResult> {
  const actor = await getCurrentAccount();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  if (!canPractise(actor)) return { success: false, code: "FORBIDDEN" };
  if (typeof giftId !== "string" || !/^[0-9a-f-]{36}$/i.test(giftId)) return { success: false, code: "VALIDATION" };
  try {
    await openGift(createSupabaseAdminClient(), actor.userId, giftId);
  } catch (error) {
    const code = codeOf(error);
    if (code === "UNAVAILABLE") logError("gifts/actions.openGiftAction", error);
    return { success: false, code };
  }
  revalidatePath(VITRINA_PATH);
  return { success: true, data: { id: giftId } };
}
