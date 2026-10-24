import * as C from './crypto.js';
import * as db from './store.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

const S = {
  me: null, token: null, priv: null, pub: null,
  ws: null, ready: false, synced: false, lastSeq: 0,
  backoff: 1000, reconnectTimer: 0, pingTimer: 0, pongTimer: 0,
  active: null,          // username of the open chat
  convKeys: new Map(),   // peer -> AES key
  inflight: new Set(),   // cids sent on this connection, awaiting ack
  presence: new Map(),   // peer -> {on, ls}
  typing: new Map(),     // peer -> timeout
  rendered: new Map(),   // msg key -> element (active chat only)
  rcpt: { 1: new Set(), 2: new Set() }, rcptTimer: 0,
  lastTypingSent: 0,
};

// ---------- boot / auth ----------
async function boot() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  const sess = await db.get('kv', 'session');
  if (!sess) return showAuth();
  Object.assign(S, { me: sess.u, token: sess.token, priv: sess.priv, pub: sess.pub });
  S.lastSeq = (await db.get('kv', 'lastSeq')) || 0;
  showApp();
  connect();
}

function showAuth() {
  $('app').hidden = true;
  $('auth').hidden = false;
  $('auth-user').focus();
}

let authMode = 'login';
function setAuthMode(mode) {
  authMode = mode;
  const reg = mode === 'register';
  for (const t of document.querySelectorAll('.tab')) {
    const on = t.dataset.tab === mode;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', on);
  }
  $('auth-pass2-wrap').hidden = !reg;
  $('auth-pass2').required = reg;
  $('auth-pass').autocomplete = reg ? 'new-password' : 'current-password';
  $('auth-submit').textContent = reg ? 'Create account' : 'Sign in';
  $('auth-msg').textContent = '';
}
for (const t of document.querySelectorAll('.tab')) t.addEventListener('click', () => setAuthMode(t.dataset.tab));

$('auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const mode = authMode;
  const u = $('auth-user').value.trim().toLowerCase();
  const pw = $('auth-pass').value;
  const msg = $('auth-msg');
  if (mode === 'register') {
    if (pw.length < 8) { msg.textContent = 'Use at least 8 characters.'; return; }
    if (pw !== $('auth-pass2').value) { msg.textContent = 'Passwords do not match.'; return; }
  }
  const buttons = $('auth-form').querySelectorAll('button');
  buttons.forEach((b) => (b.disabled = true));
  msg.textContent = 'Securing your keys…';
  try {
    const { auth, wrapKey } = await C.deriveFromPassword(u, pw);
    let token, priv, pub;
    if (mode === 'register') {
      const id = await C.generateIdentity(wrapKey);
      ({ token } = await api('/api/register', { u, auth, pub: id.pub, encPriv: id.encPriv }));
      ({ priv, pub } = id);
    } else {
      const res = await api('/api/login', { u, auth });
      token = res.token;
      pub = res.pub;
      priv = await C.unwrapIdentity(res.encPriv, wrapKey);
    }
    const prev = await db.get('kv', 'session-user');
    if (prev && prev !== u) await db.clearAll();
    await db.put('kv', u, 'session-user');
    await db.put('kv', { u, token, priv, pub }, 'session');
    $('auth-pass').value = '';
    $('auth-pass2').value = '';
    msg.textContent = '';
    $('auth').hidden = true;
    await boot();
  } catch (err) {
    msg.textContent = err.message || 'Something went wrong';
  } finally {
    buttons.forEach((b) => (b.disabled = false));
  }
});

