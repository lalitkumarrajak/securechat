// Your files and folders. Every file and folder has a record (its name, folder, size, a small picture,
// and for a file its own random key), sealed with a key only your devices can derive
// (crypto.appKey 'drive') and synced like the other apps' records. A file's contents go up in pieces
// of 1.5 MB, each sealed with the file's key and bound to the file and its place in it, so the server
// keeps only ciphertext it can't read, reorder or pass off as another file's.
import { create } from 'zustand';
import * as C from '@sanga/crypto';
import { sdk } from '@sanga/sdk';
import { freeName, mimeOf } from './kinds';
import { makeThumb, type Thumb } from './thumbs';

export interface Entry extends Thumb {
  id: string;
  type: 'folder' | 'file';
  name: string;
  /** The folder it's in; '' is My Drive itself. */
  parent: string;
  created: number;
  edited: number;
  starred?: boolean;
  /** When it went to the Trash. Whatever is inside a trashed folder goes with it. */
  trashed?: number;
  // A file's:
  size?: number;
  mime?: string;
  key?: string;
  chunks?: number;
  /** Shared by a link anyone can open: its id and key (the key travels only inside the link). */
  link?: { id: string; key: string };
  /** Shared with friends: its id, key, and who. */
  share?: { id: string; key: string; to: string[] };
}
interface Kept { id: string; box: string; edited: number; srv?: number; dirty?: boolean; deleted?: boolean }
type Live = Entry & { box: string; srv?: number; dirty?: boolean; deleted?: boolean };

export interface Upload {
  id: string; name: string; size: number; sent: number; parent: string;
  state: 'waiting' | 'sending' | 'done' | 'failed' | 'cancelled'; error?: string;
}

interface State {
  entries: Record<string, Live>;
  loaded: boolean;
  failed: boolean;
  uploads: Upload[];
  usage: { used: number; max: number } | null;
  /** Files being fetched to open, and how far along (0–1). */
  fetching: Record<string, number>;
  /** What friends shared with me, opened. */
  shared: Shared[];
}
/** A share opened: a file or folder (and what's in it) as its owner shared it. */
export interface Shared { id: string; key: string; owner: string; updated: number; m: Manifest }
export interface Manifest { v: 1; owner: string; root: string; gone?: boolean; items: Entry[] }
export const useDrive = create<State>(() => ({ entries: {}, loaded: false, failed: false, uploads: [], usage: null, fetching: {}, shared: [] }));
const set = useDrive.setState, get = useDrive.getState;

const APP = 'drive';
const KEY = 'app/drive/item/';
const SINCE = 'app/drive/since';
const PURGE = 'app/drive/purge'; // files deleted for good whose pieces the server still has
export const CHUNK = 1_500_000;
export const MAX_FILE = 2_000_000_000;
export const TRASH_DAYS = 30;
const now = () => Date.now();

// ---------- reading the tree ----------
const alive = (x?: Live): x is Live => !!x && !x.deleted;
export const all = (m: Record<string, Live> = get().entries) => Object.values(m).filter(alive);

/** In the Trash, or inside a folder that is. */
export function inTrash(e: Entry, m: Record<string, Live> = get().entries): boolean {
  for (let x: Live | undefined = e as Live, i = 0; x && i < 100; x = m[x.parent], i++) {
    if (x.deleted) return true;
    if (x.trashed) return true;
    if (!x.parent) return false;
  }
  return false;
}

export function children(parent: string, m: Record<string, Live> = get().entries): Entry[] {
  return Object.values(m).filter((x) => alive(x) && x.parent === parent && !x.trashed);
}

/** The folders from My Drive down to this one (not including My Drive). */
export function pathTo(id: string, m: Record<string, Live> = get().entries): Entry[] {
  const out: Entry[] = [];
  for (let x = m[id], i = 0; alive(x) && i < 100; x = m[x.parent], i++) { out.unshift(x); if (!x.parent) break; }
  return out;
}

