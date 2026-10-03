import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RegistryFunctionError } from "@/features/canon/repository";
import type { Subject } from "@/features/knowledge/types";
import type { AppNotification } from "./types";

/**
 * In-app notifications (migration 019, A-3). Reads use the caller's client: RLS returns only the caller's own rows.
 * Marking as read goes through notifications_mark_read with the service-role client after the action has
 * authenticated the caller; the function only touches the caller's rows.
 */

type Row = { id: string; kind: AppNotification["kind"]; entity_id: string | null; payload: { subject_id?: string }; created_at: string; read_at: string | null };

/** The caller's newest notifications, unread first. */
export async function listNotifications(client: SupabaseClient, subjects: readonly Subject[], limit: number): Promise<AppNotification[]> {
  const { data, error } = await client
    .from("notifications")
    .select("id, kind, entity_id, payload, created_at, read_at")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<Row[]>();
  if (error) throw new Error(`listNotifications failed: ${error.message}`);
  return (data ?? [])
    .map((row) => ({
      id: row.id,
      kind: row.kind,
      examId: row.entity_id,
      subjectCode: subjects.find((subject) => subject.id === row.payload?.subject_id)?.code ?? null,
      createdAt: row.created_at,
      read: row.read_at !== null,
    }))
    .sort((a, b) => Number(a.read) - Number(b.read));
}

/**
 * notifications_mark_read: marks the caller's notifications as read.
 * @throws RegistryFunctionError with the database's machine message
 */
export async function markNotificationsRead(admin: SupabaseClient, actorUserId: string, ids: readonly string[]): Promise<number> {
  const { data, error } = await admin.rpc("notifications_mark_read", { p_actor: actorUserId, p_ids: ids });
  if (error) throw new RegistryFunctionError(error.message);
  return Number(data ?? 0);
}
