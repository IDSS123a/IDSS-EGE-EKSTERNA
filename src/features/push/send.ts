import "server-only";
import webpush from "web-push";
import { ASSIGNMENTS_PUSH_URL, VITRINA_PATH } from "@/constants";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError } from "@/lib/logger";

/**
 * Web Push (PDL-037): the browser standard, sent through each browser's own push service, end-to-end encrypted, no
 * provider account and no cost. The keys (VAPID) live only in the environment; without them push is simply off and the
 * in-app notification still arrives. Notices carry no personal data: a fixed sentence and the assignment's title.
 */

type Target = { endpoint: string; p256dh: string; auth: string; title?: string; subject?: string };

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

type Subscription = { endpoint: string; p256dh: string; auth: string };

/** Sends one notice to the given browsers; forgets browsers the push service reports gone. */
async function send(targets: Subscription[], message: { body: string; url: string; tag: string }): Promise<number> {
  const admin = createSupabaseAdminClient();
  let sent = 0;
  await Promise.all(
    targets.map(async (target) => {
      const payload = JSON.stringify({ title: "IDSS - External Graduate Examination", ...message });
      try {
        await webpush.sendNotification({ endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } }, payload, { TTL: 60 * 60 * 24 * 3, urgency: "normal" });
        sent += 1;
      } catch (failure) {
        const status = (failure as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await admin.rpc("push_forget", { p_endpoint: target.endpoint });
        else logError("push/send", failure);
      }
    }),
  );
  return sent;
}

async function targets(fn: string, args: Record<string, unknown>): Promise<Target[]> {
  const { data, error } = await createSupabaseAdminClient().rpc(fn, args);
  if (error) throw new Error(`${fn} failed: ${error.message}`);
  return (data ?? []) as Target[];
}

/** "New assignment" notice to every subscribed browser of the recipients (PDL-035). */
export async function notifyAssignment(assignmentId: string): Promise<number> {
  if (!pushConfigured()) return 0;
  const list = await targets("push_targets_of_assignment", { p_assignment: assignmentId });
  return send(list, { body: `Novi zadatak nastavnika: ${list[0]?.title ?? ""}`.trim(), url: ASSIGNMENTS_PUSH_URL, tag: `assignment-${assignmentId}` });
}

/** "Special gift" notice to the student's subscribed browsers (PDL-039); the message itself is never sent. */
export async function notifyGift(giftId: string): Promise<number> {
  if (!pushConfigured()) return 0;
  const list = await targets("push_targets_of_gift", { p_gift: giftId });
  return send(list, { body: "Imaš poseban poklon od nastavnika. Otvori ga u svojoj vitrini.", url: VITRINA_PATH, tag: `gift-${giftId}` });
}