/** Everything inside a folder, at any depth. */
export function descendants(id: string, m: Record<string, Live> = get().entries): Entry[] {
  const out: Entry[] = [];
  const walk = (p: string) => { for (const x of Object.values(m)) if (alive(x) && x.parent === p) { out.push(x); if (x.type === 'folder') walk(x.id); } };
  walk(id);
  return out;
}

/** Whether `id` is `folder` or somewhere inside it (a folder can't be moved into itself). */
export const within = (id: string, folder: string, m: Record<string, Live> = get().entries) =>
  id === folder || pathTo(id, m).some((x) => x.id === folder);

/** Whether a folder still exists and isn't in the Trash ('' is My Drive, always there). */
export const folderOk = (id: string, m: Record<string, Live> = get().entries) =>
  !id || (alive(m[id]) && m[id].type === 'folder' && !inTrash(m[id], m));

export type Sort = 'name' | 'edited' | 'size';
export function sorted(list: Entry[], by: Sort, desc = false) {
  const cmp = (a: Entry, b: Entry) =>
    by === 'edited' ? b.edited - a.edited
    : by === 'size' ? (b.size ?? 0) - (a.size ?? 0)
    : a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  return [...list].sort((a, b) => (a.type !== b.type ? (a.type === 'folder' ? -1 : 1) : (desc ? -cmp(a, b) : cmp(a, b))));
}

export const matches = (e: Entry, q: string) => { const s = q.trim().toLowerCase(); return !s || e.name.toLowerCase().includes(s); };

const takenIn = (parent: string, except?: string) => new Set(children(parent).filter((x) => x.id !== except).map((x) => x.name));

// ---------- on this device ----------
let started = false, loading: Promise<void> | null = null, running: Promise<void> | null = null, again = false, timer = 0;
let keyP: Promise<CryptoKey> | null = null;
function appKey() {
  const { priv, pub } = sdk().identity();
  if (!priv) throw new Error('Not signed in'); // i18n-ok
  return (keyP ??= C.appKey(priv, pub, APP));
}
const me = () => sdk().identity().me;
const seal = async (x: Entry) => C.encryptItem(await appKey(), clean(x), me(), APP, x.id);
const unseal = async (box: string, id: string) => valid(await C.decryptItem(await appKey(), box, me(), APP, id), id);

/** Load what's on this device, listen for changes from your other devices, sync on every reconnect. */
export function startDrive() {
  if (started) return load();
  started = true;
  sdk().on(APP, () => { void syncDrive(); void loadShared(); });
  void loadShared();
  sdk().onReady(() => void syncDrive());
  return load().then(() => { void syncDrive(); });
}

function load() {
  return (loading ??= (async () => {
    const kept = await sdk().store.prefix<Kept>(KEY);
    const got: Record<string, Live> = {};
    await Promise.all(kept.map(async (k) => {
      if (k.deleted) { got[k.id] = { ...blank(k.id), ...k, deleted: true }; return; }
      try { const x = await unseal(k.box, k.id); if (x) got[k.id] = { ...x, box: k.box, srv: k.srv, dirty: k.dirty }; } catch { /* not readable here: skip */ }
    }));
    set((s) => ({ loaded: true, entries: { ...got, ...s.entries } }));
  })().catch((e) => { loading = null; set({ failed: true, loaded: true }); throw e; }));
}
const blank = (id: string): Entry => ({ id, type: 'file', name: '', parent: '', created: 0, edited: 0 });

function keep(x: Live) {
  set((s) => ({ entries: { ...s.entries, [x.id]: x } }));
  const k: Kept = { id: x.id, box: x.box, edited: x.edited, srv: x.srv, dirty: x.dirty, deleted: x.deleted };
  return sdk().store.put(KEY + x.id, k);
}
function drop(id: string) {
  set((s) => { const m = { ...s.entries }; delete m[id]; return { entries: m }; });
  return sdk().store.del(KEY + id);
}

