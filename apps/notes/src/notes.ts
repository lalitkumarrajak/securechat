// Notes and diary entries: personal, or about one chat, each filed under a day.
// Sealed on this device with a key only your own devices can derive (crypto.notesKey); the server
// keeps just the ciphertext, so they reach your other devices and come back after signing out.
// A readable copy stays on this device so they open instantly and work offline; changes made
// offline are marked `dirty` and go up when the connection is back.
// A note can be shared with friends: each gets a copy sealed with the key you share with them
// (sdk.pairKey), kept by the server for them, read-only on their side. Notes friends share with you
// come in the same way and show in your diary with who wrote them (`inbox`).
// Everything outside this app (server, connection, storage, keys) comes through the Sanga SDK.
import { create } from 'zustand';
import * as C from '@sanga/crypto';
import { sdk } from '@sanga/sdk';

export interface Note {
  id: string;
  day: string;     // YYYY-MM-DD (your local date) it's filed under
  chat: string;    // '' = personal diary; otherwise the chat it's about (a username or g:<id>)
  title: string;
  text: string;
  mood: string;    // an emoji from MOODS, or ''
  shared?: string[];   // friends (usernames) who get a read-only copy
  unshared?: string[]; // on this device only: friends whose copy still has to be taken back
  created: number;
  edited: number;
  srv?: number;    // when the server last stored it
  dirty?: boolean; // changed here, not on the server yet
  deleted?: boolean;
}

export const MAX_TITLE = 120;
export const MAX_TEXT = 20_000;
export const MOODS = ['😀', '🙂', '😐', '😔', '😢', '😡', '🥰', '🤩', '😴'];

/** A friend's note shared with you: read-only. `key` is "<owner>|<id>". */
export interface SharedNote { key: string; from: string; id: string; day: string; title: string; text: string; mood: string; created: number; edited: number; srv: number }
export const MAX_SHARES = 20;
/** The filter value for notes friends shared with you (chats are usernames or g:<id>, never this). */
export const SHARED_WITH_ME = '@in';

/** `filter`: which notes the diary shows: null = all, '' = personal, SHARED_WITH_ME, or a chat. */
export const useNotes = create<{ notes: Record<string, Note>; inbox: Record<string, SharedNote>; loaded: boolean; filter: string | null }>(() => ({ notes: {}, inbox: {}, loaded: false, filter: null }));

const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => dayKey(new Date());
/** Noon of that day, so date formatting can't slip into the next or previous day. */
export const dayDate = (day: string) => new Date(`${day}T12:00:00`);

export const newNote = (day: string, chat: string): Note =>
  ({ id: C.randomId(18), day, chat, title: '', text: '', mood: '', created: Date.now(), edited: Date.now() });
export const isEmpty = (n: Note) => !n.title.trim() && !n.text.trim() && !n.mood;

/** Listen for changes from your other devices and sync on every reconnect. Once, when the app first opens. */
let started = false;
export function startNotes() {
  if (started) return;
  started = true;
  sdk().on('notes', () => void syncNotes()); // changed on another of your devices
  sdk().onReady(() => void syncNotes());
  void loadNotes();
  void syncNotes();
}

// ---------- on this device ----------
const IN = 'app/notes/in/';
let loading: Promise<void> | null = null;
export function loadNotes() {
  return (loading ??= Promise.all([sdk().store.prefix<Note>('note/'), sdk().store.prefix<SharedNote>(IN).catch(() => [] as SharedNote[])]).then(([list, inbox]) => {
    useNotes.setState((s) => ({ loaded: true, notes: { ...Object.fromEntries(list.map((n) => [n.id, n])), ...s.notes }, inbox: { ...Object.fromEntries(inbox.map((x) => [x.key, x])), ...s.inbox } }));
  }));
}

function keep(n: Note) {
  useNotes.setState((s) => ({ notes: { ...s.notes, [n.id]: n } }));
  return sdk().store.put('note/' + n.id, n);
}
function drop(id: string) {
  useNotes.setState((s) => { const notes = { ...s.notes }; delete notes[id]; return { notes }; });
  return sdk().store.del('note/' + id);
}

