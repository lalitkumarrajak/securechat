// Service worker: offline app shell and push notifications.
const CACHE = 'chattrix-v4'; // bumping it empties the saved copy: the next start waits for the network // bump when the shell files change
const SHELL = ['/', '/theme-boot.js', '/logo.svg', '/logo-mark.png', '/icon-192.png', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== LANG_CACHE).map((k) => caches.delete(k))))
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
  const immutable = url.pathname.startsWith('/assets/') || url.pathname.startsWith('/emoji/') || /^\/apps\/[^/]+\/assets\//.test(url.pathname);
  // The other apps (/apps/<name>/): the list of apps and each app's entry file must be current, or
  // an old entry would ask for files a new version no longer has. Network first, saved copy offline.
  const current = url.pathname === '/apps.json' || url.pathname.endsWith('/remoteEntry.js') || /^\/apps\/[^/]+\/?(index\.html)?$/.test(url.pathname);
  const page = !current && (e.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html');
  const key = page ? '/' : url.pathname;
  if (current) {
    e.respondWith(caches.open(CACHE).then(async (cache) => {
      try {
        const res = await fetch(e.request);
        if (res.ok) cache.put(key, res.clone());
        return res;
      } catch { return (await cache.match(key)) || Response.error(); }
    }));
    return;
  }
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(key);
    if (immutable && hit) return hit;
    const fresh = fetch(e.request).then((res) => {
      if (res.ok && (!page || res.headers.get('content-type')?.includes('text/html'))) cache.put(key, res.clone());
      return res;
    });
    if (hit) {
      const saved = page ? hit.clone() : null;
      e.waitUntil(fresh.then((res) => saved && res.ok && newer(saved, res.clone()), () => {}));
      return hit;
    }
    try { return await fresh; } catch { return Response.error(); }
  }));
});

// The page just opened from the saved copy, and the server has a newer Sanga: tell the open windows,
// which switch to it (main.tsx). The page names its build's script, so comparing that is enough.
// A page that opened just now may not be listening yet, so each page also says which build it is
// when it starts, and hears back if a newer one has come in.
const build = (html) => html.match(/\/assets\/index-[\w-]+\.js/)?.[0] || '';
let latest = '';
async function newer(saved, res) {
  const [a, b] = await Promise.all([saved.text(), res.text()]);
  if (!build(b)) return;
  latest = build(b);
  if (build(a) === latest) return;
  for (const w of await self.clients.matchAll({ type: 'window' })) w.postMessage({ t: 'update', build: latest });
}
self.addEventListener('message', (e) => {
  if (e.data?.t === 'lang') { e.waitUntil?.(saveLang(e.data.lang)); return; }
  if (e.data?.t === 'build' && latest && e.data.build && e.data.build !== latest) e.source?.postMessage({ t: 'update', build: latest });
});

// ---------- language ----------
// Notifications are worded here, so they follow the language picked in Settings. The page can't share
// its localStorage with the worker: it posts the language (lib/swLang.ts) and the worker keeps it in a
// small cache of its own, which survives restarts. The Hindi is written next to the English below.
const LANG_CACHE = 'sanga-lang';
let lang = null;
async function saveLang(l) {
  lang = l === 'hi' ? 'hi' : 'en';
  try { await (await caches.open(LANG_CACHE)).put('/lang', new Response(lang)); } catch { /* kept for now only */ }
}
async function currentLang() {
  if (lang) return lang;
  try { lang = (await (await (await caches.open(LANG_CACHE)).match('/lang'))?.text()) === 'hi' ? 'hi' : 'en'; } catch { lang = 'en'; }
  return lang;
}