async function api(path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (S.token) headers.Authorization = 'Bearer ' + S.token;
  let res;
  try {
    res = await fetch(path, body ? { method: 'POST', headers, body: JSON.stringify(body) } : { headers });
  } catch {
    throw new Error('No connection. Check your internet and try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && S.token) { logout(); throw new Error('Session expired'); }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function logout() {
  if (S.token) api('/api/logout', {}).catch(() => {});
  S.token = null;
  clearTimeout(S.reconnectTimer);
  if (S.ws) { S.ws.onclose = null; S.ws.close(); }
  await db.clearAll();
  location.reload();
}
$('logout-btn').addEventListener('click', () => { if (confirm('Sign out? Messages stored on this device will be removed.')) logout(); });

// ---------- connection ----------
function setConn(state) {
  const c = $('conn');
  const text = { offline: 'Waiting for network…', connecting: 'Connecting…' }[state];
  c.hidden = !text;
  c.textContent = text || '';
}

function connect() {
  clearTimeout(S.reconnectTimer);
  if (!S.token) return;
  if (!navigator.onLine) return setConn('offline');
  if (S.ws && S.ws.readyState <= 1) return;
  setConn('connecting');
  const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
  S.ws = ws;
  ws.onopen = () => ws.send(JSON.stringify({ t: 'auth', token: S.token }));
  ws.onmessage = (e) => {
    resetPong();
    let m;
    try { m = JSON.parse(e.data); } catch { return; }
    handle(m).catch((err) => console.error(err));
  };
  ws.onclose = (e) => {
    if (S.ws !== ws) return;
    S.ready = false;
    S.synced = false;
    S.inflight.clear();
    clearInterval(S.pingTimer);
    clearTimeout(S.pongTimer);
    if (e.code === 4001) return logout();
    setConn(navigator.onLine ? 'connecting' : 'offline');
    // Exponential backoff with jitter so thousands of clients don't reconnect in lockstep.
    S.reconnectTimer = setTimeout(connect, S.backoff * (0.5 + Math.random()));
    S.backoff = Math.min(S.backoff * 2, 30000);
  };
}

// App-level heartbeat: notices a dead mobile connection in ~35s instead of minutes.
function resetPong() {
  clearTimeout(S.pongTimer);
  S.pongTimer = setTimeout(() => S.ws?.close(), 35000);
}

function wsSend(obj) {
  if (S.ws?.readyState === 1) { S.ws.send(JSON.stringify(obj)); return true; }
  return false;
}

window.addEventListener('online', () => { S.backoff = 1000; connect(); });
window.addEventListener('offline', () => setConn('offline'));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    S.backoff = 1000;
    connect();
    if (S.active) markRead(S.active);
  }
});

async function handle(m) {
  switch (m.t) {
    case 'ok':
      S.ready = true;
      S.backoff = 1000;
      setConn('online');
      clearInterval(S.pingTimer);
      S.pingTimer = setInterval(() => wsSend({ t: 'p' }), 25000);
      wsSend({ t: 'sync', after: S.lastSeq });
      if (S.active) wsSend({ t: 'watch', u: S.active });
      flushOutbox();
      break;
    case 'batch': {
      for (const row of m.msgs) await ingest(row, true);
      if (m.msgs.length) await saveSeq(m.msgs[m.msgs.length - 1].seq, true);
      if (m.more) { wsSend({ t: 'sync', after: S.lastSeq }); break; }
      S.synced = true;
      await renderChatList();
      if (S.active) { await renderConversation(); markRead(S.active); }
      break;
    }
    case 'm':
      await ingest(m, false);
      await saveSeq(m.seq);
      break;
    case 'ack': {
      S.inflight.delete(m.cid);
      await db.del('outbox', m.cid);
      const k = S.me + '/' + m.cid;
      const msg = await db.get('msgs', k);
      if (msg) {
        Object.assign(msg, { id: m.id, s: Math.max(msg.s, m.s) });
        await db.put('msgs', msg);
        updateTicks(msg);
      }
      await saveSeq(m.seq);
      break;
    }
    case 'st':
      for (const it of m.items) {
        const msg = await db.getByIndex('msgs', 'id', it.id);
        if (msg && it.s > msg.s) {
          msg.s = it.s;
          await db.put('msgs', msg);
          updateTicks(msg);
        }
      }
      await saveSeq(Math.max(...m.items.map((i) => i.seq)));
      break;
    case 'typ':
      showTyping(m.f);
      break;
    case 'pres':
      S.presence.set(m.u, { on: m.on, ls: m.ls });
      if (m.u === S.active) renderPeerStatus();
      break;
    case 'err':
      if (m.cid) {
        S.inflight.delete(m.cid);
        await db.del('outbox', m.cid);
        const msg = await db.get('msgs', S.me + '/' + m.cid);
        if (msg) { msg.s = -2; await db.put('msgs', msg); updateTicks(msg); }
      }
      console.warn('server:', m.e);
      break;
  }
}