async function save(x: Entry, touch = true) {
  const cur = get().entries[x.id];
  const y = { ...x, edited: touch ? now() : x.edited };
  await keep({ ...y, box: await seal(y), srv: cur?.srv, dirty: true });
  soon();
}

// ---------- folders and changes ----------
export async function newFolder(name: string, parent: string) {
  const t = now();
  const f: Entry = { id: C.randomId(12), type: 'folder', name: freeName(name.trim(), takenIn(parent)), parent, created: t, edited: t };
  await save(f);
  return f;
}
export const rename = (e: Entry, name: string) => save({ ...e, name: name.trim() });
export const star = (e: Entry, on: boolean) => save({ ...e, starred: on || undefined }, false);
export async function move(e: Entry, parent: string) {
  if (e.parent === parent || (e.type === 'folder' && within(parent, e.id))) return;
  await save({ ...e, parent, name: freeName(e.name, takenIn(parent, e.id)) });
}
export const trash = (e: Entry) => save({ ...e, trashed: now() }, false);
export async function restore(e: Entry) {
  const parent = folderOk(e.parent) ? e.parent : '';
  await save({ ...e, parent, trashed: undefined, name: freeName(e.name, takenIn(parent, e.id)) }, false);
}

/** Gone for good, with everything inside it, from every device; the files' pieces go from the server. */
export async function deleteForever(e: Entry) {
  const gone = [e, ...(e.type === 'folder' ? descendants(e.id) : [])];
  for (const x of gone) for (const sh of [x.link, x.share]) if (sh) void stopShare(sh.id);
  const files = gone.filter((x) => x.type === 'file').map((x) => x.id);
  if (files.length) await sdk().store.put(PURGE, [...new Set([...((await sdk().store.get<string[]>(PURGE)) ?? []), ...files])]);
  for (const x of gone) {
    const cur = get().entries[x.id];
    if (!cur) continue;
    forget(x.id);
    if (!cur.srv) await drop(x.id);
    else await keep({ ...blank(x.id), box: '', edited: now(), srv: cur.srv, dirty: true, deleted: true });
  }
  soon();
}
export async function emptyTrash() {
  for (const x of all().filter((x) => x.trashed)) if (get().entries[x.id] && !get().entries[x.id].deleted) await deleteForever(x);
}

// ---------- uploading ----------
const files = new Map<string, File>();
const cancelled = new Set<string>();
let pumping = false;

function setUpload(id: string, p: Partial<Upload>) {
  set((s) => ({ uploads: s.uploads.map((u) => (u.id === id ? { ...u, ...p } : u)) }));
}

/** Add files to send into a folder; they go one after another. */
export function upload(list: File[], parent: string) {
  const add: Upload[] = [];
  for (const f of list) {
    const id = C.randomId(12);
    files.set(id, f);
    add.push({ id, name: f.name, size: f.size, sent: 0, parent, state: f.size > MAX_FILE ? 'failed' : 'waiting', error: f.size > MAX_FILE ? 'big' : undefined });
  }
  set((s) => ({ uploads: [...s.uploads, ...add] }));
  void pump();
}

/** A folder from the computer, with what's inside it ("Trip/Day 1/photo.jpg"): its folders are made here. */
export async function uploadTree(list: { file: File; path: string }[], parent: string) {
  const made = new Map<string, string>(); // "Trip/Day 1" → its folder's id
  const folderFor = async (dir: string): Promise<string> => {
    if (!dir) return parent;
    if (made.has(dir)) return made.get(dir)!;
    const i = dir.lastIndexOf('/');
    const up = await folderFor(i < 0 ? '' : dir.slice(0, i));
    const f = await newFolder(dir.slice(i + 1), up);
    made.set(dir, f.id);
    return f.id;
  };
  const byParent = new Map<string, File[]>();
  for (const { file, path } of list) {
    const dir = path.split('/').slice(0, -1).join('/');
    const p = await folderFor(dir);
    byParent.set(p, [...(byParent.get(p) ?? []), file]);
  }
  for (const [p, fs] of byParent) upload(fs, p);
}

