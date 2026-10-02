// public/sw.js — Skynet Nexus service worker (edition drop alerts).
// v1: push notifications only. No caching — the site already serves
// no-cache headers for HTML/JS/CSS/JSON.

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { /* plain text */ }
  const title = data.title || '🛰️ Skynet Nexus';
  const options = {
    body: data.body || 'New stories are live.',
    icon: '/assets/img/logo.svg',
    badge: '/assets/img/logo.svg',
    tag: data.tag || 'skynet-edition',
    renotify: true,
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (new URL(w.url).origin === self.location.origin) {
          w.navigate(url);
          return w.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

// Activate immediately on update so new push handling takes effect.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
