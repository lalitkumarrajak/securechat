// Service worker: offline app shell and push notifications.
const CACHE = 'chattrix-v4'; // bumping it empties the saved copy: the next start waits for the network // bump when the shell files change
const SHELL = ['/', '/theme-boot.js', '/logo.svg', '/logo-mark.png', '/icon-192.png', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== LANG_CACHE && k !== SHARE_CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// The app opens from the copy saved on the device straight away, and fetches the latest copy in the
// background for next time. Waiting for the network first made phones sit on a blank screen while a
// sleeping server (free hosting) woke up. Hashed /assets and emoji animations never change, so
// they're cache-first; an old saved page still finds the old assets it names.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method === 'POST' && url.origin === location.origin && url.pathname === '/share') { e.respondWith(receiveShare(e.request)); return; }
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

// Share → Sanga (manifest share_target): a statement PDF or a bank SMS from another app. Kept for the
// moment it takes Sanga to open, in a cache of its own; Accounts reads it once and deletes it.
const SHARE_CACHE = 'sanga-share';
async function receiveShare(req) {
  try {
    const form = await req.formData();
    const file = form.getAll('file').find((f) => f && typeof f !== 'string');
    const text = ['title', 'text', 'url'].map((k) => form.get(k)).filter((x) => typeof x === 'string' && x.trim()).join('\n');
    await caches.delete(SHARE_CACHE);
    const c = await caches.open(SHARE_CACHE);
    if (file) await c.put('/share/file', new Response(file));
    await c.put('/share/meta', new Response(JSON.stringify({ name: file?.name || '', type: file?.type || '', text })));
  } catch { /* nothing usable was shared: Sanga opens all the same */ }
  return Response.redirect('/?share=1', 303);
}

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
// small cache of its own, which survives restarts. Each text is written below in English, Hindi and Marathi.
const LANG_CACHE = 'sanga-lang';
const LANGS = ['en', 'hi', 'mr'];
let lang = null;
async function saveLang(l) {
  lang = LANGS.includes(l) ? l : 'en';
  try { await (await caches.open(LANG_CACHE)).put('/lang', new Response(lang)); } catch { /* kept for now only */ }
}
async function currentLang() {
  if (lang) return lang;
  try { const l = await (await (await caches.open(LANG_CACHE)).match('/lang'))?.text(); lang = LANGS.includes(l) ? l : 'en'; } catch { lang = 'en'; }
  return lang;
}
/** The text in the language now on: w('Reminder', 'रिमाइंडर', 'रिमाइंडर'). */
async function words() {
  const l = await currentLang();
  return (en, hi, mr) => (l === 'hi' ? hi : l === 'mr' ? mr : en);
}

// Push payloads carry only who it's from, never message content (that stays end-to-end encrypted).
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data.json(); } catch {}
  if (d.t === 'remind') { e.waitUntil(remind(d)); return; }
  const call = d.t === 'call' || d.t === 'missed';
  e.waitUntil((async () => {
    const w = await words();
    const name = d.name || d.from || w('Someone', 'कोई', 'कोणीतरी');
    const game = d.game || w('a game', 'एक गेम', 'एक गेम');
    const near = (d.where || '').replace(/^ near /, ''); // the server sends " near Delhi, India"
    const title = d.t === 'fr' ? w('New friend request', 'दोस्ती की नई रिक्वेस्ट', 'नवीन मैत्री विनंती')
      : d.t === 'signin' ? w('New sign-in to your account', 'आपके अकाउंट में नया साइन-इन', 'तुमच्या अकाउंटमध्ये नवीन साइन-इन')
      : d.t === 'gmsg' ? (d.group || w('Group', 'ग्रुप', 'ग्रुप')) : name;
    const body = d.t === 'fr' ? w(`${name} wants to be your friend`, `${name} आपसे दोस्ती करना चाहते हैं`, `${name} तुमच्याशी मैत्री करू इच्छितात`)
      : d.t === 'game' ? w(`invited you to play ${game} 🎲`, `ने आपको ${game} खेलने बुलाया है 🎲`, `यांनी तुम्हाला ${game} खेळायला बोलावले आहे 🎲`)
      : d.t === 'gmention' ? w(`mentioned you in ${game}`, `ने ${game} में आपका ज़िक्र किया`, `यांनी ${game} मध्ये तुमचा उल्लेख केला`)
      : d.t === 'gmsg' ? (d.mention ? w(`${name} mentioned you`, `${name} ने आपका ज़िक्र किया`, `${name} यांनी तुमचा उल्लेख केला`) : `${name}: ${w('New message', 'नया मैसेज', 'नवीन मेसेज')}`)
      : d.t === 'signin' ? w(`A device signed in${d.where || ''}. If this wasn’t you, open Sanga → Settings → Active sessions.`,
        `${near ? near + ' के पास ' : ''}एक डिवाइस ने साइन इन किया। अगर यह आप नहीं थे, तो Sanga → सेटिंग्स → चालू सेशन खोलें।`,
        `${near ? near + ' जवळ ' : ''}एका डिव्हाइसने साइन इन केले. हे तुम्ही नसाल, तर Sanga → सेटिंग्ज → चालू सेशन उघडा.`)
      : d.t === 'call' ? (d.v ? w('Incoming video call', 'वीडियो कॉल आ रही है', 'व्हिडिओ कॉल येत आहे') : w('Incoming voice call', 'वॉइस कॉल आ रही है', 'व्हॉइस कॉल येत आहे'))
      : d.t === 'missed' ? (d.v ? w('Missed video call', 'मिस्ड वीडियो कॉल', 'मिस्ड व्हिडिओ कॉल') : w('Missed voice call', 'मिस्ड वॉइस कॉल', 'मिस्ड व्हॉइस कॉल'))
      : d.t === 'stag' ? w('tagged you in their story', 'ने आपको अपनी स्टोरी में टैग किया', 'यांनी तुम्हाला त्यांच्या स्टोरीत टॅग केले')
      : d.t === 'scmt' ? w('commented on your story', 'ने आपकी स्टोरी पर कमेंट किया', 'यांनी तुमच्या स्टोरीवर कमेंट केली')
      : w('New message', 'नया मैसेज', 'नवीन मेसेज');
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
  const w = await words();
  await self.registration.showNotification(r?.title || w('Reminder', 'रिमाइंडर', 'रिमाइंडर'), {
    body: r?.body || w('Open Sanga to see it', 'देखने के लिए Sanga खोलें', 'पाहण्यासाठी Sanga उघडा'), icon: '/icon-192.png', badge: '/icon-192.png',
    tag: 'remind-' + d.id, renotify: true, data: { calendar: true },
  });
}