export function cancelUpload(id: string) {
  cancelled.add(id);
  const u = get().uploads.find((x) => x.id === id);
  if (u && u.state === 'waiting') setUpload(id, { state: 'cancelled' });
}
export function retryUpload(id: string) {
  cancelled.delete(id);
  setUpload(id, { state: 'waiting', sent: 0, error: undefined });
  void pump();
}
export const clearUploads = () => set((s) => ({ uploads: s.uploads.filter((u) => u.state === 'waiting' || u.state === 'sending' || u.state === 'failed') }));
export const dismissUploads = () => {
  for (const u of get().uploads) if (u.state === 'waiting' || u.state === 'sending') cancelUpload(u.id);
  set({ uploads: [] });
  files.clear();
};

async function pump() {
  if (pumping) return;
  pumping = true;
  try {
    for (;;) {
      const u = get().uploads.find((x) => x.state === 'waiting');
      if (!u) break;
      const file = files.get(u.id);
      if (!file) { setUpload(u.id, { state: 'failed' }); continue; }
      setUpload(u.id, { state: 'sending' });
      await refreshUsage();
      const room = get().usage;
      if (room && u.size > room.max - room.used) { setUpload(u.id, { state: 'failed', error: 'full' }); continue; }
      try {
        await send(u, file);
        files.delete(u.id);
        setUpload(u.id, { state: 'done', sent: u.size });
        set((s) => ({ usage: s.usage && { ...s.usage, used: s.usage.used + u.size } }));
      } catch (e) {
        void sdk().api('/api/drive/delete', { file: u.id }).catch(() => {});
        if (cancelled.has(u.id)) setUpload(u.id, { state: 'cancelled' });
        else setUpload(u.id, { state: 'failed', error: (e as Error).message });
      }
    }
  } finally { pumping = false; void refreshUsage(); }
}

const aad = (id: string, i: number, n: number, owner = me()) => new TextEncoder().encode(`drive|${owner}|${id}|${i}|${n}`);

async function send(u: Upload, file: File) {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const key = await C.aesKeyFrom(raw);
  const n = Math.max(1, Math.ceil(file.size / CHUNK));
  const mime = mimeOf(file.name, file.type);
  const thumb = await makeThumb(file, mime, file.name);
  let next = 0, sent = 0;
  const worker = async () => {
    while (next < n) {
      const i = next++;
      if (cancelled.has(u.id)) throw new Error('cancelled');
      const part = new Uint8Array(await file.slice(i * CHUNK, (i + 1) * CHUNK).arrayBuffer());
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(u.id, i, n) }, key, part));
      const box = new Uint8Array(iv.length + ct.length);
      box.set(iv); box.set(ct, iv.length);
      await withRetry(() => sdk().api(`/api/drive/chunk?file=${u.id}&i=${i}`, { body: C.b64(box) }));
      sent += part.length;
      setUpload(u.id, { sent });
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  if (cancelled.has(u.id)) throw new Error('cancelled');
  const parent = folderOk(u.parent) ? u.parent : '';
  const t = now();
  await save({
    id: u.id, type: 'file', name: freeName(file.name || 'file', takenIn(parent)), parent, created: t, edited: t,
    size: file.size, mime, key: C.b64(raw), chunks: n, ...thumb,
  });
}

async function withRetry<T>(fn: () => Promise<T>, tries = 4): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) {
      const msg = (e as Error).message ?? '';
      if (i >= tries - 1 || /full|too big|Invalid/i.test(msg)) throw e;
      await new Promise((r) => setTimeout(r, 800 * 2 ** i));
    }
  }
}

export async function refreshUsage() {
  try { set({ usage: await sdk().api<{ used: number; max: number }>('/api/drive/usage') }); } catch { /* offline */ }
}