// Push payloads carry only who it's from, never message content (that stays end-to-end encrypted).
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data.json(); } catch {}
  if (d.t === 'remind') { e.waitUntil(remind(d)); return; }
  const call = d.t === 'call' || d.t === 'missed';
  e.waitUntil((async () => {
    const hi = (await currentLang()) === 'hi';
    const name = d.name || d.from || (hi ? 'कोई' : 'Someone');
    const game = d.game || (hi ? 'एक गेम' : 'a game');
    const near = (d.where || '').replace(/^ near /, ''); // the server sends " near Delhi, India"
    const title = d.t === 'fr' ? (hi ? 'दोस्ती की नई रिक्वेस्ट' : 'New friend request')
      : d.t === 'signin' ? (hi ? 'आपके अकाउंट में नया साइन-इन' : 'New sign-in to your account')
      : d.t === 'gmsg' ? (d.group || (hi ? 'ग्रुप' : 'Group')) : name;
    const body = hi ? (d.t === 'fr' ? `${name} आपसे दोस्ती करना चाहते हैं`
      : d.t === 'game' ? `ने आपको ${game} खेलने बुलाया है 🎲`
      : d.t === 'gmention' ? `ने ${game} में आपका ज़िक्र किया`
      : d.t === 'gmsg' ? (d.mention ? `${name} ने आपका ज़िक्र किया` : `${name}: नया मैसेज`)
      : d.t === 'signin' ? `${near ? near + ' के पास ' : ''}एक डिवाइस ने साइन इन किया। अगर यह आप नहीं थे, तो Sanga → सेटिंग्स → चालू सेशन खोलें।`
      : d.t === 'call' ? (d.v ? 'वीडियो कॉल आ रही है' : 'वॉइस कॉल आ रही है')
      : d.t === 'missed' ? (d.v ? 'मिस्ड वीडियो कॉल' : 'मिस्ड वॉइस कॉल')
      : d.t === 'stag' ? 'ने आपको अपनी स्टोरी में टैग किया'
      : d.t === 'scmt' ? 'ने आपकी स्टोरी पर कमेंट किया'
      : 'नया मैसेज')
      : d.t === 'fr' ? `${name} wants to be your friend`
      : d.t === 'game' ? `invited you to play ${game} 🎲`
      : d.t === 'gmention' ? `mentioned you in ${game}`
      : d.t === 'gmsg' ? `${name}${d.mention ? ' mentioned you' : ': New message'}`
      : d.t === 'signin' ? `A device signed in${d.where || ''}. If this wasn’t you, open Sanga → Settings → Active sessions.`
      : d.t === 'call' ? `Incoming ${d.v ? 'video' : 'voice'} call`
      : d.t === 'missed' ? `Missed ${d.v ? 'video' : 'voice'} call`
      : d.t === 'stag' ? 'tagged you in their story'
      : d.t === 'scmt' ? 'commented on your story'
      : 'New message';
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
  const calendar = e.notification.data?.calendar;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const win = wins[0];
    if (win) {
      await win.focus();
      if (peer) win.postMessage({ t: 'open', peer });
      if (calendar) win.postMessage({ t: 'open', section: 'calendar' });
    } else {
      await self.clients.openWindow(peer ? '/?chat=' + encodeURIComponent(peer) : calendar ? '/#calendar' : '/');
    }
  })());
});

// ---------- reminders ----------
// A calendar reminder: the push carries its title sealed with a key only this account's devices can
// derive (crypto.reminderKey: ECDH of the identity key with itself, then HKDF). This derives it from
// the identity key the app keeps on the device, unseals the title and shows it. Can't (signed out,
// another account): a plain "Reminder".
const te = new TextEncoder();
function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('chattrix');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function session() {
  const d = await idb();
  try {
    if (!d.objectStoreNames.contains('kv')) return null;
    return await new Promise((resolve, reject) => {
      const r = d.transaction('kv').objectStore('kv').get('session');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  } finally { d.close(); }
}
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function unseal(id, b) {
  const s = await session();
  if (!s?.priv || !s.pub || !s.u) return null;
  const EC = { name: 'ECDH', namedCurve: 'P-256' };
  const pub = await crypto.subtle.importKey('raw', unb64(s.pub), EC, false, []);
  const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: pub }, s.priv, 256);
  const hk = await crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: te.encode('securechat/remind') },
    hk, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const data = unb64(b);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: data.subarray(0, 12), additionalData: te.encode(`remind|${s.u}|${id}`) }, key, data.subarray(12));
  return JSON.parse(new TextDecoder().decode(plain));
}
async function remind(d) {
  const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (wins.some((w) => w.visibilityState === 'visible')) return; // the open app shows it
  let r = null;
  try { r = await unseal(String(d.id), String(d.b)); } catch { /* shown plain */ }
  const hi = (await currentLang()) === 'hi';
  await self.registration.showNotification(r?.title || (hi ? 'रिमाइंडर' : 'Reminder'), {
    body: r?.body || (hi ? 'देखने के लिए Sanga खोलें' : 'Open Sanga to see it'), icon: '/icon-192.png', badge: '/icon-192.png',
    tag: 'remind-' + d.id, renotify: true, data: { calendar: true },
  });
}
