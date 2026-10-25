// The engine: connection, sync, encryption, sending and every message action.
// It writes to the zustand store (state/app.ts); React components only read and call these functions.
import { toast } from 'sonner';
import * as C from './crypto.js';
import * as db from './db';
import { applyEdit, applyPin, applyReact, senderOf } from './controls';
import { compressImage, squarePhoto } from './image';
import type { Chat, Content, Friend, GifItem, LinkPreview, Me, Msg, Request, SearchHit, Session } from './types';
import { prepareFile } from './files';
import type { LocationContent } from './location';
import { getApp, setApp } from '../state/app';
import { setSettings, useSettings } from '../state/settings';

const S = {
  token: null as string | null,
  me: '',
  priv: null as CryptoKey | null,
  pub: '',
  ws: null as WebSocket | null,
  ready: false,
  synced: false,
  lastSeq: 0,
  hiddenTs: 0,
  backoff: 1000,
  reconnectTimer: 0,
  pingTimer: 0,
  pongTimer: 0,
  convKeys: new Map<string, CryptoKey>(),
  inflight: new Set<string>(),
  rcpt: { 1: new Set<number>(), 2: new Set<number>() } as Record<1 | 2, Set<number>>,
  rcptTimer: 0,
  lastTypingSent: 0,
  typingTimers: new Map<string, number>(),
  draftTimers: new Map<string, number>(),
};

const visible = () => document.visibilityState === 'visible';
const CONTROL = new Set(['react', 'edit', 'pin']);