// Only advance the sync cursor from live events once the initial sync finished,
// otherwise a live event could skip us past rows we haven't fetched yet.
async function saveSeq(seq, fromSync = false) {
  if (!(fromSync || S.synced) || !(seq > S.lastSeq)) return;
  S.lastSeq = seq;
  await db.put('kv', seq, 'lastSeq');
}

// ---------- peers & keys ----------
async function getPeer(u, refresh = false) {
  let p = await db.get('peers', u);
  if (!p || refresh) {
    try {
      const res = await api('/api/key?u=' + encodeURIComponent(u));
      if (!p) p = { u, pub: res.pub };
      else if (res.pub !== p.pub) { p.newPub = res.pub; p.changed = true; } // keep the pinned key until the user accepts
      else { delete p.newPub; p.changed = false; }
      await db.put('peers', p);
    } catch (err) {
      if (!p) throw err;
    }
  }
  return p;
}

async function convKey(peer) {
  if (!S.convKeys.has(peer)) {
    const p = await getPeer(peer);
    S.convKeys.set(peer, await C.conversationKey(S.priv, p.pub, S.me, peer));
  }
  return S.convKeys.get(peer);
}

// ---------- messages ----------
async function ingest(row, fromSync) {
  const out = row.f === S.me;
  const peer = out ? row.to : row.f;
  const k = row.f + '/' + row.cid;
  const existing = await db.get('msgs', k);
  if (existing) {
    if (row.s > existing.s || existing.id == null) {
      Object.assign(existing, { id: row.id, s: Math.max(existing.s, row.s) });
      await db.put('msgs', existing);
      updateTicks(existing);
    }
    return;
  }

  let content;
  try {
    content = await C.decryptMessage(await convKey(peer), row.b, row.f, row.to, row.cid);
  } catch {
    content = { type: 'err' };
  }
  const viewing = S.active === peer && document.visibilityState === 'visible';
  const msg = { k, cid: row.cid, id: row.id, peer, out, ts: row.ts, s: !out && viewing ? 2 : row.s, ...pick(content) };
  await db.put('msgs', msg);

  const chat = (await db.get('chats', peer)) || { peer, unread: 0, ts: 0 };
  if (msg.ts >= chat.ts) Object.assign(chat, { ts: msg.ts, last: preview(msg), lastOut: out });
  if (!out && row.s < 2 && !viewing) chat.unread++;
  await db.put('chats', chat);

  if (!out && row.s < 2) queueReceipt(row.id, viewing ? 2 : 1);
  if (!out) clearTyping(peer);
  if (fromSync) return; // UI is refreshed once the batch is done

  if (S.active === peer) appendMessage(msg);
  renderChatList();
  if (!out && document.visibilityState !== 'visible') notify(peer, msg);
}

function pick(c) {
  if (c.type === 'text' && typeof c.text === 'string') return { type: 'text', text: c.text };
  if (c.type === 'img' && typeof c.src === 'string' && c.src.startsWith('data:image/')) {
    return { type: 'img', src: c.src, w: c.w | 0, h: c.h | 0, text: typeof c.text === 'string' ? c.text : '' };
  }
  return { type: 'err' };
}

const preview = (m) => (m.type === 'img' ? '📷 Photo' : m.type === 'err' ? '🔒 Unable to decrypt' : m.text.slice(0, 80));

function queueReceipt(id, s) {
  S.rcpt[s].add(id);
  if (s === 2) S.rcpt[1].delete(id);
  clearTimeout(S.rcptTimer);
  S.rcptTimer = setTimeout(flushReceipts, 300); // batch receipts into one small frame
}

