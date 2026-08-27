/* Khawaja Club — Web Push service worker v2 */

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let data = {
        title: 'Khawaja Club',
        body: 'You have a new update from Khawaja Club.',
        url: '/',
        tag: `khawaja-${Date.now()}`,
      };

      try {
        if (event.data) {
          const parsed = event.data.json();
          data = {
            ...data,
            ...parsed,
            tag: parsed.tag ? `${parsed.tag}-${Date.now()}` : data.tag,
          };
        }
      } catch {
        /* use defaults */
      }

      await self.registration.showNotification(data.title, {
        body: data.body || data.title,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: data.tag,
        data: { url: data.url || '/' },
        renotify: true,
        vibrate: [300, 100, 300, 100, 300],
        silent: false,
        requireInteraction: true,
      });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const rawUrl = event.notification.data?.url || '/';
  const targetUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          void client.focus();
          if ('navigate' in client && typeof client.navigate === 'function') {
            return client.navigate(targetUrl);
          }
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    }),
  );
});

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