/** Save a change (typing autosaves through here); it goes to the server shortly after. */
export function saveNote(n: Note) {
  const t = n.text.slice(0, MAX_TEXT), title = n.title.slice(0, MAX_TITLE);
  keep({ ...n, title, text: t, ...sharing(n, n.shared ?? []), edited: Date.now(), dirty: true }).then(soon);
}

/** Who it's shared with now, and whose copy has to be taken back (they were on it before, not now). */
function sharing(n: Note, next: string[]) {
  const before = useNotes.getState().notes[n.id];
  const shared = [...new Set(next)].slice(0, MAX_SHARES);
  const gone = [...(before?.unshared ?? []), ...(before?.shared ?? [])].filter((u) => !shared.includes(u));
  return { shared: shared.length ? shared : undefined, unshared: gone.length ? [...new Set(gone)] : undefined };
}

export function deleteNote(id: string) {
  const n = useNotes.getState().notes[id];
  if (!n) return;
  // Kept as "deleted" until the server has heard (it may be on its way up right now); every friend's copy goes too.
  keep({ ...n, ...sharing(n, []), deleted: true, dirty: true, edited: Date.now() }).then(soon);
}

// ---------- sync ----------
let timer = 0;
const soon = () => { clearTimeout(timer); timer = window.setTimeout(() => void syncNotes(), 700); };

let key: Promise<CryptoKey> | null = null;
function notesKey() {
  const { priv, pub } = sdk().identity();
  if (!priv) throw new Error('Not signed in'); // i18n-ok: never shown, sync fails quietly
  return (key ??= C.notesKey(priv, pub));
}

let running: Promise<void> | null = null;
let again = false;
/** Send this device's changes, then fetch the ones made elsewhere. Safe to call any time. */
export function syncNotes(): Promise<void> {
  if (running) { again = true; return running; }
  running = sync().catch(() => { /* offline: the changes stay marked and go up on reconnect */ }).finally(() => {
    running = null;
    if (again) { again = false; void syncNotes(); }
  });
  return running;
}

async function sync() {
  await loadNotes();
  const { me } = sdk().identity();
  const k = await notesKey();
  const pairs = new Map<string, Promise<CryptoKey>>();
  const pair = (u: string) => { if (!pairs.has(u)) pairs.set(u, sdk().pairKey(u)); return pairs.get(u)!; };
  for (const n of Object.values(useNotes.getState().notes)) {
    if (!n.dirty) continue;
    const body = n.deleted ? '' : await C.encryptNote(k, sealed(n), me, n.id);
    const { updated } = await sdk().api<{ updated: number }>('/api/notes', { id: n.id, body });
    const left = await sendShares(n, me, pair);
    const now = useNotes.getState().notes[n.id];
    if (!now || now.edited !== n.edited) continue; // changed again while sending: that goes next time
    if (n.deleted) await drop(n.id);
    else await keep({ ...now, unshared: left.length ? left : undefined, dirty: false, srv: updated });
  }
  await receiveShared(me, pair);
  let since: number = (await sdk().store.get('notesSince')) || 0;
  for (;;) {
    const r = await sdk().api<{ notes: { id: string; body: string; updated: number }[]; more: boolean }>(`/api/notes?since=${since}`);
    for (const row of r.notes) await receive(k, me, row);
    if (r.notes.length) since = r.notes[r.notes.length - 1].updated;
    await sdk().store.put('notesSince', since);
    if (!r.more) break;
  }
}

const sealed = (n: Note) => ({ day: n.day, chat: n.chat, title: n.title, text: n.text, mood: n.mood, shared: n.shared, created: n.created, edited: n.edited });
/** What a friend gets: not which chat you filed it under, nor who else it's shared with. */
const forFriend = (n: Note) => ({ day: n.day, title: n.title, text: n.text, mood: n.mood, created: n.created, edited: n.edited });
const AAD_APP = 'sharednote';

/** Each friend it's shared with gets the new copy; those taken off it lose theirs. Returns the ones
 *  still to be taken back (couldn't reach the server for them: tried again next time). */