function flushReceipts() {
  for (const s of [1, 2]) {
    if (!S.rcpt[s].size) continue;
    if (wsSend({ t: 'rcpt', ids: [...S.rcpt[s]], s })) S.rcpt[s].clear();
  }
}

async function markRead(peer) {
  if (document.visibilityState !== 'visible') return;
  const msgs = await db.recentMessages(peer, 500);
  for (const m of msgs) {
    if (!m.out && m.s < 2 && m.id != null) {
      m.s = 2;
      await db.put('msgs', m);
      queueReceipt(m.id, 2);
    }
  }
  const chat = await db.get('chats', peer);
  if (chat?.unread) { chat.unread = 0; await db.put('chats', chat); renderChatList(); }
}

async function sendMessage(peer, content) {
  const p = await getPeer(peer);
  if (p.changed) { showKeyWarning(true); return; }
  const cid = C.randomId();
  const ts = Date.now();
  const b = await C.encryptMessage(await convKey(peer), content, S.me, peer, cid);
  const msg = { k: S.me + '/' + cid, cid, peer, out: true, ts, s: -1, ...pick(content) };
  await db.put('msgs', msg);
  await db.put('outbox', { cid, to: peer, b, ts });
  const chat = (await db.get('chats', peer)) || { peer, unread: 0 };
  Object.assign(chat, { ts, last: preview(msg), lastOut: true });
  await db.put('chats', chat);
  appendMessage(msg);
  renderChatList();
  flushOutbox();
}

async function flushOutbox() {
  if (!S.ready) return;
  const items = (await db.all('outbox')).sort((a, b) => a.ts - b.ts);
  for (const o of items) {
    if (S.inflight.has(o.cid)) continue;
    if (!wsSend({ t: 'msg', cid: o.cid, to: o.to, b: o.b })) break;
    S.inflight.add(o.cid);
  }
}

// ---------- UI: chat list ----------
function avatar(node, name) {
  node.textContent = name[0]?.toUpperCase() || '?';
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  node.style.background = `hsl(${h % 360} 45% 45%)`;
}

function fmtTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString();
}

let chatListPending = false;
async function renderChatList() {
  if (chatListPending) return;
  chatListPending = true;
  await new Promise((r) => setTimeout(r, 16)); // coalesce bursts (rAF would stall in background tabs)
  chatListPending = false;
  const chats = (await db.all('chats')).sort((a, b) => b.ts - a.ts);
  const list = $('chat-list');
  list.replaceChildren(...chats.map(chatItem));
  $('empty-chats').hidden = chats.length > 0;
}

function chatItem(c) {
  const li = el('li', 'item' + (c.peer === S.active ? ' active' : ''));
  const av = el('div', 'avatar');
  avatar(av, c.peer);
  const body = el('div', 'item-body');
  const top = el('div', 'item-top');
  top.append(el('span', 'item-name', c.peer), el('span', 'item-time' + (c.unread ? ' unread' : ''), c.ts ? fmtTime(c.ts) : ''));
  const bottom = el('div', 'item-bottom');
  bottom.append(el('span', 'item-last', (c.lastOut ? 'You: ' : '') + (c.last || '')));
  if (c.unread) bottom.append(el('span', 'badge', String(c.unread)));
  body.append(top, bottom);
  li.append(av, body);
  li.addEventListener('click', () => openChat(c.peer));
  return li;
}

// User search
let searchTimer = 0;
$('search').addEventListener('input', () => {
  clearTimeout(searchTimer);
  const term = $('search').value.trim().toLowerCase();
  const results = $('search-results');
  if (term.length < 2) { results.hidden = true; $('chat-list').hidden = false; return; }
  searchTimer = setTimeout(async () => {
    try {
      const { users } = await api('/api/users?q=' + encodeURIComponent(term));
      results.replaceChildren(...(users.length ? users.map((u) => {
        const li = el('li', 'item');
        const av = el('div', 'avatar');
        avatar(av, u.u);
        li.append(av, el('div', 'item-body item-name', u.u));
        li.addEventListener('click', async () => {
          if (!(await db.get('peers', u.u))) await db.put('peers', { u: u.u, pub: u.pub });
          $('search').value = '';
          results.hidden = true;
          $('chat-list').hidden = false;
          openChat(u.u);
        });
        return li;
      }) : [el('li', 'empty muted', 'No users found')]));
      results.hidden = false;
      $('chat-list').hidden = true;
    } catch (err) {
      results.replaceChildren(el('li', 'empty muted', err.message));
      results.hidden = false;
    }
  }, 300);
});