// ---------- opening ----------
const blobs = new Map<string, Promise<Blob>>();
const sizes = new Map<string, number>();
const CACHE = 300e6;

/** Where a file's pieces come from: your own Drive, or a share (a friend's, or a link's). */
export interface Source { owner: string; tag: string; chunk: (file: string, i: number) => Promise<string> }
const own = (): Source => ({ owner: me(), tag: '', chunk: (f, i) => sdk().api<{ body: string }>(`/api/drive/chunk?file=${f}&i=${i}`).then((r) => r.body) });
/** A share's files: through its public routes, which hand out only what's in it. `get` is the fetch to use. */
export const shareSource = (id: string, owner: string, get: (path: string) => Promise<{ body: string }>): Source =>
  ({ owner, tag: id + ':', chunk: (f, i) => get(`/api/drive/public/chunk?id=${id}&file=${f}&i=${i}`).then((r) => r.body) });

/** A file's contents, fetched and opened on this device (kept for a while, so opening it again is instant). */
export function fileBlob(e: Entry, src: Source = own()): Promise<Blob> {
  const k = src.tag + e.id;
  let p = blobs.get(k);
  if (p) { blobs.delete(k); blobs.set(k, p); return p; } // most recently used last
  p = fetchFile(e, src).finally(() => set((s) => { const f = { ...s.fetching }; delete f[e.id]; return { fetching: f }; }));
  blobs.set(k, p);
  p.then(() => {
    sizes.set(k, e.size ?? 0);
    // Over the limit: the least recently opened go (they're fetched again if opened again).
    let total = [...sizes.values()].reduce((a, b) => a + b, 0);
    for (const id of blobs.keys()) {
      if (total <= CACHE) break;
      if (id === k || !sizes.has(id)) continue;
      total -= sizes.get(id)!;
      forget(id);
    }
  }, () => blobs.delete(k));
  return p;
}

async function fetchFile(e: Entry, src: Source): Promise<Blob> {
  if (!e.key || !e.chunks) throw new Error('missing');
  const key = await C.aesKeyFrom(C.unb64(e.key));
  const n = e.chunks;
  const parts: Uint8Array[] = new Array(n);
  let next = 0, done = 0;
  set((s) => ({ fetching: { ...s.fetching, [e.id]: 0 } }));
  const worker = async () => {
    while (next < n) {
      const i = next++;
      const body = await withRetry(() => src.chunk(e.id, i));
      const box = C.unb64(body) as Uint8Array<ArrayBuffer>;
      parts[i] = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: box.subarray(0, 12), additionalData: aad(e.id, i, n, src.owner) }, key, box.subarray(12)));
      done++;
      set((s) => ({ fetching: { ...s.fetching, [e.id]: done / n } }));
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return new Blob(parts as BlobPart[], { type: e.mime || 'application/octet-stream' });
}

/** Save the file to this device's downloads. */
export async function download(e: Entry, src?: Source) {
  const blob = await fileBlob(e, src);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = e.name; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Hand the file to another app (the phone's share sheet), where the browser can. */
export async function shareFile(e: Entry, src?: Source) {
  const file = new File([await fileBlob(e, src)], e.name, { type: e.mime });
  await navigator.share({ files: [file], title: e.name });
}
export const canShare = () => typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([''], 'x.txt', { type: 'text/plain' })] });

const forget = (id: string) => { blobs.delete(id); sizes.delete(id); };

// ---------- sync ----------
const soon = () => { clearTimeout(timer); timer = setTimeout(() => void syncDrive(), 400) as unknown as number; };

/** Send this device's changes, then fetch the ones made elsewhere. Safe to call any time. */
export function syncDrive(): Promise<void> {
  if (running) { again = true; return running; }
  running = sync().catch(() => { /* offline: changes stay marked and go up on reconnect */ }).finally(() => {
    running = null;
    if (again) { again = false; void syncDrive(); }
  });
  return running;
}

