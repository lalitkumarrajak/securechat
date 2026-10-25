// Service worker: offline app shell and push notifications.
const CACHE = 'chattrix-v1';
const SHELL = ['/', '/theme-boot.js', '/icon.svg', '/icon-192.png', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// The page is network-first (so a new version shows up right away), falling back to the cache
// offline. Hashed /assets and emoji animations never change, so they're cache-first.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname === '/ws') return;
  const immutable = url.pathname.startsWith('/assets/') || url.pathname.startsWith('/emoji/');
  const key = url.pathname === '/index.html' ? '/' : url.pathname;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    if (immutable) {
      const hit = await cache.match(key);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok) cache.put(key, res.clone());
      return res;
    }
    try {
      const res = await fetch(e.request);
      if (res.ok) cache.put(key, res.clone());
      return res;
    } catch {
      return (await cache.match(key)) || Response.error();
    }
  }));
});

// Push payloads carry only who it's from, never message content (that stays end-to-end encrypted).
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data.json(); } catch {}
  const name = d.name || d.from || 'Someone';
  const title = d.t === 'fr' ? 'New friend request' : name;
  const body = d.t === 'fr' ? `${name} wants to be your friend` : 'New message';
  e.waitUntil((async () => {
    // Don't notify if the app is open and visible: the page shows the message itself.
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (wins.some((w) => w.visibilityState === 'visible')) return;
    await self.registration.showNotification(title, {
      body, icon: '/icon-192.png', badge: '/icon-192.png',
      tag: (d.t || 'msg') + '-' + (d.from || ''), renotify: true, data: { peer: d.t === 'msg' ? d.from : null },
    });
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const peer = e.notification.data?.peer;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const win = wins[0];
    if (win) {
      await win.focus();
      if (peer) win.postMessage({ t: 'open', peer });
    } else {
      await self.clients.openWindow(peer ? '/?chat=' + encodeURIComponent(peer) : '/');
    }
  })());
});
