// Your saved logins. Each is sealed with a key only your devices can derive (crypto.appKey 'passwords')
// and synced through the server, which sees only ciphertext, like the other apps' records. Unlike
// them, the copy on this device stays sealed too: passwords are only ever readable in memory while
// the app is open.
import { create } from 'zustand';
import * as C from '@sanga/crypto';
import { sdk } from '@sanga/sdk';

export interface Login {
  id: string;
  title: string;
  url?: string;
  username?: string;
  password?: string;
  notes?: string;
  created: number;
  edited: number;
}
/** On this device: the login sealed, and where it stands with the server. */
interface Kept { id: string; box: string; edited: number; srv?: number; dirty?: boolean; deleted?: boolean }
type Live = Login & { srv?: number; dirty?: boolean; deleted?: boolean; box: string };

interface State { logins: Record<string, Live>; loaded: boolean; failed: boolean }
export const usePasswords = create<State>(() => ({ logins: {}, loaded: false, failed: false }));

const APP = 'passwords';
const KEY = 'app/passwords/item/';
const SINCE = 'app/passwords/since';
const now = () => Date.now();

export const newLogin = (over: Partial<Login> = {}): Login => ({ id: C.randomId(12), title: '', created: now(), edited: now(), ...over });
export const liveLogins = (s: State = usePasswords.getState()): Login[] =>
  Object.values(s.logins).filter((x) => !x.deleted).sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));

// ---------- links ----------
/** What to open for a saved link: http(s) only ("example.com" becomes https://example.com), else null. */
export function href(url?: string): string | null {
  const s = (url ?? '').trim();
  if (!s) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s.replace(/^\/+/, '')}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch { return null; }
}
/** "accounts.google.com" for a link, shown under the name. */
export function host(url?: string) {
  const h = href(url);
  return h ? new URL(h).host.replace(/^www\./, '') : (url ?? '').trim();
}

/** Matches a search on the name, the link or the username. */
export function matches(x: Login, q: string) {
  const s = q.trim().toLowerCase();
  return !s || [x.title, x.url, x.username].some((v) => v?.toLowerCase().includes(s));
}

/** A strong random password: letters, digits and a few symbols, with at least one of each. */
export function generate(length = 18) {
  const sets = ['abcdefghijkmnopqrstuvwxyz', 'ABCDEFGHJKLMNPQRSTUVWXYZ', '23456789', '!@#$%^&*-_=+?'];
  const all = sets.join('');
  // Rejection sampling, so every choice is equally likely.
  const below = (n: number) => { const lim = 2 ** 32 - (2 ** 32 % n), b = new Uint32Array(1); for (;;) { crypto.getRandomValues(b); if (b[0] < lim) return b[0] % n; } };
  const pick = (chars: string) => chars[below(chars.length)];
  const out = sets.map(pick);
  while (out.length < length) out.push(pick(all));
  for (let i = out.length - 1; i > 0; i--) { const j = below(i + 1); [out[i], out[j]] = [out[j], out[i]]; }
  return out.join('');
}

// ---------- on this device ----------
let started = false, loading: Promise<void> | null = null, running: Promise<void> | null = null, again = false, timer = 0;
let keyP: Promise<CryptoKey> | null = null;
function appKey() {
  const { priv, pub } = sdk().identity();
  if (!priv) throw new Error('Not signed in'); // i18n-ok
  return (keyP ??= C.appKey(priv, pub, APP));
}
const seal = async (x: Login) => C.encryptItem(await appKey(), clean(x), sdk().identity().me, APP, x.id);
const unseal = async (box: string, id: string) => valid(await C.decryptItem(await appKey(), box, sdk().identity().me, APP, id), id);

/** Load what's on this device, listen for changes from your other devices, sync on every reconnect. */
export function startPasswords() {
  if (started) return load();
  started = true;
  sdk().on(APP, () => void syncPasswords());
  sdk().onReady(() => void syncPasswords());
  return load().then(() => { void syncPasswords(); });
}

function load() {
  return (loading ??= (async () => {
    const kept = await sdk().store.prefix<Kept>(KEY);
    const got: Record<string, Live> = {};
    await Promise.all(kept.map(async (k) => {
      if (k.deleted) { got[k.id] = { ...blank(k.id), ...k, deleted: true }; return; }
      try { const x = await unseal(k.box, k.id); if (x) got[k.id] = { ...x, box: k.box, srv: k.srv, dirty: k.dirty }; } catch { /* not readable here: skip */ }
    }));
    usePasswords.setState((s) => ({ loaded: true, logins: { ...got, ...s.logins } }));
  })().catch((e) => { loading = null; usePasswords.setState({ failed: true, loaded: true }); throw e; }));
}
const blank = (id: string): Login => ({ id, title: '', created: 0, edited: 0 });

