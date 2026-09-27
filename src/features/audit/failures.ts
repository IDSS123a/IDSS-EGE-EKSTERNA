import "server-only";
import { headers } from "next/headers";
import { clientIpFrom } from "@/features/authentication/domain";
import { insertAuditLog } from "@/features/authentication/repository";
import { getCurrentAccount } from "@/features/authentication/session";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError } from "@/lib/logger";

/**
 * Audit rows for FAILED write attempts (Commander DONE checklist: every write-operation error is
 * logged to the audit log; Sprint 01 carry-over). Successful writes are audited by the action
 * itself. Unauthenticated attempts have no actor and are left to the server log.
 * Never throws: an audit failure must not change the answer the user gets.
 */
export async function auditIfFailed<T extends { success: true } | { success: false; code: string }>(
  result: T,
  entry: { action: string; entityType: string; entityId?: string | null },
): Promise<T> {
  if (result.success || result.code === "UNAUTHENTICATED") return result;
  try {
    const actor = await getCurrentAccount();
    if (!actor) return result;
    await insertAuditLog(createSupabaseAdminClient(), {
      actorUserId: actor.userId,
      action: `${entry.action}_failed`,
      entityType: entry.entityType,
      entityId: entry.entityId ?? undefined,
      ipAddress: clientIpFrom((await headers()).get("x-forwarded-for")),
      details: { code: result.code },
    });
  } catch (error) {
    logError("audit/failures.auditIfFailed", error, { action: entry.action });
  }
  return result;
}

/** A FormData field as a string id for the audit row, or null. */
export function formId(formData: FormData, field: string): string | null {
  const value = formData.get(field);
  return typeof value === "string" && value.length > 0 && value.length <= 64 ? value : null;
}