async function sync() {
  await load();
  // Trash older than 30 days is emptied.
  const old = now() - TRASH_DAYS * 864e5;
  for (const x of all()) if (x.trashed && x.trashed < old && get().entries[x.id] && !get().entries[x.id].deleted) await deleteForever(x);

  let refused = 0;
  for (const x of Object.values(get().entries)) {
    if (!x.dirty) continue;
    let updated: number;
    try { ({ updated } = await sdk().api<{ updated: number }>(`/api/items?app=${APP}`, { id: x.id, body: x.deleted ? '' : x.box })); }
    catch (e) {
      if ((e as Error).name === 'NetworkError' || ++refused > 2) throw e;
      continue;
    }
    refused = 0;
    const cur = get().entries[x.id];
    if (!cur || cur.edited !== x.edited) continue; // changed again while sending: that goes next time
    if (x.deleted) await drop(x.id); else await keep({ ...cur, dirty: false, srv: updated });
  }

  const purge = (await sdk().store.get<string[]>(PURGE)) ?? [];
  if (purge.length) {
    const left: string[] = [];
    for (const file of purge) await sdk().api('/api/drive/delete', { file }).catch(() => left.push(file));
    await sdk().store.put(PURGE, left);
    void refreshUsage();
  }

  let since = (await sdk().store.get<number>(SINCE)) || 0;
  for (;;) {
    const r = await sdk().api<{ items: { id: string; body: string; updated: number }[]; more: boolean }>(`/api/items?app=${APP}&since=${since}`);
    await receive(r.items);
    if (r.items.length) since = r.items[r.items.length - 1].updated;
    await sdk().store.put(SINCE, since);
    if (!r.more) break;
  }
  await refreshShares();
}

// ---------- sharing ----------
// A share is a sealed list of what's in it (a file, or a folder and everything in it: names, keys,
// pictures), sealed with a random key of its own. A link carries that key after the # (never sent to
// the server); a friend gets it wrapped with the key the two of you share. The server keeps the sealed
// list and hands out only the pieces of the files on it. Your devices send the list again whenever
// what's in it changes, so it stays up to date; a removed friend means a new key.
const SHARE_HASH = 'app/drive/sharehash/';
const SHARE_APP = 'drive-share';
const b64url = (b: Uint8Array) => C.b64(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s: string) => C.unb64(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
const newShare = () => ({ id: C.randomId(16), key: b64url(crypto.getRandomValues(new Uint8Array(32))) });
const shareAad = (id: string) => new TextEncoder().encode(`drive-share|${id}`);
const THUMBS = 2_500_000; // characters of pictures a share's list may carry

/** What a share holds now: the item, and for a folder everything inside it that isn't in the Trash. */
export function manifest(root: Entry, owner: string, m: Record<string, Live> = get().entries): Manifest {
  if (inTrash(root, m) || !alive(m[root.id])) return { v: 1, owner, root: root.id, gone: true, items: [] };
  const inside = root.type === 'folder' ? descendants(root.id, m).filter((x) => !inTrash(x, m)) : [];
  let budget = THUMBS;
  const items = [root, ...inside].map((x) => {
    const y = clean({ ...x, starred: undefined, trashed: undefined, link: undefined, share: undefined });
    if (y.thumb && (budget -= y.thumb.length) < 0) delete y.thumb;
    return y;
  });
  return { v: 1, owner, root: root.id, items };
}

export async function sealShare(key: string, id: string, m: Manifest) {
  const k = await C.aesKeyFrom(unb64url(key));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: shareAad(id) }, k, new TextEncoder().encode(JSON.stringify(m))));
  const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12);
  return C.b64(out);
}
export async function openShare(key: string, id: string, box: string): Promise<Manifest | null> {
  const k = await C.aesKeyFrom(unb64url(key));
  const b = C.unb64(box) as Uint8Array<ArrayBuffer>;
  const o = JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.subarray(0, 12), additionalData: shareAad(id) }, k, b.subarray(12))));
  if (!o || o.v !== 1 || typeof o.owner !== 'string' || typeof o.root !== 'string' || !Array.isArray(o.items)) return null;
  const items = o.items.slice(0, 6000).map((x: any) => (x && typeof x.id === 'string' ? valid(x, x.id.slice(0, 40)) : null)).filter(Boolean) as Entry[];
  return { v: 1, owner: o.owner, root: o.root, gone: o.gone === true || undefined, items };
}

