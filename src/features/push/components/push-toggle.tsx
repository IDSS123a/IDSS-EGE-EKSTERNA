"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useI18n } from "@/features/localization/i18n-provider";
import { removePushSubscriptionAction, savePushSubscriptionAction } from "../actions";

type State = "checking" | "unsupported" | "ios-install" | "denied" | "off" | "on" | "working" | "error";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function keyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

/**
 * "Obavijesti na ovom uređaju" (PDL-037): Web Push is switched on per browser by the user; nothing happens without
 * the user's click. On iPhone it works only after "Dodaj na početni ekran" (iOS 16.4 or later).
 */
export function PushToggle(): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.push;
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    let cancelled = false;
    const settle = (next: State) => {
      if (!cancelled) setState(next);
    };
    (async () => {
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return settle(ios && !standalone ? "ios-install" : "unsupported");
      if (Notification.permission === "denied") return settle("denied");
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      settle(subscription ? "on" : "off");
    })().catch(() => settle("unsupported"));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!PUBLIC_KEY || state === "checking") return null;

  const turnOn = async () => {
    setState("working");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "denied" : "off");
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const subscription = (await registration.pushManager.getSubscription()) ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUBLIC_KEY) }));
      const json = subscription.toJSON();
      const result = await savePushSubscriptionAction({ endpoint: subscription.endpoint, p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "", userAgent: navigator.userAgent.slice(0, 300) });
      setState(result.success ? "on" : "error");
    } catch {
      setState("error");
    }
  };

  const turnOff = async () => {
    setState("working");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await removePushSubscriptionAction(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setState("off");
    } catch {
      setState("error");
    }
  };

  return (
    <div className="push-toggle no-print">
      <p className="form__hint">{labels.states[state === "working" ? "off" : state]}</p>
      {(state === "off" || state === "error") && <button type="button" className="button-secondary" onClick={turnOn}>{labels.turnOn}</button>}
      {state === "on" && <button type="button" className="button-secondary" onClick={turnOff}>{labels.turnOff}</button>}
      {state === "working" && <button type="button" className="button-secondary" disabled>{labels.working}</button>}
    </div>
  );
}
