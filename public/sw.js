// Grind District service worker: shows phone notifications (Web Push) and opens the game on tap. No caching.
// A notification carries Zahra's portrait (icon), the white shrimp for the status bar (badge), and for reminders
// and updates a big picture (Zahra beside the message, drawn by /api/og?kind=note) with Open / Later keys.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('push', (e) => {
  let d = {}
  try { d = e.data ? e.data.json() : {} } catch { d = { body: e.data ? e.data.text() : '' } }
  const options = {
    body: d.body || '',
    icon: d.icon || '/notify/zahra-icon.png',
    badge: '/icons/badge-96.png',
    tag: d.tag || 'gd',
    renotify: true,
    timestamp: Date.now(),
    vibrate: [80, 40, 80],
    data: { url: d.url || '/' },
    actions: [{ action: 'open', title: d.cta || 'Open' }, { action: 'later', title: 'Later' }],
  }
  if (d.image) options.image = d.image
  e.waitUntil(self.registration.showNotification(d.title || 'Grind District', options))
})
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  if (e.action === 'later') return
  const url = (e.notification.data && e.notification.data.url) || '/'
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) if ('focus' in c) { c.postMessage({ type: 'gd-open', url }); return c.focus() }
    return self.clients.openWindow(url)
  }))
})
