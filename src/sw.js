// Service worker. Caches the public app shell only. It never caches auth, Supabase or API
// traffic, and never caches map tiles (OSM tile policy), so private data is not stored.
const VERSION = '__BUILD__';
const CACHE = `atlas-shell-${VERSION}`;
const SHELL = __PRECACHE__;

self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('atlas-shell-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;       // ignore tiles, CDNs, Supabase
  if (url.pathname.startsWith('/.netlify/') || url.pathname.startsWith('/api/')) return;
  if (/^\/(account|admin|login|reset-password|profile|dashboard)\//.test(url.pathname)) return;   // never cache account or admin pages
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return r; })
      .catch(() => caches.match(req).then(r => r || caches.match('/offline/'))));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; })));
});
self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('push', e => {
  let d = {}; try { d = e.data.json(); } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Ilẹ̀ Abínibí Atlas', { body: d.body || '', icon: '/assets/icons/icon-192.png', badge: '/assets/icons/favicon.png', data: { url: d.url || '/account/#notifications' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close(); const url = (e.notification.data && e.notification.data.url) || '/account/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => { const c = cs.find(x => x.url.includes(self.location.origin)); return c ? (c.navigate(url), c.focus()) : self.clients.openWindow(url); }));
});
