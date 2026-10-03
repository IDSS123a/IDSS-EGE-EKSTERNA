"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { SUPPORT_PATH } from "@/constants";
import { auditIfFailed, formId } from "@/features/audit/failures";
import { clientIpFrom } from "@/features/authentication/domain";
import { getCurrentAccount } from "@/features/authentication/session";
import { RegistryFunctionError } from "@/features/canon/repository";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError } from "@/lib/logger";
import { canWriteSupportNotes } from "@/lib/permissions";
import { SupportNoteSchema } from "@/lib/validation/schemas";
import { addNote } from "./repository";
import type { SupportActionResult, SupportErrorCode } from "./types";

const KNOWN: SupportErrorCode[] = ["FORBIDDEN", "VALIDATION", "NOT_FOUND"];

/**
 * POST (Server Action) addSupportNoteAction
 * Role required: support_notes.read_write (pedagogue, psychologist; not the superadministrator, D2).
 * Body: FormData { personId, kind?, body, followUpOn?, visibility: author|support }.
 * Notes are append-only; the audit row records the note's id and visibility, never its content (M-15).
 * Errors: UNAUTHENTICATED, FORBIDDEN, VALIDATION, NOT_FOUND, UNAVAILABLE.
 */
export async function addSupportNoteAction(_previous: SupportActionResult | null, formData: FormData): Promise<SupportActionResult> {
  const result = await add(formData);
  return auditIfFailed(result, { action: "support.note_add", entityType: "persons", entityId: formId(formData, "personId") });
}

async function add(formData: FormData): Promise<SupportActionResult> {
  const actor = await getCurrentAccount();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  if (!canWriteSupportNotes(actor)) return { success: false, code: "FORBIDDEN" };
  const parsed = SupportNoteSchema.safeParse({
    personId: formData.get("personId"),
    kind: formData.get("kind") ?? "",
    body: formData.get("body"),
    followUpOn: formData.get("followUpOn") ?? "",
    visibility: formData.get("visibility"),
  });
  if (!parsed.success) return { success: false, code: "VALIDATION" };
  try {
    await addNote(createSupabaseAdminClient(), { actorUserId: actor.userId, ...parsed.data, ipAddress: clientIpFrom((await headers()).get("x-forwarded-for")) });
  } catch (error) {
    const code = error instanceof RegistryFunctionError ? (KNOWN.find((known) => known === error.databaseMessage) ?? "UNAVAILABLE") : "UNAVAILABLE";
    if (code === "UNAVAILABLE") logError("support/actions.addSupportNoteAction", error);
    return { success: false, code };
  }
  revalidatePath(`${SUPPORT_PATH}/${parsed.data.personId}`);
  revalidatePath(SUPPORT_PATH);
  return { success: true, data: { message: "NOTE_ADDED" } };
}
