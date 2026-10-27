// Notes and diary entries: personal, or about one chat, each filed under a day.
// Sealed on this device with a key only your own devices can derive (crypto.notesKey); the server
// keeps just the ciphertext, so they reach your other devices and come back after signing out.
// A readable copy stays on this device (IndexedDB) so they open instantly and work offline;
// changes made offline are marked `dirty` and go up when the connection is back.
import { create } from 'zustand';
import * as C from '@sanga/crypto';
import * as db from './db';
import { api, frameHooks, ownIdentity, readyHooks } from './engine';
import { setApp } from '../state/app';

export interface Note {
  id: string;
  day: string;     // YYYY-MM-DD (your local date) it's filed under
  chat: string;    // '' = personal diary; otherwise the chat it's about (a username or g:<id>)
  title: string;
  text: string;
  mood: string;    // an emoji from MOODS, or ''
  created: number;
  edited: number;
  srv?: number;    // when the server last stored it
  dirty?: boolean; // changed here, not on the server yet
  deleted?: boolean;
}

export const MAX_TITLE = 120;
export const MAX_TEXT = 20_000;
export const MOODS = ['😀', '🙂', '😐', '😔', '😢', '😡', '🥰', '🤩', '😴'];

/** `filter`: which notes the panel shows: null = all, '' = personal, or a chat. */
export const useNotes = create<{ notes: Record<string, Note>; loaded: boolean; filter: string | null }>(() => ({ notes: {}, loaded: false, filter: null }));

/** Open the diary: everything (null), the personal diary (''), or one chat's notes. */
export function openNotes(chat: string | null = null) {
  useNotes.setState({ filter: chat });
  setApp({ panel: 'notes' });
  void loadNotes();
  void syncNotes();
}

const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => dayKey(new Date());
/** Noon of that day, so date formatting can't slip into the next or previous day. */
export const dayDate = (day: string) => new Date(`${day}T12:00:00`);

export const newNote = (day: string, chat: string): Note =>
  ({ id: C.randomId(18), day, chat, title: '', text: '', mood: '', created: Date.now(), edited: Date.now() });
export const isEmpty = (n: Note) => !n.title.trim() && !n.text.trim() && !n.mood;

// ---------- on this device ----------
let loading: Promise<void> | null = null;
export function loadNotes() {
  return (loading ??= db.kvPrefix<Note>('note/').then((list) => {
    useNotes.setState((s) => ({ loaded: true, notes: { ...Object.fromEntries(list.map((n) => [n.id, n])), ...s.notes } }));
  }));
}

function keep(n: Note) {
  useNotes.setState((s) => ({ notes: { ...s.notes, [n.id]: n } }));
  return db.put('kv', n, 'note/' + n.id);
}
function drop(id: string) {
  useNotes.setState((s) => { const notes = { ...s.notes }; delete notes[id]; return { notes }; });
  return db.del('kv', 'note/' + id);
}

/** Save a change (typing autosaves through here); it goes to the server shortly after. */
export function saveNote(n: Note) {
  const t = n.text.slice(0, MAX_TEXT), title = n.title.slice(0, MAX_TITLE);
  keep({ ...n, title, text: t, edited: Date.now(), dirty: true }).then(soon);
}

export function deleteNote(id: string) {
  const n = useNotes.getState().notes[id];
  if (!n) return;
  // Kept as "deleted" until the server has heard (it may be on its way up right now).
  keep({ ...n, deleted: true, dirty: true, edited: Date.now() }).then(soon);
}

// ---------- sync ----------
let timer = 0;
const soon = () => { clearTimeout(timer); timer = window.setTimeout(() => void syncNotes(), 700); };

let key: Promise<CryptoKey> | null = null;
function notesKey() {
  const { priv, pub } = ownIdentity();
  if (!priv) throw new Error('Not signed in');
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
  const { me } = ownIdentity();
  const k = await notesKey();
  for (const n of Object.values(useNotes.getState().notes)) {
    if (!n.dirty) continue;
    const body = n.deleted ? '' : await C.encryptNote(k, sealed(n), me, n.id);
    const { updated } = await api<{ updated: number }>('/api/notes', { id: n.id, body });
    const now = useNotes.getState().notes[n.id];
    if (!now || now.edited !== n.edited) continue; // changed again while sending: that goes next time
    if (n.deleted) await drop(n.id);
    else await keep({ ...now, dirty: false, srv: updated });
  }
  let since: number = (await db.get('kv', 'notesSince')) || 0;
  for (;;) {
    const r = await api<{ notes: { id: string; body: string; updated: number }[]; more: boolean }>(`/api/notes?since=${since}`);
    for (const row of r.notes) await receive(k, me, row);
    if (r.notes.length) since = r.notes[r.notes.length - 1].updated;
    await db.put('kv', since, 'notesSince');
    if (!r.more) break;
  }
}

const sealed = (n: Note) => ({ day: n.day, chat: n.chat, title: n.title, text: n.text, mood: n.mood, created: n.created, edited: n.edited });

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

// Notes come from your own devices, but check the shape anyway so a bad one can't break the panel.
function valid(o: any): Omit<Note, 'id'> | null {
  if (!o || typeof o !== 'object' || typeof o.day !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(o.day)) return null;
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
  const chat = typeof o.chat === 'string' && /^(|[a-z0-9_.]{3,24}|g:[A-Za-z0-9_-]{12})$/.test(o.chat) ? o.chat : '';
  const num = (v: unknown) => (Number.isSafeInteger(v) ? (v as number) : 0);
  return { day: o.day, chat, title: str(o.title, MAX_TITLE), text: str(o.text, MAX_TEXT), mood: MOODS.includes(o.mood) ? o.mood : '', created: num(o.created), edited: num(o.edited) };
}

frameHooks.notes = () => void syncNotes(); // changed on another of your devices
readyHooks.push(() => void syncNotes());
