import "server-only";
import webpush from "web-push";
import { ASSIGNMENTS_PUSH_URL } from "@/constants";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError } from "@/lib/logger";

/**
 * Web Push (PDL-037): the browser standard, sent through each browser's own push service, end-to-end encrypted, no
 * provider account and no cost. The keys (VAPID) live only in the environment; without them push is simply off and the
 * in-app notification still arrives. Notices carry no personal data: a fixed sentence and the assignment's title.
 */

type Target = { endpoint: string; p256dh: string; auth: string; title: string; subject: string };

let configured: boolean | null = null;

/** True when the three VAPID settings are present; configures the library once. */
export function pushConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  configured = Boolean(publicKey && privateKey && subject);
  if (configured) webpush.setVapidDetails(subject as string, publicKey as string, privateKey as string);
  return configured;
}

/** Sends the "new assignment" notice to every subscribed browser of the recipients; forgets browsers that are gone. */
export async function notifyAssignment(assignmentId: string): Promise<number> {
  if (!pushConfigured()) return 0;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("push_targets_of_assignment", { p_assignment: assignmentId });
  if (error) throw new Error(`push_targets_of_assignment failed: ${error.message}`);
  const targets = (data ?? []) as Target[];
  let sent = 0;
  await Promise.all(
    targets.map(async (target) => {
      const payload = JSON.stringify({ title: "IDSS - External Graduate Examination", body: `Novi zadatak nastavnika: ${target.title}`, url: ASSIGNMENTS_PUSH_URL, tag: `assignment-${assignmentId}` });
      try {
        await webpush.sendNotification({ endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } }, payload, { TTL: 60 * 60 * 24 * 3, urgency: "normal" });
        sent += 1;
      } catch (failure) {
        const status = (failure as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await admin.rpc("push_forget", { p_endpoint: target.endpoint });
        else logError("push/send.notifyAssignment", failure);
      }
    }),
  );
  return sent;
}
