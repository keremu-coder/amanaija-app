// AmaNaija service worker: alerts, and a friendly screen when there is no network.
const OFFLINE = "/offline.html";
self.addEventListener("install", (e) => { e.waitUntil(caches.open("ama-offline-v1").then((c) => c.add(OFFLINE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return;
  e.respondWith(fetch(e.request).catch(() => caches.match(OFFLINE)));
});
self.addEventListener("push", (e) => {
  e.waitUntil(self.registration.showNotification("AmaNaija", { body: "You have a new message", icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", tag: "ama-msg" }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => { for (const c of cs) { if ("focus" in c) return c.focus(); } return self.clients.openWindow("/"); }));
});