// ---------- UI: conversation ----------
async function openChat(peer) {
  S.active = peer;
  document.body.classList.add('in-chat');
  $('no-chat').hidden = true;
  $('chat-view').hidden = false;
  $('peer-name').textContent = peer;
  avatar($('peer-avatar'), peer);
  renderPeerStatus();
  wsSend({ t: 'watch', u: peer });
  if (!(await db.get('chats', peer))) await db.put('chats', { peer, unread: 0, ts: 0, last: '' });
  await renderConversation();
  renderChatList();
  markRead(peer);
  if (matchMedia('(min-width: 800px)').matches) $('input').focus();
  getPeer(peer, true).then((p) => showKeyWarning(!!p.changed)).catch(() => {});
}

$('back-btn').addEventListener('click', () => {
  S.active = null;
  document.body.classList.remove('in-chat');
  $('chat-view').hidden = true;
  $('no-chat').hidden = false;
  renderChatList();
});

async function renderConversation() {
  const peer = S.active;
  const msgs = await db.recentMessages(peer);
  if (peer !== S.active) return;
  const box = $('messages');
  box.replaceChildren();
  S.rendered.clear();
  lastDay = null;
  for (const m of msgs) appendMessage(m, false);
  box.scrollTop = box.scrollHeight;
}

let lastDay = null;
function appendMessage(m, scroll = true) {
  if (m.peer !== S.active) return;
  const box = $('messages');
  const prev = S.rendered.get(m.k);
  const node = messageNode(m);
  if (prev) { prev.replaceWith(node); S.rendered.set(m.k, node); return; }
  const day = new Date(m.ts).toDateString();
  if (day !== lastDay) {
    lastDay = day;
    box.append(el('div', 'day', fmtTime(m.ts).includes(':') ? 'Today' : fmtTime(m.ts)));
  }
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 150;
  box.append(node);
  S.rendered.set(m.k, node);
  if (scroll && (nearBottom || m.out)) box.scrollTop = box.scrollHeight;
}

function messageNode(m) {
  const wrap = el('div', 'msg ' + (m.out ? 'out' : 'in'));
  const bubble = el('div', 'bubble');
  if (m.type === 'img') {
    const img = el('img', 'photo');
    img.src = m.src;
    img.alt = 'Photo';
    img.loading = 'lazy';
    if (m.w && m.h) { img.width = m.w; img.height = m.h; }
    img.addEventListener('click', () => { $('image-full').src = m.src; $('image-dialog').showModal(); });
    bubble.append(img);
    if (m.text) bubble.append(el('div', 'text', m.text));
  } else if (m.type === 'err') {
    bubble.append(el('div', 'text muted', '🔒 This message could not be decrypted'));
  } else {
    bubble.append(el('div', 'text', m.text));
  }
  const meta = el('span', 'meta');
  meta.append(el('span', 'time', new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })));
  if (m.out) meta.append(ticks(m.s));
  bubble.append(meta);
  wrap.append(bubble);
  return wrap;
}

function ticks(s) {
  const span = el('span', 'ticks');
  const map = { '-2': ['!', 'failed', 'Not sent'], '-1': ['🕓', 'pending', 'Sending'], 0: ['✓', '', 'Sent'], 1: ['✓✓', '', 'Delivered'], 2: ['✓✓', 'read', 'Read'] };
  const [txt, cls, label] = map[s] || map[0];
  span.textContent = txt;
  if (cls) span.classList.add(cls);
  span.title = label;
  return span;
}

function updateTicks(m) {
  if (m.peer === S.active && S.rendered.has(m.k)) appendMessage(m);
}