/** The link that opens a share, for anyone. */
export const shareUrl = (sh: { id: string; key: string }) => `${location.origin}/apps/drive/share.html#${sh.id}.${sh.key}`;
/** "#id.key" from a link, or null. */
export function parseShareHash(hash: string) {
  const m = /^#?([A-Za-z0-9_-]{16,40})\.([A-Za-z0-9_-]{40,50})$/.exec(hash.trim());
  return m ? { id: m[1], key: m[2] } : null;
}

async function pushShare(root: Entry, sh: { id: string; key: string }, force = false) {
  const m = manifest(root, me());
  const json = JSON.stringify(m);
  const hash = C.b64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sh.id + json))));
  if (!force && (await sdk().store.get<string>(SHARE_HASH + sh.id)) === hash) return;
  const files = m.items.filter((x) => x.type === 'file').map((x) => x.id);
  await sdk().api('/api/drive/link', { id: sh.id, box: await sealShare(sh.key, sh.id, m), files });
  await sdk().store.put(SHARE_HASH + sh.id, hash);
}
async function stopShare(id: string) {
  await sdk().api('/api/drive/link/delete', { id }).catch(() => {});
  await sdk().store.del(SHARE_HASH + id);
}

/** Every share of yours whose contents changed goes up again. */
async function refreshShares() {
  for (const x of all()) for (const sh of [x.link, x.share]) if (sh) await pushShare(x, sh).catch(() => {});
}

/** Turn the link on (returns it) or off. */
export async function setLink(e: Entry, on: boolean): Promise<string | null> {
  const cur = get().entries[e.id] ?? e;
  if (!on) {
    if (cur.link) await stopShare(cur.link.id);
    await save({ ...cur, link: undefined }, false);
    return null;
  }
  const link = cur.link ?? newShare();
  await pushShare(cur, link, true);
  await save({ ...cur, link }, false);
  return shareUrl(link);
}

/** Share with exactly these friends. Taking someone off makes a new key, so they can't open it again. */
export async function setPeople(e: Entry, people: string[]) {
  const cur = get().entries[e.id] ?? e;
  const was = cur.share;
  if (!people.length) {
    if (was) await stopShare(was.id);
    await save({ ...cur, share: undefined }, false);
    return;
  }
  const removed = (was?.to ?? []).filter((u) => !people.includes(u));
  const sh = was && !removed.length ? { id: was.id, key: was.key } : newShare();
  const fresh = sh.id !== was?.id;
  await pushShare(cur, sh, fresh);
  const add: { u: string; wrapped: string }[] = [];
  for (const u of people.filter((u) => fresh || !was!.to.includes(u))) {
    try { add.push({ u, wrapped: await C.encryptItem(await sdk().pairKey(u), { k: sh.key }, `${me()}>${u}`, SHARE_APP, sh.id) }); }
    catch { /* not a friend whose key is known: left out */ }
  }
  if (add.length) await sdk().api('/api/drive/link/to', { id: sh.id, add });
  if (fresh && was) await stopShare(was.id);
  await save({ ...cur, share: { ...sh, to: people.filter((u) => fresh ? add.some((a) => a.u === u) : true) } }, false);
}

