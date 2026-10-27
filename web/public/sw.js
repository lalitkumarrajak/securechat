// Service worker: offline app shell and push notifications.
const CACHE = 'chattrix-v3'; // bump when the shell files change
const SHELL = ['/', '/theme-boot.js', '/logo-mark.png', '/icon-192.png', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// The app opens from the copy saved on the device straight away, and fetches the latest copy in the
// background for next time. Waiting for the network first made phones sit on a blank screen while a
// sleeping server (free hosting) woke up. Hashed /assets and emoji animations never change, so
// they're cache-first; an old saved page still finds the old assets it names.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname === '/ws') return;
  const immutable = url.pathname.startsWith('/assets/') || url.pathname.startsWith('/emoji/');
  const page = e.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html';
  const key = page ? '/' : url.pathname;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(key);
    if (immutable && hit) return hit;
    const fresh = fetch(e.request).then((res) => {
      if (res.ok && (!page || res.headers.get('content-type')?.includes('text/html'))) cache.put(key, res.clone());
      return res;
    });
    if (hit) {
      e.waitUntil(fresh.then(() => {}, () => {}));
      return hit;
    }
    try { return await fresh; } catch { return Response.error(); }
  }));
});

// Push payloads carry only who it's from, never message content (that stays end-to-end encrypted).
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data.json(); } catch {}
  const name = d.name || d.from || 'Someone';
  const title = d.t === 'fr' ? 'New friend request' : d.t === 'signin' ? 'New sign-in to your account' : d.t === 'gmsg' ? (d.group || 'Group') : name;
  const body = d.t === 'fr' ? `${name} wants to be your friend`
    : d.t === 'game' ? `invited you to play ${d.game || 'a game'} 🎲`
    : d.t === 'gmention' ? `mentioned you in ${d.game || 'a game'}`
    : d.t === 'gmsg' ? `${name}${d.mention ? ' mentioned you' : ': New message'}`
    : d.t === 'signin' ? `A device signed in${d.where || ''}. If this wasn’t you, open Chattrix → Settings → Active sessions.`
    : d.t === 'call' ? `Incoming ${d.v ? 'video' : 'voice'} call`
    : d.t === 'missed' ? `Missed ${d.v ? 'video' : 'voice'} call`
    : d.t === 'stag' ? 'tagged you in their story'
    : d.t === 'scmt' ? 'commented on your story'
    : 'New message';
  const call = d.t === 'call' || d.t === 'missed';
  e.waitUntil((async () => {
    // Don't notify if the app is open and visible: the page shows the message itself.
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (wins.some((w) => w.visibilityState === 'visible')) return;
    await self.registration.showNotification(title, {
      body, icon: '/icon-192.png', badge: '/icon-192.png',
      // A missed call replaces its "incoming call" notification.
      tag: (call ? 'call' : d.t || 'msg') + '-' + (d.peer || d.from || ''), renotify: true,
      ...(d.t === 'call' && { requireInteraction: true, vibrate: [400, 200, 400, 200, 400] }),
      data: { peer: d.t === 'msg' || call ? d.from : d.t === 'gmsg' ? d.peer : null, stories: d.t === 'stag' || d.t === 'scmt' },
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