function renderPeerStatus() {
  const peer = S.active;
  if (!peer) return;
  const st = $('peer-status');
  if (S.typing.has(peer)) { st.textContent = 'typing…'; st.classList.add('typing'); return; }
  st.classList.remove('typing');
  const p = S.presence.get(peer);
  if (!p) st.textContent = '';
  else if (p.on) st.textContent = 'online';
  else if (p.ls) st.textContent = 'last seen ' + fmtTime(p.ls).toLowerCase().replace(/^(\d)/, 'today at $1');
  else st.textContent = '';
}

function showTyping(peer) {
  clearTimeout(S.typing.get(peer));
  S.typing.set(peer, setTimeout(() => clearTyping(peer), 4000));
  if (peer === S.active) renderPeerStatus();
}
function clearTyping(peer) {
  clearTimeout(S.typing.get(peer));
  S.typing.delete(peer);
  if (peer === S.active) renderPeerStatus();
}

// Composer
const input = $('input');
input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 140) + 'px';
  const now = Date.now();
  if (S.active && input.value && now - S.lastTypingSent > 2500) {
    S.lastTypingSent = now;
    wsSend({ t: 'typ', to: S.active });
  }
});
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !matchMedia('(pointer: coarse)').matches) {
    e.preventDefault();
    $('composer').requestSubmit();
  }
});
$('composer').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || !S.active) return;
  input.value = '';
  input.style.height = 'auto';
  S.lastTypingSent = 0;
  askNotifyPermission();
  sendMessage(S.active, { type: 'text', text });
});

// Photos are downscaled and re-encoded on the device before encryption: a 4 MB camera
// photo typically becomes 100–250 KB, which matters a lot on slow connections.
$('file-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file || !S.active) return;
  try {
    const img = await compressImage(file);
    sendMessage(S.active, { type: 'img', ...img, text: '' });
  } catch {
    alert('Could not read that image.');
  }
});

async function compressImage(file, maxDim = 1280) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  let src;
  for (const q of [0.72, 0.55, 0.4]) {
    src = canvas.toDataURL('image/webp', q);
    if (!src.startsWith('data:image/webp')) src = canvas.toDataURL('image/jpeg', q);
    if (src.length < 1_100_000) break;
  }
  if (src.length > 1_400_000) throw new Error('too large');
  return { src, w, h };
}

// ---------- security code ----------
function showKeyWarning(show) {
  $('key-warning').hidden = !show;
  $('input').disabled = show;
  $('send-btn').disabled = show;
}
$('key-warning-btn').addEventListener('click', () => openVerify());
$('verify-btn').addEventListener('click', () => openVerify());

async function openVerify() {
  const peer = S.active;
  const p = await getPeer(peer);
  $('verify-peer').textContent = peer;
  const renderCode = (node, groups) => node.replaceChildren(...groups.map((g) => el('span', null, g)));
  renderCode($('verify-code'), await C.safetyNumber(S.me, S.pub, peer, p.pub));
  $('verify-changed').hidden = !p.changed;
  if (p.changed) renderCode($('verify-new-code'), await C.safetyNumber(S.me, S.pub, peer, p.newPub));
  $('verify-dialog').showModal();
}

$('accept-key-btn').addEventListener('click', async () => {
  const p = await getPeer(S.active);
  if (!p.newPub) return;
  p.pub = p.newPub;
  delete p.newPub;
  p.changed = false;
  await db.put('peers', p);
  S.convKeys.delete(p.u);
  showKeyWarning(false);
  $('verify-dialog').close();
});

// ---------- notifications ----------
function askNotifyPermission() {
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
}
function notify(peer, msg) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const n = new Notification(peer, { body: preview(msg), icon: '/icon.svg', tag: 'chat-' + peer });
  n.onclick = () => { window.focus(); openChat(peer); n.close(); };
}

// ---------- start ----------
function showApp() {
  $('auth').hidden = true;
  $('app').hidden = false;
  $('me-name').textContent = S.me;
  avatar($('me-avatar'), S.me);
  renderChatList();
}

boot();
