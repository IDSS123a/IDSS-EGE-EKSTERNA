import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RegistryFunctionError } from "@/features/canon/repository";
import type { GiftCode } from "./catalogue";
import type { Gift } from "./types";

/**
 * Special gifts (migration 032, PDL-039, A-3). Service-role client after the page or action has authorised the caller;
 * the database re-checks the giver (subject teacher), the student's ownership and the reader's rights.
 */

async function call<T>(admin: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new RegistryFunctionError(error.message);
  return data as T;
}

type Row = { id: string; code: GiftCode; message: string; giver: string; created_at: string; opened_at: string | null; own?: boolean };
const toGift = (row: Row): Gift => ({ id: row.id, code: row.code, message: row.message, giver: row.giver, createdAt: row.created_at, openedAt: row.opened_at, own: row.own });

export async function giveGift(admin: SupabaseClient, input: { actorUserId: string; personId: string; code: GiftCode; message: string; ipAddress: string | null }): Promise<string> {
  return call<string>(admin, "gift_give", { p_actor: input.actorUserId, p_person: input.personId, p_code: input.code, p_message: input.message, p_ip: input.ipAddress });
}

export async function studentGifts(admin: SupabaseClient, actorUserId: string): Promise<Gift[]> {
  return (await call<Row[]>(admin, "student_gifts", { p_actor: actorUserId })).map(toGift);
}

export async function openGift(admin: SupabaseClient, actorUserId: string, giftId: string): Promise<void> {
  await call<null>(admin, "gift_open", { p_actor: actorUserId, p_gift: giftId });
}

export async function giftsOfPerson(admin: SupabaseClient, actorUserId: string, personId: string): Promise<Gift[]> {
  return (await call<Row[]>(admin, "gifts_of_person", { p_actor: actorUserId, p_person: personId })).map(toGift);
}