/** What friends shared with me: each one's key unwrapped, its list fetched and opened. */
let sharing: Promise<void> | null = null;
export function loadShared(): Promise<void> {
  return (sharing ??= (async () => {
    const { shares } = await sdk().api<{ shares: { id: string; owner: string; wrapped: string; updated: number }[] }>('/api/drive/shared');
    const out: Shared[] = [];
    for (const r of shares) {
      try {
        const { k } = await C.decryptItem(await sdk().pairKey(r.owner), r.wrapped, `${r.owner}>${me()}`, SHARE_APP, r.id);
        const { box } = await sdk().api<{ box: string }>(`/api/drive/public?id=${r.id}`);
        const m = await openShare(k, r.id, box);
        if (m && !m.gone && m.owner === r.owner) out.push({ id: r.id, key: k, owner: r.owner, updated: r.updated, m });
      } catch { /* can't be opened here: left out */ }
    }
    set({ shared: out });
  })().catch(() => {}).finally(() => { sharing = null; }));
}

async function receive(rows: { id: string; body: string; updated: number }[]) {
  for (const row of rows) {
    const local = get().entries[row.id];
    if (local?.dirty) continue;
    if (local?.srv && local.srv >= row.updated) continue;
    if (!row.body) { if (local) { forget(row.id); await drop(row.id); } continue; }
    try {
      const x = await unseal(row.body, row.id);
      if (x) await keep({ ...x, box: row.body, srv: row.updated, dirty: false });
    } catch { /* not ours to read: skip */ }
  }
}

// From your own devices, but check the shape anyway so a bad one can't break anything.
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const opt = (v: unknown, max: number) => str(v, max) || undefined;
const int = (v: unknown) => (Number.isSafeInteger(v) && (v as number) >= 0 ? (v as number) : undefined);
export const NAME_MAX = 200;
const UNTITLED = 'Untitled'; // i18n-ok
export function valid(o: any, id: string): Entry | null {
  if (!o || typeof o !== 'object' || (o.type !== 'folder' && o.type !== 'file')) return null;
  const e: Entry = {
    id, type: o.type, name: str(o.name, NAME_MAX) || UNTITLED, parent: str(o.parent, 40), created: int(o.created) ?? 0, edited: int(o.edited) ?? 0,
    starred: o.starred === true || undefined, trashed: int(o.trashed) || undefined,
  };
  if (e.parent === id) e.parent = '';
  const sh = (v: any) => (v && typeof v.id === 'string' && /^[A-Za-z0-9_-]{16,40}$/.test(v.id) && typeof v.key === 'string' && /^[A-Za-z0-9_-]{40,50}$/.test(v.key) ? { id: v.id, key: v.key } : undefined);
  e.link = sh(o.link);
  const share = sh(o.share);
  if (share) e.share = { ...share, to: Array.isArray(o.share.to) ? o.share.to.filter((u: unknown) => typeof u === 'string' && /^[a-z0-9_.]{3,24}$/.test(u)).slice(0, 50) : [] };
  if (e.type === 'file') {
    Object.assign(e, {
      size: int(o.size) ?? 0, mime: str(o.mime, 200) || 'application/octet-stream', key: opt(o.key, 60), chunks: int(o.chunks),
      thumb: typeof o.thumb === 'string' && /^data:image\/(webp|jpeg|png);base64,/.test(o.thumb) ? o.thumb.slice(0, 50_000) : undefined,
      w: int(o.w), h: int(o.h), pages: int(o.pages), duration: int(o.duration),
    });
    if (!e.key || !e.chunks) return null;
  }
  return clean(e);
}
/** Only the record's own fields, with nothing empty (parent stays: '' is My Drive). */
const FIELDS = ['id', 'type', 'name', 'parent', 'created', 'edited', 'starred', 'trashed', 'size', 'mime', 'key', 'chunks', 'thumb', 'w', 'h', 'pages', 'duration', 'link', 'share'] as const;
function clean(x: Entry): Entry {
  const o: Record<string, unknown> = {};
  for (const k of FIELDS) { const v = x[k]; if (v !== undefined && (v !== '' || k === 'parent')) o[k] = v; }
  o.parent ??= '';
  return o as unknown as Entry;
}