async function sendShares(n: Note, me: string, pair: (u: string) => Promise<CryptoKey>) {
  const left: string[] = [];
  for (const u of n.deleted ? [] : n.shared ?? []) {
    try {
      const body = await C.encryptItem(await pair(u), forFriend(n), `${me}>${u}`, AAD_APP, n.id);
      await sdk().api('/api/notes/share', { id: n.id, to: u, body });
    } catch (e) { if ((e as Error).name === 'NetworkError') throw e; /* not a friend any more: skip them */ }
  }
  for (const u of n.unshared ?? []) {
    try { await sdk().api('/api/notes/share', { id: n.id, to: u, body: '' }); }
    catch (e) { if ((e as Error).name === 'NetworkError') throw e; left.push(u); }
  }
  return left;
}

/** Notes friends shared with you, changed since last time. */
async function receiveShared(me: string, pair: (u: string) => Promise<CryptoKey>) {
  let since: number = (await sdk().store.get('app/notes/inSince')) || 0;
  for (;;) {
    const r = await sdk().api<{ notes: { owner: string; id: string; body: string; updated: number }[]; more: boolean }>(`/api/notes/shared?since=${since}`);
    for (const row of r.notes) {
      const key = `${row.owner}|${row.id}`;
      const local = useNotes.getState().inbox[key];
      if (local && local.srv >= row.updated) continue;
      if (!row.body) { if (local) await dropShared(key); continue; }
      try {
        const o = validShared(await C.decryptItem(await pair(row.owner), row.body, `${row.owner}>${me}`, AAD_APP, row.id));
        if (o) await keepShared({ ...o, key, from: row.owner, id: row.id, srv: row.updated });
      } catch { /* not readable (their key changed?): skip it */ }
    }
    if (r.notes.length) since = r.notes[r.notes.length - 1].updated;
    await sdk().store.put('app/notes/inSince', since);
    if (!r.more) break;
  }
}
function keepShared(x: SharedNote) {
  useNotes.setState((s) => ({ inbox: { ...s.inbox, [x.key]: x } }));
  return sdk().store.put(IN + x.key, x);
}
function dropShared(key: string) {
  useNotes.setState((s) => { const inbox = { ...s.inbox }; delete inbox[key]; return { inbox }; });
  return sdk().store.del(IN + key);
}
function validShared(o: any) {
  const v = valid({ ...o, chat: '', shared: undefined });
  if (!v) return null;
  const { day, title, text, mood, created, edited } = v;
  return { day, title, text, mood, created, edited };
}

async function receive(k: CryptoKey, me: string, row: { id: string; body: string; updated: number }) {
  const local = useNotes.getState().notes[row.id];
  if (local?.dirty) return;                          // this device's newer change goes up next
  if (local?.srv && local.srv >= row.updated) return; // already have it
  if (!row.body) { if (local) await drop(row.id); return; }
  try {
    const n = valid(await C.decryptNote(k, row.body, me, row.id));
    if (n) await keep({ ...n, id: row.id, srv: row.updated });
  } catch { /* not readable with this key: skip it */ }
}

// Notes come from your own devices, but check the shape anyway so a bad one can't break the diary.
function valid(o: any): Omit<Note, 'id'> | null {
  if (!o || typeof o !== 'object' || typeof o.day !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(o.day)) return null;
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
  const chat = typeof o.chat === 'string' && /^(|[a-z0-9_.]{3,24}|g:[A-Za-z0-9_-]{12})$/.test(o.chat) ? o.chat : '';
  const num = (v: unknown) => (Number.isSafeInteger(v) ? (v as number) : 0);
  const shared = Array.isArray(o.shared) ? [...new Set(o.shared.filter((u: unknown) => typeof u === 'string' && /^[a-z0-9_.]{3,24}$/.test(u)) as string[])].slice(0, MAX_SHARES) : [];
  return { day: o.day, chat, title: str(o.title, MAX_TITLE), text: str(o.text, MAX_TEXT), mood: MOODS.includes(o.mood) ? o.mood : '', shared: shared.length ? shared : undefined, created: num(o.created), edited: num(o.edited) };
}
