/* IDSS - External Graduate Examination: service worker for Web Push only (PDL-037). No caching, no tracking. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

/** A path inside this app, or "/app": "//host" and absolute addresses never leave the origin. */
function sameOriginPath(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/app";
  try {
    const url = new URL(value, self.location.origin);
    return url.origin === self.location.origin ? url.pathname + url.search + url.hash : "/app";
  } catch {
    return "/app";
  }
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === "string" ? data.title : "IDSS - External Graduate Examination";
  const options = {
    body: typeof data.body === "string" ? data.body : "",
    icon: "/brand/idss-push-icon.png",
    badge: "/brand/idss-push-icon.png",
    tag: typeof data.tag === "string" ? data.tag : undefined,
    data: { url: sameOriginPath(data.url) },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(sameOriginPath(event.notification.data && event.notification.data.url), self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
