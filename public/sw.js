// Grind District service worker: shows message alerts (Web Push) and opens the game on tap. No caching.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('push', (e) => {
  let d = {}
  try { d = e.data ? e.data.json() : {} } catch { d = { body: e.data ? e.data.text() : '' } }
  e.waitUntil(self.registration.showNotification(d.title || 'Grind District', {
    body: d.body || '', icon: '/icons/icon-192.png', badge: '/icons/icon-96.png', tag: d.tag || 'gd', renotify: true, data: { url: d.url || '/' },
  }))
})
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || '/'
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) if ('focus' in c) { c.postMessage({ type: 'gd-open', url }); return c.focus() }
    return self.clients.openWindow(url)
  }))
})