// ---------- HTTP ----------
export async function api<T = any>(path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (S.token) headers.Authorization = 'Bearer ' + S.token;
  let res: Response;
  try {
    res = await fetch(path, body !== undefined ? { method: 'POST', headers, body: JSON.stringify(body) } : { headers });
  } catch {
    throw new Error('No connection. Check your internet and try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && S.token && path !== '/api/password') { sessionExpired(); throw new Error('Session expired'); }
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

// ---------- boot & accounts ----------
export async function boot() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  fetch('/api/config').then((r) => r.json()).then((c) => setApp({ signupOpen: !!c.signup, gifsEnabled: !!c.gifs })).catch(() => {});
  const sess = await db.get('kv', 'session');
  if (!sess) return setApp({ status: 'auth' });
  if (useSettings.getState().signOutOnClose && await tabWasClosed()) {
    await wipe(sess.token);
    return setApp({ status: 'auth' });
  }
  markAlive();
  Object.assign(S, { token: sess.token, me: sess.u, priv: sess.priv, pub: sess.pub });
  S.lastSeq = (await db.get('kv', 'lastSeq')) || 0;
  S.hiddenTs = (await db.get('kv', 'hiddenTs')) || 0;
  const me: Me = (await db.get('kv', 'me')) || { u: sess.u, name: '', about: '', privacy: { lastSeen: true, receipts: true }, mutes: {}, av: 0 };
  const fr = (await db.get('kv', 'friends')) || {};
  setApp({ status: 'app', me, friends: fr.friends || {}, incoming: fr.incoming || [], outgoing: fr.outgoing || [], blocked: fr.blocked || [], chats: sortChats(await db.all('chats')) });
  connect();
  refreshMe().catch(() => {});
  refreshFriends().catch(() => {});
  if (useSettings.getState().push && 'Notification' in window && Notification.permission === 'granted') enablePush(true).catch(() => {});
}

const normalize = (u: string) => u.trim().toLowerCase();

export async function login(username: string, password: string) {
  const u = normalize(username);
  const { auth, wrapKey } = await C.deriveFromPassword(u, password);
  const res = await api('/api/login', { u, auth });
  const priv = await C.unwrapIdentity(res.encPriv, wrapKey);
  await startSession(u, res.token, priv, res.pub);
}

export async function register(username: string, password: string) {
  const u = normalize(username);
  const { auth, wrapKey } = await C.deriveFromPassword(u, password);
  const id = await C.generateIdentity(wrapKey);
  const { token } = await api('/api/register', { u, auth, pub: id.pub, encPriv: id.encPriv });
  await startSession(u, token, id.priv, id.pub);
}

async function startSession(u: string, token: string, priv: CryptoKey, pub: string) {
  const prev = await db.get('kv', 'session-user');
  if (prev && prev !== u) await db.clearAll();
  await db.put('kv', u, 'session-user');
  await db.put('kv', { u, token, priv, pub }, 'session');
  markAlive();
  await boot();
}

export async function logout(everywhere = false) {
  await disablePush().catch(() => {});
  await api(everywhere ? '/api/logout-all' : '/api/logout', {}).catch(() => {});
  teardown();
  await db.clearAll();
  location.reload();
}

// ---------- "sign out when I close the tab" (Settings → Privacy, this device only) ----------
// sessionStorage survives a reload but not closing the tab, so a tab that opens without our
// marker was closed, unless another Chattrix tab is still open (asked over a BroadcastChannel).
// A tab restored after being closed for a while ("reopen closed tab" brings sessionStorage back)
// is caught by the time of the last close. Closing also tells the server to end the sign-in,
// unless a tab with it reconnects within a few seconds (a reload).
const ALIVE = 'chattrix-alive';
const CLOSED_AT = 'chattrix-closed-at';
const RELOAD_MS = 10_000;
const tabs = typeof BroadcastChannel === 'function' ? new BroadcastChannel('chattrix-tabs') : null;
tabs?.addEventListener('message', (e) => { if (e.data === 'ping' && S.token) tabs.postMessage('pong'); });

const ss = {
  get: (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { sessionStorage.setItem(k, v); } catch { /* storage blocked */ } },
  del: (k: string) => { try { sessionStorage.removeItem(k); } catch { /* storage blocked */ } },
};
const markAlive = () => { ss.set(ALIVE, '1'); ss.del(CLOSED_AT); };

async function tabWasClosed() {
  const closedAt = Number(ss.get(CLOSED_AT) || 0);
  if (ss.get(ALIVE) && (!closedAt || Date.now() - closedAt < RELOAD_MS)) return false; // a reload
  if (!tabs) return true;
  return new Promise<boolean>((resolve) => {
    const onMsg = (e: MessageEvent) => { if (e.data === 'pong') { tabs.removeEventListener('message', onMsg); resolve(false); } };
    tabs.addEventListener('message', onMsg);
    tabs.postMessage('ping');
    setTimeout(() => { tabs.removeEventListener('message', onMsg); resolve(true); }, 250);
  });
}

// Sign out and erase everything this device holds, without reloading.
async function wipe(token: string) {
  S.token = token;
  await disablePush().catch(() => {});
  await api('/api/logout', {}).catch(() => {});
  S.token = null;
  await db.clearAll();
  ss.del(ALIVE);
}

window.addEventListener('pagehide', (e) => {
  if (e.persisted || !S.token || !useSettings.getState().signOutOnClose) return;
  ss.set(CLOSED_AT, String(Date.now()));
  navigator.sendBeacon?.('/api/session/closing', JSON.stringify({ token: S.token }));
});

function teardown() {
  S.token = null;
  clearTimeout(S.reconnectTimer);
  if (S.ws) { S.ws.onclose = null; S.ws.close(); }
}

async function sessionExpired() {
  teardown();
  await db.clearAll();
  location.reload();
}

export async function changePassword(current: string, next: string) {
  const me = await api<Me>('/api/me');
  const [old, fresh] = await Promise.all([C.deriveFromPassword(S.me, current), C.deriveFromPassword(S.me, next)]);
  let encPriv: string;
  // If the current password is wrong, its key can't decrypt the backup.
  try { encPriv = await C.rewrapIdentity(me.encPriv!, old.wrapKey, fresh.wrapKey); }
  catch { throw new Error('Current password is wrong'); }
  await api('/api/password', { auth: old.auth, newAuth: fresh.auth, encPriv });
}

// ---------- connection ----------
const setConn = (conn: 'online' | 'connecting' | 'offline') => setApp({ conn });

function connect() {
  clearTimeout(S.reconnectTimer);
  if (!S.token) return;
  if (!navigator.onLine) return setConn('offline');
  if (S.ws && S.ws.readyState <= 1) return;
  setConn('connecting');
  const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
  S.ws = ws;
  ws.onopen = () => ws.send(JSON.stringify({ t: 'auth', token: S.token, act: visible() }));
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
    if (e.code === 4001) { sessionExpired(); return; }
    setConn(navigator.onLine ? 'connecting' : 'offline');
    // Exponential backoff with jitter so many clients don't reconnect in lockstep.
    S.reconnectTimer = window.setTimeout(connect, S.backoff * (0.5 + Math.random()));
    S.backoff = Math.min(S.backoff * 2, 30000);
  };
}

// While visible, a missing heartbeat reply means the connection is dead: reconnect.
function resetPong() {
  clearTimeout(S.pongTimer);
  S.pongTimer = window.setTimeout(() => { if (visible()) S.ws?.close(); }, 50000);
}

function wsSend(obj: unknown) {
  if (S.ws?.readyState === 1) { S.ws.send(JSON.stringify(obj)); return true; }
  return false;
}
export { wsSend as sendFrame };

/** Other modules (games) handle their own frame types; registered by type, e.g. frameHooks.g = fn. */
export const frameHooks: Record<string, (m: any) => void> = {};
export const myName = () => S.me;

// Presence: tell the server when this tab is hidden or closed, so friends don't see you
// "online" after you leave. The server also times out tabs whose heartbeats stop.
window.addEventListener('online', () => { S.backoff = 1000; connect(); });
window.addEventListener('offline', () => setConn('offline'));
document.addEventListener('visibilitychange', () => {
  wsSend({ t: 'act', on: visible() });
  if (visible()) {
    S.backoff = 1000;
    connect();
    wsSend({ t: 'p' });
    const active = getApp().active;
    if (active) markRead(active);
  }
});
window.addEventListener('pagehide', () => {
  wsSend({ t: 'act', on: false });
  S.ws?.close(1000);
});
window.addEventListener('pageshow', (e) => { if (e.persisted) connect(); });

async function handle(m: any) {
  if (Object.hasOwn(frameHooks, m.t)) return frameHooks[m.t](m);
  switch (m.t) {
    case 'ok':
      S.ready = true;
      S.backoff = 1000;
      setConn('online');
      clearInterval(S.pingTimer);
      S.pingTimer = window.setInterval(() => wsSend({ t: 'p' }), 20000);
      wsSend({ t: 'sync', after: S.lastSeq });
      wsSend({ t: 'hidden', since: S.hiddenTs });
      watchFriends();
      syncAvatar(S.me, m.av || 0).catch(() => {});
      flushOutbox();
      flushHides();
      wsSend({ t: 'glist' });
      break;
    case 'batch': {
      for (const row of m.msgs) await ingest(row, true);
      if (m.msgs.length) await saveSeq(m.msgs[m.msgs.length - 1].seq, true);
      if (m.more) { wsSend({ t: 'sync', after: S.lastSeq }); break; }
      S.synced = true;
      await reloadChats();
      const active = getApp().active;
      if (active) { await loadMessages(active); markRead(active); }
      break;
    }
    case 'm':
      await ingest(m, false);
      await saveSeq(m.seq);
      break;
    case 'ack': {
      S.inflight.delete(m.cid);
      await db.del('outbox', m.cid);
      const msg = await db.getMsg(S.me + '/' + m.cid);
      if (msg) await updateStatus({ ...msg, id: m.id, s: Math.max(msg.s, m.s) });
      await saveSeq(m.seq);
      break;
    }
    case 'st':
      for (const it of m.items) {
        const msg = await db.msgById(it.id);
        if (msg && it.s > msg.s) await updateStatus({ ...msg, s: it.s });
      }
      await saveSeq(Math.max(...m.items.map((i: any) => i.seq)));
      break;
    case 'gone':
      for (const it of m.items) {
        const msg = await db.msgById(it.id);
        if (msg) await markDeleted(msg);
      }
      await saveSeq(Math.max(...m.items.map((i: any) => i.seq)));
      break;
    case 'delr':
      if (m.failed.length) toast.error("Couldn't delete for everyone", { description: 'The 5-minute limit has passed.' });
      break;
    case 'hid':
      for (const id of m.ids) {
        const msg = await db.msgById(id);
        if (msg) await removeLocal(msg);
      }
      if (m.ts > S.hiddenTs) { S.hiddenTs = m.ts; await db.put('kv', m.ts, 'hiddenTs'); }
      break;
    case 'typ':
      showTyping(m.f, m.r ? 'recording' : 'typing');
      break;
    case 'pres':
      setApp((s) => ({ presence: { ...s.presence, [m.u]: { on: m.on, ls: m.ls, hid: m.hid } } }));
      syncAvatar(m.u, m.av || 0).catch(() => {});
      break;
    case 'fr': {
      await refreshFriends();
      if (m.req) {
        const who = getApp().incoming.find((r) => r.u === m.u);
        toast(`${who?.name || m.u} sent you a friend request`, {
          action: { label: 'View', onClick: () => setApp({ panel: 'friends', friendsTab: 'requests' }) },
        });
      }
      break;
    }
    case 'prof':
      if (m.u === S.me) await refreshMe(); else await refreshFriends();
      break;
    case 'err':
      if (m.cid) {
        S.inflight.delete(m.cid);
        await db.del('outbox', m.cid);
        const msg = await db.getMsg(S.me + '/' + m.cid);
        if (msg) await updateStatus({ ...msg, s: -2 });
        if (m.e === 'not-friends') toast.error('Message not sent', { description: 'You can only message friends who haven’t blocked you.' });
      }
      break;
  }
}

// Only advance the sync cursor from live events once the initial sync finished,
// otherwise a live event could skip us past rows we haven't fetched yet.
async function saveSeq(seq: number, fromSync = false) {
  if (!(fromSync || S.synced) || !(seq > S.lastSeq)) return;
  S.lastSeq = seq;
  await db.put('kv', seq, 'lastSeq');
}

// ---------- profile & friends ----------
export async function refreshMe() {
  const me = await api<Me>('/api/me');
  delete me.encPriv;
  await db.put('kv', me, 'me');
  setApp({ me });
}

export async function refreshFriends() {
  const r = await api<{ friends: Friend[]; incoming: Request[]; outgoing: Request[]; blocked: string[] }>('/api/friends');
  const friends = Object.fromEntries(r.friends.map((f) => [f.u, f]));
  const before = getApp().friends;
  setApp({ friends, incoming: r.incoming, outgoing: r.outgoing, blocked: r.blocked });
  await db.put('kv', { friends, incoming: r.incoming, outgoing: r.outgoing, blocked: r.blocked }, 'friends');
  // Pin each friend's key on first sight; flag a change instead of silently accepting it.
  const changed: Record<string, boolean> = {};
  for (const f of r.friends) {
    const p = await db.get('peers', f.u);
    if (!p) await db.put('peers', { u: f.u, pub: f.pub });
    else if (p.pub !== f.pub) { await db.put('peers', { ...p, newPub: f.pub, changed: true }); changed[f.u] = true; }
    if (!before[f.u]) wsSend({ t: 'watch', u: f.u }); // new friend: start getting their presence
  }
  setApp({ keyChanged: changed });
}

function watchFriends() {
  for (const u of Object.keys(getApp().friends)) wsSend({ t: 'watch', u });
}

export const searchUsers = (q: string) => api<{ users: SearchHit[] }>('/api/users?q=' + encodeURIComponent(q)).then((r) => r.users);

async function friendAction(action: string, u: string) {
  const r = await api('/api/friends/' + action, { u });
  await refreshFriends();
  return r;
}
export const sendRequest = (u: string) => friendAction('request', u);
export const acceptRequest = (u: string) => friendAction('accept', u);
export const declineRequest = (u: string) => friendAction('decline', u);
export const removeFriend = (u: string) => friendAction('remove', u);
export const blockUser = (u: string) => friendAction('block', u);
export const unblockUser = (u: string) => friendAction('unblock', u);

export async function updateProfile(p: Partial<Pick<Me, 'name' | 'about'>> & { privacy?: Partial<Me['privacy']> }) {
  await api('/api/profile', p);
  await refreshMe();
}

export async function mute(peer: string, until: number) {
  const { mutes } = await api('/api/mute', { u: peer, until });
  setApp((s) => ({ me: s.me && { ...s.me, mutes } }));
}

export const isMuted = (peer: string) => {
  const until = getApp().me?.mutes[peer];
  return until === -1 || (typeof until === 'number' && until > Date.now());
};

// ---------- profile photos ----------
// Photos are cached in IndexedDB by version, so they show instantly and offline.
const loadingAvatars = new Set<string>();
export async function loadAvatar(u: string) {
  if (u in getApp().avatars || loadingAvatars.has(u)) return;
  loadingAvatars.add(u);
  const rec = await db.get('avatars', u);
  setApp((s) => ({ avatars: { ...s.avatars, [u]: rec ? URL.createObjectURL(rec.blob) : null } }));
  loadingAvatars.delete(u);
}

async function syncAvatar(u: string, ver: number) {
  const rec = await db.get('avatars', u);
  if ((rec?.ver || 0) === ver) return;
  if (!ver) await db.del('avatars', u);
  else {
    const res = await fetch('/api/avatar?u=' + encodeURIComponent(u), { headers: { Authorization: 'Bearer ' + S.token } });
    if (!res.ok) return;
    await db.put('avatars', { u, ver, blob: await res.blob() });
  }
  const old = getApp().avatars[u];
  if (old) URL.revokeObjectURL(old);
  setApp((s) => { const avatars = { ...s.avatars }; delete avatars[u]; return { avatars }; });
  await loadAvatar(u);
}

export async function setAvatar(file: File) {
  const { av } = await api('/api/avatar', { img: await squarePhoto(file) });
  await syncAvatar(S.me, av);
}
export async function removeAvatar() {
  await api('/api/avatar', { img: null });
  await syncAvatar(S.me, 0);
}

// ---------- chats & messages (local) ----------
const sortChats = (chats: Chat[]) => [...chats].sort((a, b) => b.ts - a.ts);
const newChat = (peer: string): Chat => ({ peer, ts: 0, last: '', lastOut: false, unread: 0, pins: [] });

async function reloadChats() {
  setApp({ chats: sortChats(await db.all('chats')) });
}

async function saveChat(chat: Chat) {
  await db.putChat(chat);
  setApp((s) => ({ chats: sortChats([...s.chats.filter((c) => c.peer !== chat.peer), chat]) }));
}

async function loadMessages(peer: string) {
  const msgs = await db.recentMessages(peer);
  if (getApp().active === peer) setApp({ messages: msgs });
}

/** Insert or replace a message in the open chat's list. */
function showMessage(m: Msg) {
  setApp((s) => {
    if (s.active !== m.peer) return {};
    const i = s.messages.findIndex((x) => x.k === m.k);
    if (i >= 0) { const messages = s.messages.slice(); messages[i] = m; return { messages }; }
    const messages = [...s.messages, m];
    if (messages.length > 1 && messages[messages.length - 2].ts > m.ts) messages.sort((a, b) => a.ts - b.ts);
    return { messages };
  });
}

/** Keep the chat list's ticks in step when the last message's status changes. */
async function updateStatus(m: Msg) {
  await db.putMsg(m);
  showMessage(m);
  const chat = await db.getChat(m.peer);
  if (chat?.lastK === m.k && chat.lastS !== m.s) await saveChat({ ...chat, lastS: m.s });
}

export const preview = (m: Pick<Msg, 'type' | 'text' | 'dur' | 'file'>) =>
  m.type === 'img' ? '📷 Photo' + (m.text ? ': ' + m.text : '')
    : m.type === 'voice' ? `🎤 Voice message`
    : m.type === 'gif' ? 'GIF'
    : m.type === 'file' ? '📄 ' + (m.file?.name || 'File')
    : m.type === 'location' ? '📍 Location'
    : m.type === 'sticker' ? 'Sticker'
    : m.type === 'deleted' ? '🚫 This message was deleted'
    : m.type === 'err' ? '🔒 Unable to decrypt'
    : (m.text || '').slice(0, 100);

export const KLIPY_MEDIA = 'https://static.klipy.com/';

function linkPreviewOf(lp: any): LinkPreview | undefined {
  if (!lp || typeof lp.url !== 'string' || !/^https?:\/\//.test(lp.url) || typeof lp.title !== 'string') return undefined;
  const img = typeof lp.img === 'string' && /^data:image\/(webp|jpeg|png|gif);/.test(lp.img) ? lp.img : undefined;
  return { url: lp.url.slice(0, 2000), title: lp.title.slice(0, 200), desc: String(lp.desc || '').slice(0, 300), site: String(lp.site || '').slice(0, 80), ...(img && { img }) };
}

const replyOf = (r: any) =>
  r && typeof r.f === 'string' && typeof r.c === 'string' && typeof r.p === 'string'
    ? { f: r.f.slice(0, 24), c: r.c.slice(0, 40), p: r.p.slice(0, 120) } : undefined;

/** Validate decrypted content into the fields a Msg may carry. */
function pick(c: any): Partial<Msg> {
  const extra = { ...(replyOf(c.re) && { re: replyOf(c.re) }), ...(c.fwd === true && { fwd: true }) };
  if (c.type === 'text' && typeof c.text === 'string') {
    const lp = linkPreviewOf(c.lp);
    return { type: 'text', text: c.text.slice(0, 8000), ...extra, ...(lp && { lp }) };
  }
  if (c.type === 'file' && typeof c.src === 'string' && c.src.startsWith('data:') && typeof c.name === 'string') {
    const thumb = typeof c.thumb === 'string' && /^data:image\/(webp|jpeg|png);/.test(c.thumb) ? c.thumb : undefined;
    return {
      type: 'file', src: c.src, ...extra,
      file: { name: c.name.slice(0, 200), size: +c.size || 0, mime: String(c.mime || '').slice(0, 100), ...(thumb && { thumb }),
        ...(typeof c.text === 'string' && { text: c.text.slice(0, 400) }), ...(Number.isInteger(c.pages) && { pages: c.pages }) },
    };
  }
  if (c.type === 'location' && Number.isFinite(c.lat) && Number.isFinite(c.lng) && Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180) {
    return { type: 'location', loc: { lat: +c.lat, lng: +c.lng, acc: Math.max(0, +c.acc || 0) }, ...extra };
  }
  if (c.type === 'img' && typeof c.src === 'string' && c.src.startsWith('data:image/')) {
    return { type: 'img', src: c.src, w: c.w | 0, h: c.h | 0, text: typeof c.text === 'string' ? c.text : '', ...extra };
  }
  // GIFs and KLIPY stickers are only ever loaded from KLIPY's CDN; built-in stickers are "noto:<emoji>".
  if (c.type === 'gif' && typeof c.src === 'string' && c.src.startsWith(KLIPY_MEDIA)) {
    return { type: 'gif', src: c.src, w: c.w | 0, h: c.h | 0, ...extra };
  }
  if (c.type === 'sticker' && typeof c.src === 'string' && (c.src.startsWith(KLIPY_MEDIA) || /^noto:\S{1,16}$/u.test(c.src))) {
    return { type: 'sticker', src: c.src, w: c.w | 0, h: c.h | 0, ...extra };
  }
  if (c.type === 'voice' && typeof c.src === 'string' && c.src.startsWith('data:audio/') && Array.isArray(c.peaks)) {
    return { type: 'voice', src: c.src, dur: +c.dur || 0, peaks: c.peaks.slice(0, 64).map((v: unknown) => Math.min(1, Math.max(0, +(v as number) || 0))), ...extra };
  }
  return { type: 'err' };
}

async function convKey(peer: string) {
  if (!S.convKeys.has(peer)) {
    let p = await db.get('peers', peer);
    if (!p) {
      const f = getApp().friends[peer] || (await api('/api/key?u=' + encodeURIComponent(peer)).catch(() => null));
      if (!f) throw new Error('No key for ' + peer);
      p = { u: peer, pub: f.pub };
      await db.put('peers', p);
    }
    S.convKeys.set(peer, await C.conversationKey(S.priv!, p.pub, S.me, peer));
  }
  return S.convKeys.get(peer)!;
}

async function ingest(row: any, fromSync: boolean) {
  const out = row.f === S.me;
  const peer = out ? row.to : row.f;
  const k = row.f + '/' + row.cid;
  const existing = await db.getMsg(k);

  if (row.b === '') { // deleted for everyone
    if (existing) await markDeleted(existing);
    else if (!(await db.get('kv', 'ctl/' + k))) {
      const msg: Msg = { k, cid: row.cid, id: row.id, peer, out, ts: row.ts, s: row.s, type: 'deleted' };
      await db.putMsg(msg);
      await bumpChat(peer, msg, false, fromSync);
    }
    return;
  }
  if (existing) {
    if (row.s > existing.s || existing.id == null) await updateStatus({ ...existing, id: row.id, s: Math.max(existing.s, row.s) });
    return;
  }

  let content: any;
  try { content = await C.decryptMessage(await convKey(peer), row.b, row.f, row.to, row.cid); }
  catch { content = { type: 'err' }; }

  if (CONTROL.has(content?.type)) {
    await db.put('kv', 1, 'ctl/' + k); // remember it was a control, not a message
    await applyControl(content, row.f, row.ts, peer);
    return;
  }

  const viewing = getApp().active === peer && visible();
  const msg: Msg = { k, cid: row.cid, id: row.id, peer, out, ts: row.ts, s: !out && viewing ? 2 : row.s, ...pick(content) } as Msg;
  await db.putMsg(msg);
  await bumpChat(peer, msg, !out && row.s < 2 && !viewing, fromSync);
  if (!out && row.s < 2) queueReceipt(row.id, viewing ? 2 : 1);
  if (!out) clearTyping(peer);
  if (fromSync) return;
  showMessage(msg);
  if (!out) alertIncoming(peer, msg);
}

async function bumpChat(peer: string, msg: Msg, unread: boolean, fromSync: boolean) {
  const chat = (await db.getChat(peer)) || newChat(peer);
  if (msg.ts >= chat.ts) Object.assign(chat, { ts: msg.ts, last: preview(msg), lastOut: msg.out, lastK: msg.k, lastS: msg.s });
  if (unread) chat.unread++;
  if (!msg.out && chat.archived && !isMuted(peer)) chat.archived = false; // new message un-archives, like WhatsApp
  if (fromSync) await db.putChat(chat); else await saveChat(chat);
}

async function applyControl(c: any, from: string, ts: number, peer: string) {
  if (typeof c.k !== 'string') return;
  if (c.type === 'pin') {
    const target = await db.getMsg(c.k);
    if (target && target.peer !== peer) return;
    const chat = (await db.getChat(peer)) || newChat(peer);
    chat.pins = applyPin(chat.pins || [], c.k, !!c.on, ts);
    await saveChat(chat);
    return;
  }
  const target = await db.getMsg(c.k);
  if (!target || target.peer !== peer) return; // controls can only touch messages in this chat
  const next = c.type === 'edit' ? applyEdit(target, from, ts, c.text) : applyReact(target, from, typeof c.e === 'string' ? c.e : '');
  if (!next) return;
  await db.putMsg(next);
  showMessage(next);
  if (c.type === 'edit') {
    const chat = await db.getChat(peer);
    if (chat?.lastK === next.k) await saveChat({ ...chat, last: preview(next) });
  }
}

async function markDeleted(m: Msg) {
  const gone: Msg = { k: m.k, cid: m.cid, id: m.id, peer: m.peer, out: m.out, ts: m.ts, s: m.s, type: 'deleted' };
  await db.putMsg(gone);
  showMessage(gone);
  const chat = await db.getChat(m.peer);
  if (chat) {
    const pins = (chat.pins || []).filter((p) => p.k !== m.k);
    await saveChat({ ...chat, pins, ...(chat.lastK === m.k && { last: preview(gone) }) });
  }
}

/** Remove a message from this device (delete for me). */
async function removeLocal(m: Msg) {
  await db.del('msgs', m.k);
  if (m.s === -1) { await db.del('outbox', m.cid); S.inflight.delete(m.cid); }
  setApp((s) => ({
    messages: s.messages.filter((x) => x.k !== m.k),
    selection: s.selection && s.selection.filter((k) => k !== m.k),
  }));
  const chat = await db.getChat(m.peer);
  if (!chat) return;
  const pins = (chat.pins || []).filter((p) => p.k !== m.k);
  if (chat.lastK === m.k) {
    const [prev] = (await db.recentMessages(m.peer, 1));
    await saveChat({ ...chat, pins, last: prev ? preview(prev) : '', lastOut: !!prev?.out, lastK: prev?.k, ts: prev?.ts ?? chat.ts });
  } else await saveChat({ ...chat, pins });
}

// ---------- receipts ----------
function queueReceipt(id: number, s: 1 | 2) {
  S.rcpt[s].add(id);
  if (s === 2) S.rcpt[1].delete(id);
  clearTimeout(S.rcptTimer);
  S.rcptTimer = window.setTimeout(flushReceipts, 300); // batch receipts into one small frame
}

function flushReceipts() {
  for (const s of [1, 2] as const) {
    if (!S.rcpt[s].size) continue;
    if (wsSend({ t: 'rcpt', ids: [...S.rcpt[s]], s })) S.rcpt[s].clear();
  }
}

export async function markRead(peer: string) {
  if (!visible()) return;
  const msgs = await db.recentMessages(peer, 500);
  for (const m of msgs) {
    if (!m.out && m.s < 2 && m.id != null) {
      m.s = 2;
      await db.putMsg(m);
      queueReceipt(m.id, 2);
    }
  }
  const chat = await db.getChat(peer);
  if (chat?.unread) await saveChat({ ...chat, unread: 0 });
}

// ---------- sending ----------
async function peerKeyChanged(peer: string) {
  const p = await db.get('peers', peer);
  return !!p?.changed;
}

async function encryptAndQueue(peer: string, content: Content, quiet: boolean) {
  const cid = C.randomId();
  const ts = Date.now();
  const b = await C.encryptMessage(await convKey(peer), content, S.me, peer, cid);
  await db.put('outbox', { cid, to: peer, b, ts, ...(quiet && { q: 1 }) });
  return { cid, ts };
}

/** Send a message bubble (text, photo or voice). */
export async function sendContent(peer: string, content: Extract<Content, { type: 'text' | 'img' | 'voice' | 'gif' | 'sticker' | 'file' | 'location' }>) {
  if (await peerKeyChanged(peer)) {
    setApp((s) => ({ keyChanged: { ...s.keyChanged, [peer]: true } }));
    toast.warning('Sending is paused', { description: 'This contact’s security code changed. Verify it first.' });
    return;
  }
  const { cid, ts } = await encryptAndQueue(peer, content, false);
  const msg = { k: S.me + '/' + cid, cid, peer, out: true, ts, s: -1, ...pick(content) } as Msg;
  await db.putMsg(msg);
  await bumpChat(peer, msg, false, false);
  showMessage(msg);
  flushOutbox();
}

/** Reactions, edits and pins: encrypted like messages, applied locally right away. */
async function sendControl(peer: string, content: Extract<Content, { type: 'react' | 'edit' | 'pin' }>) {
  const { cid, ts } = await encryptAndQueue(peer, content, true);
  await db.put('kv', 1, 'ctl/' + S.me + '/' + cid);
  await applyControl(content, S.me, ts, peer);
  flushOutbox();
}

async function flushOutbox() {
  if (!S.ready) return;
  const items = (await db.all('outbox')).sort((a, b) => a.ts - b.ts);
  for (const o of items) {
    if (S.inflight.has(o.cid)) continue;
    if (!wsSend({ t: 'msg', cid: o.cid, to: o.to, b: o.b, ...(o.q && { q: 1 }) })) break;
    S.inflight.add(o.cid);
  }
}

export async function retry(m: Msg) {
  // A failed message is re-sent as a new one (the old ciphertext was refused).
  await removeLocal(m);
  const c = contentOf(m);
  if (c) await sendContent(m.peer, c);
}

function contentOf(m: Msg): Extract<Content, { type: 'text' | 'img' | 'voice' | 'gif' | 'sticker' | 'file' | 'location' }> | null {
  if (m.type === 'text') return { type: 'text', text: m.text || '', ...(m.re && { re: m.re }), ...(m.lp && { lp: m.lp }) };
  if (m.type === 'file') return { type: 'file', src: m.src!, ...m.file!, ...(m.re && { re: m.re }) };
  if (m.type === 'location') return { type: 'location', ...m.loc!, ...(m.re && { re: m.re }) };
  if (m.type === 'img') return { type: 'img', src: m.src!, w: m.w || 0, h: m.h || 0, text: m.text || '', ...(m.re && { re: m.re }) };
  if (m.type === 'voice') return { type: 'voice', src: m.src!, dur: m.dur || 0, peaks: m.peaks || [], ...(m.re && { re: m.re }) };
  if (m.type === 'gif') return { type: 'gif', src: m.src!, w: m.w || 0, h: m.h || 0, ...(m.re && { re: m.re }) };
  if (m.type === 'sticker') return { type: 'sticker', src: m.src!, w: m.w || 0, h: m.h || 0, ...(m.re && { re: m.re }) };
  return null;
}

export async function sendText(peer: string, text: string, re?: Msg | null, lp?: LinkPreview | null) {
  await sendContent(peer, { type: 'text', text, ...(re && { re: replyRef(re) }), ...(lp && { lp }) });
}

export async function sendFile(peer: string, file: File, re?: Msg | null) {
  const f = await prepareFile(file);
  await sendContent(peer, { type: 'file', ...f, ...(re && { re: replyRef(re) }) });
}

export async function sendLocation(peer: string, loc: LocationContent, re?: Msg | null) {
  await sendContent(peer, { type: 'location', ...loc, ...(re && { re: replyRef(re) }) });
}

/** Ask the server for a link's title/image. The preview travels inside the encrypted message. */
export async function fetchLinkPreview(url: string): Promise<LinkPreview | null> {
  try {
    const r = await api<{ url: string; title: string; desc: string; site: string; image: string }>('/api/preview?url=' + encodeURIComponent(url));
    let img: string | undefined;
    if (r.image) {
      try { img = (await compressImage(await (await fetch(r.image)).blob(), 400)).src; } catch { /* no image */ }
    }
    return { url: r.url, title: r.title, desc: r.desc, site: r.site, ...(img && { img }) };
  } catch { return null; }
}

export async function sendPhoto(peer: string, file: File, re?: Msg | null) {
  const img = await compressImage(file);
  await sendContent(peer, { type: 'img', ...img, text: '', ...(re && { re: replyRef(re) }) });
}

export async function sendVoice(peer: string, rec: { src: string; dur: number; peaks: number[] }, re?: Msg | null) {
  await sendContent(peer, { type: 'voice', ...rec, ...(re && { re: replyRef(re) }) });
}

export async function sendGif(peer: string, g: GifItem, re?: Msg | null) {
  await sendContent(peer, { type: 'gif', src: g.src, w: g.w, h: g.h, ...(re && { re: replyRef(re) }) });
}

/** A built-in animated sticker (an emoji) or a KLIPY sticker. */
export async function sendSticker(peer: string, s: string | GifItem, re?: Msg | null) {
  const c = typeof s === 'string' ? { src: 'noto:' + s } : { src: s.src, w: s.w, h: s.h };
  await sendContent(peer, { type: 'sticker', ...c, ...(re && { re: replyRef(re) }) });
}

export async function searchGifs(kind: 'gifs' | 'stickers', q: string, page = 1) {
  return api<{ items: GifItem[]; next: number | null }>(`/api/gifs?kind=${kind}&page=${page}&q=${encodeURIComponent(q)}`);
}

// ---------- active sessions ----------
export const listSessions = () => api<{ sessions: Session[] }>('/api/sessions').then((r) => r.sessions);
export const revokeSession = (id: string) => api('/api/sessions/revoke', { id });

const replyRef = (m: Msg) => ({ f: senderOf(m), c: m.cid, p: preview(m).slice(0, 120) });

// ---------- message actions ----------
export async function react(m: Msg, emoji: string) {
  const mine = m.reacts?.[S.me];
  await sendControl(m.peer, { type: 'react', k: m.k, e: mine === emoji ? '' : emoji });
}

export async function editMessage(m: Msg, text: string) {
  if (text.trim() === m.text) return;
  await sendControl(m.peer, { type: 'edit', k: m.k, text: text.trim() });
}

export async function togglePin(m: Msg) {
  const chat = getApp().chats.find((c) => c.peer === m.peer);
  const pinned = !!chat?.pins?.some((p) => p.k === m.k);
  await sendControl(m.peer, { type: 'pin', k: m.k, on: !pinned });
  toast.success(pinned ? 'Message unpinned' : 'Message pinned');
}

export async function forward(msgs: Msg[], peers: string[]) {
  const ordered = [...msgs].sort((a, b) => a.ts - b.ts);
  for (const peer of peers) {
    for (const m of ordered) {
      const c = contentOf(m);
      if (!c) continue;
      delete (c as any).re;
      await sendContent(peer, { ...c, fwd: true });
    }
  }
}

export async function copyMessages(msgs: Msg[]) {
  const text = [...msgs].sort((a, b) => a.ts - b.ts).map((m) => m.text).filter(Boolean).join('\n');
  await navigator.clipboard.writeText(text);
}

/** Delete for me: gone from this device now, and from my other devices via the server. */
export async function deleteForMe(msgs: Msg[]) {
  const ids = msgs.map((m) => m.id).filter((id): id is number => id != null);
  for (const m of msgs) await removeLocal(m);
  if (ids.length) {
    const pending: number[] = (await db.get('kv', 'pendingHides')) || [];
    await db.put('kv', [...pending, ...ids], 'pendingHides');
    flushHides();
  }
}

async function flushHides() {
  const pending: number[] = (await db.get('kv', 'pendingHides')) || [];
  if (pending.length && wsSend({ t: 'hide', ids: pending.slice(0, 500) })) {
    await db.put('kv', pending.slice(500), 'pendingHides');
  }
}

/** Delete for everyone (server enforces: own messages, within 5 minutes). */
export function deleteForEveryone(msgs: Msg[]) {
  const ids = msgs.map((m) => m.id).filter((id): id is number => id != null);
  if (!wsSend({ t: 'del', ids })) throw new Error("You're offline. Try again when connected.");
}

// ---------- typing ----------
export function sendTyping(peer: string, recording = false) {
  const now = Date.now();
  if (now - S.lastTypingSent < 2500) return;
  S.lastTypingSent = now;
  wsSend({ t: 'typ', to: peer, ...(recording && { r: 1 }) });
}

function showTyping(peer: string, kind: 'typing' | 'recording') {
  clearTimeout(S.typingTimers.get(peer));
  S.typingTimers.set(peer, window.setTimeout(() => clearTyping(peer), 4000));
  setApp((s) => ({ typing: { ...s.typing, [peer]: kind } }));
}

function clearTyping(peer: string) {
  clearTimeout(S.typingTimers.get(peer));
  setApp((s) => { if (!s.typing[peer]) return {}; const typing = { ...s.typing }; delete typing[peer]; return { typing }; });
}

// ---------- open / close chats ----------
export async function openChat(peer: string) {
  const prev = getApp().active;
  setApp({
    active: peer, panel: null,
    ...(prev !== peer && { messages: [], replyTo: null, editing: null, selection: null, searchOpen: false, searchQuery: '', highlight: null }),
  });
  if (!(await db.getChat(peer))) await saveChat(newChat(peer));
  await loadMessages(peer);
  markRead(peer);
  wsSend({ t: 'watch', u: peer });
  askNotifyPermissionOnce();
}

export function closeChat() {
  setApp({ active: null, messages: [], replyTo: null, editing: null, selection: null, searchOpen: false, highlight: null });
}

export async function setArchived(peer: string, archived: boolean) {
  const chat = (await db.getChat(peer)) || newChat(peer);
  await saveChat({ ...chat, archived });
  toast(archived ? 'Chat archived' : 'Chat unarchived');
}

export function saveDraft(peer: string, text: string) {
  clearTimeout(S.draftTimers.get(peer));
  S.draftTimers.set(peer, window.setTimeout(async () => {
    const chat = await db.getChat(peer);
    if (chat && (chat.draft || '') !== text) await saveChat({ ...chat, draft: text });
  }, 400));
}

export async function verifyCodes(peer: string) {
  const p = await db.get('peers', peer);
  const current = await C.safetyNumber(S.me, S.pub, peer, p.pub);
  const next = p.changed ? await C.safetyNumber(S.me, S.pub, peer, p.newPub) : null;
  return { current, next };
}

export async function acceptNewKey(peer: string) {
  const p = await db.get('peers', peer);
  if (!p?.newPub) return;
  await db.put('peers', { u: peer, pub: p.newPub });
  S.convKeys.delete(peer);
  setApp((s) => { const keyChanged = { ...s.keyChanged }; delete keyChanged[peer]; return { keyChanged }; });
}

// ---------- notifications ----------
let audioCtx: AudioContext | null = null;
function playSound() {
  try {
    audioCtx ??= new AudioContext();
    const t = audioCtx.currentTime;
    for (const [i, f] of [880, 1320].entries()) {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.12, t + i * 0.09 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.16);
      o.connect(g).connect(audioCtx.destination);
      o.start(t + i * 0.09);
      o.stop(t + i * 0.09 + 0.18);
    }
  } catch { /* audio not available */ }
}

function alertIncoming(peer: string, msg: Msg) {
  if (isMuted(peer)) return;
  const viewingThis = getApp().active === peer && visible();
  if (viewingThis) return;
  if (useSettings.getState().sound && visible()) playSound();
  // Hidden tab: if push is on the server notifies; otherwise show a notification from the page.
  if (!visible() && !useSettings.getState().push && 'Notification' in window && Notification.permission === 'granted') {
    const name = getApp().friends[peer]?.name || peer;
    navigator.serviceWorker?.ready.then((reg) => reg.showNotification(name, {
      body: preview(msg), icon: '/icon-192.png', tag: 'chat-' + peer, data: { peer },
    })).catch(() => {});
  }
}

let askedNotify = false;
function askNotifyPermissionOnce() {
  if (askedNotify || !('Notification' in window) || Notification.permission !== 'default') return;
  askedNotify = true;
  Notification.requestPermission().catch(() => {});
}

// ---------- push ----------
const b64urlToBytes = (s: string) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export async function enablePush(silent = false) {
  if (!pushSupported()) {
    throw new Error(/iPhone|iPad/.test(navigator.userAgent)
      ? 'On iPhone, add Chattrix to your Home Screen first (Share → Add to Home Screen).'
      : 'This browser doesn’t support push notifications.');
  }
  const perm = silent ? Notification.permission : await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notifications are blocked. Allow them in your browser settings.');
  const reg = await navigator.serviceWorker.ready;
  const { key } = await api('/api/push/key');
  const sub = (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlToBytes(key) }));
  await api('/api/push/subscribe', { sub: sub.toJSON() });
  setSettings({ push: true });
}

export async function disablePush() {
  setSettings({ push: false });
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await api('/api/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
}

// Clicking a notification opens that chat (sent by the service worker).
navigator.serviceWorker?.addEventListener('message', (e) => {
  if (e.data?.t === 'open' && e.data.peer && getApp().status === 'app') openChat(e.data.peer);
});

export const me = () => S.me;