function keep(x: Live) {
  usePasswords.setState((s) => ({ logins: { ...s.logins, [x.id]: x } }));
  const k: Kept = { id: x.id, box: x.box, edited: x.edited, srv: x.srv, dirty: x.dirty, deleted: x.deleted };
  return sdk().store.put(KEY + x.id, k);
}
function drop(id: string) {
  usePasswords.setState((s) => { const m = { ...s.logins }; delete m[id]; return { logins: m }; });
  return sdk().store.del(KEY + id);
}

export async function saveLogin(x: Login) {
  const cur = usePasswords.getState().logins[x.id];
  const y = { ...x, edited: now() };
  await keep({ ...y, box: await seal(y), srv: cur?.srv, dirty: true });
  soon();
}
export async function removeLogin(x: Login) {
  const cur = usePasswords.getState().logins[x.id];
  if (!cur) return;
  if (!cur.srv) { await drop(x.id); return; } // never reached the server: nothing to tell it
  await keep({ ...blank(x.id), id: x.id, box: '', edited: now(), srv: cur.srv, dirty: true, deleted: true });
  soon();
}

// ---------- sync ----------
const soon = () => { clearTimeout(timer); timer = setTimeout(() => void syncPasswords(), 500) as unknown as number; };

/** Send this device's changes, then fetch the ones made elsewhere. Safe to call any time. */
export function syncPasswords(): Promise<void> {
  if (running) { again = true; return running; }
  running = sync().catch(() => { /* offline: changes stay marked and go up on reconnect */ }).finally(() => {
    running = null;
    if (again) { again = false; void syncPasswords(); }
  });
  return running;
}

async function sync() {
  await load();
  let refused = 0;
  for (const x of Object.values(usePasswords.getState().logins)) {
    if (!x.dirty) continue;
    let updated: number;
    try { ({ updated } = await sdk().api<{ updated: number }>(`/api/items?app=${APP}`, { id: x.id, body: x.deleted ? '' : x.box })); }
    catch (e) {
      if ((e as Error).name === 'NetworkError' || ++refused > 2) throw e;
      continue;
    }
    refused = 0;
    const cur = usePasswords.getState().logins[x.id];
    if (!cur || cur.edited !== x.edited) continue; // changed again while sending: that goes next time
    if (x.deleted) await drop(x.id); else await keep({ ...cur, dirty: false, srv: updated });
  }
  let since = (await sdk().store.get<number>(SINCE)) || 0;
  for (;;) {
    const r = await sdk().api<{ items: { id: string; body: string; updated: number }[]; more: boolean }>(`/api/items?app=${APP}&since=${since}`);
    await receive(r.items);
    if (r.items.length) since = r.items[r.items.length - 1].updated;
    await sdk().store.put(SINCE, since);
    if (!r.more) break;
  }
}

async function receive(rows: { id: string; body: string; updated: number }[]) {
  for (const row of rows) {
    const local = usePasswords.getState().logins[row.id];
    if (local?.dirty) continue;
    if (local?.srv && local.srv >= row.updated) continue;
    if (!row.body) { if (local) await drop(row.id); continue; }
    try {
      const x = await unseal(row.body, row.id);
      if (x) await keep({ ...x, box: row.body, srv: row.updated, dirty: false });
    } catch { /* not ours to read: skip */ }
  }
}

// From your own devices, but check the shape anyway so a bad one can't break anything.
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const opt = (v: unknown, max: number) => str(v, max) || undefined;
const int = (v: unknown) => (Number.isSafeInteger(v) ? (v as number) : 0);
export const LIMITS = { title: 80, url: 500, username: 200, password: 500, notes: 2000 };
export function valid(o: any, id: string): Login | null {
  if (!o || typeof o !== 'object') return null;
  return clean({ id, title: str(o.title, LIMITS.title), url: opt(o.url, LIMITS.url), username: opt(o.username, LIMITS.username),
    password: opt(o.password, LIMITS.password), notes: opt(o.notes, LIMITS.notes), created: int(o.created), edited: int(o.edited) });
}
function clean(x: Login): Login {
  const { id, url, username, password, notes, created, edited } = x;
  const title = x.title ?? '';
  return Object.fromEntries(Object.entries({ id, title, url, username, password, notes, created, edited }).filter(([k, v]) => k === 'title' || (v !== undefined && v !== ''))) as unknown as Login;
}
