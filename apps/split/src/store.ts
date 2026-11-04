// Split's state on this device, and keeping it in step with the group's other members (and your
// other devices) through the server, which only ever sees sealed records.
//
// A group's key is made on the creator's device and wrapped for each member (with the key they share
// with whoever added them), so only members' devices can read anything. Records are saved here first
// (marked `dirty`) and sent when there's a connection; the server hands each device what changed
// since the last one it saw.
import { t, tk } from '@sanga/i18n';
import { create } from 'zustand';
import * as C from '@sanga/crypto';
import { sdk } from '@sanga/sdk';
import { prepareBill, type Bill } from './bills';
import { ACTIVITY_KINDS, BUILTIN_CATS, moveLedger, type Activity, type Expense, type Meta, type Person, type Record_, type Settlement, validDay } from './model';
import { activityFor } from './activity';

type Local<T> = T & { srv?: number; dirty?: boolean };
export interface Member { u: string; owner: boolean }
export interface GroupData {
  gid: string;
  members: Member[];
  meta: Local<Meta> | null;
  expenses: Record<string, Local<Expense>>;
  settles: Record<string, Local<Settlement>>;
  activity: Record<string, Local<Activity>>;
}
interface ListEntry { gid: string; wrapper: string; wrapped: string; members: { u: string; owner: boolean }[] }

interface State { loaded: boolean; groups: Record<string, GroupData>; error: string; seen: Record<string, number> }
export const useSplit = create<State>(() => ({ loaded: false, groups: {}, error: '', seen: {} }));
const set = useSplit.setState;
const get = useSplit.getState;

const LIST = 'app/split/groups';
const REC = (gid: string, id: string) => `app/split/r/${gid}/${id}`;
const SINCE = (gid: string) => `app/split/since/${gid}`;
const SEEN = 'app/split/seen';
const BILL = (gid: string, id: string) => `app/split/bill/${gid}/${id}`;
const me = () => sdk().identity().me;

const blank = (gid: string, members: Member[] = []): GroupData => ({ gid, members, meta: null, expenses: {}, settles: {}, activity: {} });
const patch = (gid: string, fn: (g: GroupData) => GroupData) =>
  set((s) => ({ groups: { ...s.groups, [gid]: fn(s.groups[gid] ?? blank(gid)) } }));

// ---------- keys ----------
const keys = new Map<string, { raw: Uint8Array; key: CryptoKey }>();
let selfWrap: Promise<CryptoKey> | null = null;
function selfKey() {
  const { priv, pub } = sdk().identity();
  if (!priv) throw new Error(t('Not signed in'));
  return (selfWrap ??= C.appKey(priv, pub, 'split'));
}

async function groupKey(e: ListEntry) {
  const hit = keys.get(e.gid);
  if (hit) return hit;
  const wrapKey = e.wrapper === me() ? await selfKey() : await sdk().pairKey(e.wrapper);
  const raw = await C.unwrapKeyBytes(wrapKey, e.wrapped, e.wrapper, e.gid, me());
  const k = { raw, key: await C.aesKeyFrom(raw) };
  keys.set(e.gid, k);
  return k;
}
const keyFor = (gid: string) => {
  const k = keys.get(gid);
  if (!k) throw new Error(t('This group’s key isn’t on this device yet. Reconnect and try again.'));
  return k;
};

// ---------- on this device ----------
let started = false;
let loading: Promise<void> | null = null;

/** Load what's on this device, listen for changes from the others, sync on every reconnect. */
export function startSplit() {
  if (started) return;
  started = true;
  sdk().on('split', () => void syncSplit());
  sdk().onReady(() => void syncSplit());
  void load().then(() => syncSplit());
}

function load() {
  return (loading ??= (async () => {
    const [list, recs, seen] = await Promise.all([sdk().store.get<ListEntry[]>(LIST), sdk().store.prefix<Local<Record_> & { gid: string }>('app/split/r/'), sdk().store.get<Record<string, number>>(SEEN)]);
    const groups: Record<string, GroupData> = {};
    for (const e of list ?? []) groups[e.gid] = blank(e.gid, e.members);
    for (const r of recs) {
      const g = groups[r.gid];
      if (g) put(g, r);
    }
    cache = list ?? [];
    // On a device that has never synced, "no groups" isn't known yet: the first sync says (syncSplit).
    set((s) => ({ loaded: s.loaded || !!list, groups: { ...groups, ...s.groups }, seen: { ...(seen ?? {}), ...s.seen } }));
    // The keys: from the saved wrapped copies, so a group opens offline.
    await Promise.all(cache.map((e) => groupKey(e).catch(() => {})));
  })());
}
let cache: ListEntry[] = [];

function put(g: GroupData, r: Local<Record_> & { gid?: string }) {
  if (r.type === 'meta') g.meta = r;
  else if (r.type === 'expense') g.expenses[r.id] = r;
  else if (r.type === 'settle') g.settles[r.id] = r;
  else if (r.type === 'activity') g.activity[r.id] = r;
}

const keep = (gid: string, r: Local<Record_>) => {
  patch(gid, (g) => { const n = { ...g, expenses: { ...g.expenses }, settles: { ...g.settles }, activity: { ...g.activity } }; put(n, r); return n; });
  return sdk().store.put(REC(gid, r.id), { ...r, gid });
};
const drop = (gid: string, r: Record_) => {
  patch(gid, (g) => {
    const n = { ...g, expenses: { ...g.expenses }, settles: { ...g.settles }, activity: { ...g.activity } };
    if (r.type === 'expense') delete n.expenses[r.id]; else if (r.type === 'settle') delete n.settles[r.id]; else if (r.type === 'activity') delete n.activity[r.id];
    return n;
  });
  return sdk().store.del(REC(gid, r.id));
};

// ---------- changing things ----------
let timer = 0;
const soon = () => { clearTimeout(timer); timer = window.setTimeout(() => void syncSplit(), 600); };

/** Save an expense, settlement or the group's details: here first, then up to the server. */
export function save(gid: string, r: Record_) {
  if (r.type === 'activity') return;
  const g = get().groups[gid];
  const prev = r.type === 'meta' ? g?.meta : r.type === 'expense' ? g?.expenses[r.id] : g?.settles[r.id];
  const now = Date.now();
  // Who first added an expense, and when, stays through edits; `by` is whoever made this latest change.
  const rec = r.type === 'expense' ? { ...r, addedBy: (prev as Expense | undefined)?.addedBy ?? r.addedBy ?? me(), added: (prev as Expense | undefined)?.added ?? r.added ?? now } : r;
  // The history first: it is written whenever the change is, here and then up to the others.
  for (const a of activityFor(prev, rec, me(), now)) void keep(gid, { ...a, id: 'a' + C.randomId(8), dirty: true });
  void keep(gid, { ...rec, by: me(), edited: now, dirty: true } as Local<Record_>).then(soon);
}
export const removeRecord = (gid: string, r: Expense | Settlement) => save(gid, { ...r, deleted: true });
/** Whoever got the money says yes: from now on the payment counts. */
export const confirmPayment = (gid: string, s: Settlement) => { const { pending: _p, ...rest } = s; save(gid, rest); };

/** You've looked at the group's activity up to now. */
export function markSeen(gid: string) {
  const seen = { ...get().seen, [gid]: Date.now() };
  set({ seen });
  void sdk().store.put(SEEN, seen);
}

const newId = () => C.randomId(9);
export { newId };

const post = <T,>(path: string, body: unknown) => sdk().api<T>(path, body);

/** Make a group. Needs a connection: the server has to know it exists before anyone can be added. */
export async function createGroup(name: string, emoji: string, currency: string): Promise<string> {
  const gid = C.randomId(12);
  const { raw, key } = C.newStoryKey();
  const wrapped = await C.wrapStoryKey(await selfKey(), raw, me(), gid, me());
  await post('/api/split/create', { gid, wrapped });
  keys.set(gid, { raw, key: await key });
  const entry: ListEntry = { gid, wrapper: me(), wrapped, members: [{ u: me(), owner: true }] };
  cache = [...cache, entry];
  await sdk().store.put(LIST, cache);
  patch(gid, () => blank(gid, entry.members));
  save(gid, { type: 'meta', id: 'meta', name, emoji, currency, people: [{ id: me(), name: me(), u: me() }], cats: [], edited: 0 });
  return gid;
}

/** Add a friend: hand them the group key (wrapped for the two of you) and put them in the group's people. */
export async function addFriend(gid: string, u: string, name: string) {
  const { raw } = keyFor(gid);
  const wrapped = await C.wrapStoryKey(await sdk().pairKey(u), raw, me(), gid, u);
  await post('/api/split/add', { gid, u, wrapped });
  const meta = get().groups[gid]?.meta;
  if (!meta) return;
  const existing = meta.people.find((p) => p.u === u);
  const people = existing ? meta.people.map((p) => (p === existing ? { ...p, gone: undefined } : p)) : [...meta.people, { id: u, name, u }];
  save(gid, { ...meta, people: people as Person[] });
}

/** Someone who isn't on Sanga: just a name that can be in expenses. */
export function addPerson(gid: string, name: string) {
  const meta = get().groups[gid]?.meta;
  if (meta) save(gid, { ...meta, people: [...meta.people, { id: 'p' + C.randomId(6), name: name.trim() }] });
}

/** A name turned out to be a Sanga friend: they get the group (key wrapped for them), and everything the name
 *  paid, owed or settled moves onto their account. If they are already in the group the two are merged. */
export async function linkPerson(gid: string, pid: string, u: string, friendName: string) {
  const g = get().groups[gid];
  const meta = g?.meta;
  if (!g || !meta) return;
  const guest = meta.people.find((p) => p.id === pid && !p.u);
  if (!guest) throw new Error(t('That name is already linked.'));
  if (!g.members.some((m) => m.u === u)) {
    const { raw } = keyFor(gid);
    await post('/api/split/add', { gid, u, wrapped: await C.wrapStoryKey(await sdk().pairKey(u), raw, me(), gid, u) });
  }
  const existing = meta.people.find((p) => p.u === u);
  const target = existing ? existing.id : u;
  const now = Date.now();
  const moved = moveLedger(Object.values(g.expenses).filter((e) => !e.deleted), Object.values(g.settles).filter((s) => !s.deleted), pid, target);
  for (const r of moved) await keep(gid, { ...r, by: me(), edited: now, dirty: true });
  const people = existing
    ? meta.people.filter((p) => p.id !== pid).map((p) => (p === existing ? { ...p, gone: undefined } : p))
    : meta.people.map((p) => (p === guest ? { id: u, name: friendName, u } : p));
  await keep(gid, { ...meta, people: people as Person[], by: me(), edited: now, dirty: true } as Local<Record_>);
  await keep(gid, { type: 'activity', id: 'a' + C.randomId(8), kind: 'person_link', by: me(), ts: now, who: target, name: guest.name, dirty: true });
  soon();
}

/** Rename someone who isn't on Sanga. */
export function renamePerson(gid: string, pid: string, name: string) {
  const meta = get().groups[gid]?.meta;
  const n = name.trim();
  if (meta && n) save(gid, { ...meta, people: meta.people.map((p) => (p.id === pid && !p.u ? { ...p, name: n } : p)) });
}

/** Hide a name from the pickers (what they owe stays) or bring them back. */
export function archivePerson(gid: string, pid: string, archived: boolean) {
  const meta = get().groups[gid]?.meta;
  if (meta) save(gid, { ...meta, people: meta.people.map((p) => (p.id === pid && !p.u ? { ...p, gone: archived ? (true as const) : undefined } : p)) });
}

/** The creator takes a friend out of the group (they lose access); their past expenses stay. */
export async function removeFriend(gid: string, u: string) {
  await post('/api/split/remove', { gid, u });
  const meta = get().groups[gid]?.meta;
  if (meta) save(gid, { ...meta, people: meta.people.map((p) => (p.u === u ? { ...p, gone: true as const } : p)) });
}

/** Leave: this device forgets the group; the others keep it and see you as gone. */
export async function leaveGroup(gid: string) {
  const meta = get().groups[gid]?.meta;
  if (meta) {
    // Tell the others first (while still a member); best effort.
    try { await syncGroup(gid); } catch { /* offline: leaving still works */ }
    save(gid, { ...meta, people: meta.people.map((p) => (p.u === me() ? { ...p, gone: true as const } : p)) });
    try { await syncGroup(gid); } catch { /* ditto */ }
  }
  await post('/api/split/remove', { gid });
  await forget(gid);
  cache = cache.filter((e) => e.gid !== gid);
  await sdk().store.put(LIST, cache);
}

async function forget(gid: string) {
  keys.delete(gid);
  set((s) => { const groups = { ...s.groups }; delete groups[gid]; return { groups }; });
  const [recs] = await Promise.all([sdk().store.prefix<{ id: string }>(`app/split/r/${gid}/`)]);
  await Promise.all([...recs.map((r) => sdk().store.del(REC(gid, r.id))), sdk().store.del(SINCE(gid))]);
}

// ---------- bills ----------
/** Seal a bill photo and upload it; returns its id for the expense to carry. */
export async function uploadBill(gid: string, file: File): Promise<string> {
  const bill = await prepareBill(file);
  const id = 'b' + C.randomId(8);
  const body = await C.encryptItem(keyFor(gid).key, bill, gid, 'split-bill', id);
  await post(`/api/split/bill?gid=${gid}`, { id, body });
  await sdk().store.put(BILL(gid, id), bill);
  return id;
}

/** A bill to look at: from this device if it's been seen, else fetched and opened. */
export async function loadBill(gid: string, id: string): Promise<Bill> {
  const saved = await sdk().store.get<Bill>(BILL(gid, id));
  if (saved) return saved;
  const { body } = await sdk().api<{ body: string }>(`/api/split/bill?gid=${gid}&id=${id}`);
  const bill = await C.decryptItem(keyFor(gid).key, body, gid, 'split-bill', id) as Bill;
  if (typeof bill?.mime !== 'string' || typeof bill?.data !== 'string') throw new Error(t('That bill can’t be read'));
  await sdk().store.put(BILL(gid, id), bill);
  return bill;
}

export async function deleteBill(gid: string, id: string) {
  await sdk().store.del(BILL(gid, id));
  await post(`/api/split/bill/delete?gid=${gid}`, { id }).catch(() => {});
}

// ---------- sync ----------
let running: Promise<void> | null = null;
let again = false;
/** Send this device's changes, then fetch the ones made elsewhere. Safe to call any time. */
export function syncSplit(): Promise<void> {
  if (running) { again = true; return running; }
  running = sync().then(() => set({ error: '' }), () => { /* offline: changes stay marked and go up on reconnect */ }).finally(() => {
    running = null;
    if (!get().loaded) set({ loaded: true });
    if (again) { again = false; void syncSplit(); }
  });
  return running;
}

async function sync() {
  await load();
  const { groups } = await sdk().api<{ groups: ListEntry[] }>('/api/split');
  const ids = new Set(groups.map((g) => g.gid));
  for (const gid of Object.keys(get().groups)) if (!ids.has(gid)) await forget(gid); // removed from, or left on another device
  cache = groups;
  await sdk().store.put(LIST, groups);
  for (const e of groups) {
    try { await groupKey(e); } catch { set({ error: tk('Some groups can’t be opened yet. Their key needs your friend’s details; try again when you’re online.') }); continue; } // shown with t()
    patch(e.gid, (g) => ({ ...g, members: e.members }));
    if (get().seen[e.gid] === undefined) markSeen(e.gid); // its past isn't "new"
    await syncGroup(e.gid);
  }
}

const stamp = (r: Record_) => (r.type === 'activity' ? r.ts : r.edited);
const dirtyOf = (g: GroupData): Local<Record_>[] =>
  [...(g.meta ? [g.meta] : []), ...Object.values(g.expenses), ...Object.values(g.settles), ...Object.values(g.activity)].filter((r) => r.dirty);

const sealable = (r: Local<Record_>) => { const { srv: _s, dirty: _d, ...rest } = r as Local<Record_> & { gid?: string }; delete rest.gid; return rest; };

async function syncGroup(gid: string) {
  const k = keyFor(gid).key;
  for (const r of dirtyOf(get().groups[gid] ?? blank(gid))) {
    const deleted = 'deleted' in r && r.deleted;
    const body = deleted ? '' : await C.encryptItem(k, sealable(r), gid, 'split', r.id);
    const { updated } = await sdk().api<{ updated: number }>(`/api/split/records?gid=${gid}`, { id: r.id, body });
    const g = get().groups[gid];
    const now = r.type === 'meta' ? g?.meta : r.type === 'expense' ? g?.expenses[r.id] : r.type === 'settle' ? g?.settles[r.id] : g?.activity[r.id];
    if (!now || stamp(now) !== stamp(r)) continue; // changed again while sending: goes next time
    if (deleted) await drop(gid, r); else await keep(gid, { ...now, dirty: false, srv: updated });
  }
  let since: number = (await sdk().store.get<number>(SINCE(gid))) || 0;
  for (;;) {
    const r = await sdk().api<{ items: { id: string; body: string; updated: number }[]; more: boolean }>(`/api/split/records?gid=${gid}&since=${since}`);
    // A page is opened first and shown at once: totals don't tick up record by record.
    const got = (await Promise.all(r.items.map((row) => receive(gid, k, row)))).filter((x) => !!x);
    await apply(gid, got);
    if (r.items.length) since = r.items[r.items.length - 1].updated;
    await sdk().store.put(SINCE(gid), since);
    if (!r.more) break;
  }
}

type Change = { keep: Local<Record_> } | { drop: Record_ };
/** What a record from the server changes here, if anything. */
async function receive(gid: string, k: CryptoKey, row: { id: string; body: string; updated: number }): Promise<Change | null> {
  const g = get().groups[gid];
  const local = row.id === 'meta' ? g?.meta : g?.expenses[row.id] ?? g?.settles[row.id] ?? g?.activity[row.id];
  if (local?.dirty) return null;                          // this device's newer change goes up next
  if (local?.srv && local.srv >= row.updated) return null; // already have it
  if (!row.body) return local ? { drop: local } : null;
  try {
    const r = valid(await C.decryptItem(k, row.body, gid, 'split', row.id), row.id);
    return r ? { keep: { ...r, srv: row.updated } } : null;
  } catch { return null; } // not sealed with this group's key, or damaged: ignore it
}

/** Several changes to a group in one go: one redraw, then saved on this device. */
async function apply(gid: string, changes: Change[]) {
  if (!changes.length) return;
  const done: Change[] = [];
  patch(gid, (g) => {
    const n = { ...g, expenses: { ...g.expenses }, settles: { ...g.settles }, activity: { ...g.activity } };
    for (const c of changes) {
      if (!stillClean(g, 'keep' in c ? c.keep : c.drop)) continue;
      if ('keep' in c) put(n, c.keep);
      else if (c.drop.type === 'expense') delete n.expenses[c.drop.id]; else if (c.drop.type === 'settle') delete n.settles[c.drop.id]; else if (c.drop.type === 'activity') delete n.activity[c.drop.id];
      done.push(c);
    }
    return n;
  });
  await Promise.all(done.map((c) => ('keep' in c ? sdk().store.put(REC(gid, c.keep.id), { ...c.keep, gid }) : sdk().store.del(REC(gid, c.drop.id)))));
}
/** Changed here while the page was being opened: this device's change wins, and goes up next. */
const stillClean = (g: GroupData, r: Record_) => {
  const local = r.type === 'meta' ? g.meta : r.type === 'expense' ? g.expenses[r.id] : r.type === 'settle' ? g.settles[r.id] : g.activity[r.id];
  return !local?.dirty;
};

// ---------- what another member sent is checked before it's used ----------
const isStr = (x: unknown, max = 200): x is string => typeof x === 'string' && x.length <= max;
const isAmt = (x: unknown): x is number => Number.isSafeInteger(x) && (x as number) >= 0 && (x as number) < 1e13;
const isMoneyMap = (x: unknown): x is Record<string, number> =>
  !!x && typeof x === 'object' && Object.keys(x).length <= 100 && Object.entries(x).every(([k, v]) => isStr(k, 40) && Number.isSafeInteger(v));

function valid(x: any, id: string): Record_ | null {
  if (!x || typeof x !== 'object' || x.id !== id) return null;
  if (x.type === 'meta' && id === 'meta') {
    if (!isStr(x.name, 80) || !isStr(x.emoji, 16) || !isStr(x.currency, 8) || !Array.isArray(x.people) || x.people.length > 100) return null;
    const people = x.people.filter((p: any) => p && isStr(p.id, 40) && isStr(p.name, 60)).map((p: any) => ({ id: p.id, name: p.name, ...(isStr(p.u, 40) && { u: p.u }), ...(p.gone && { gone: true as const }) }));
    const cats = (Array.isArray(x.cats) ? x.cats : []).slice(0, 60).filter((c: any) => c && isStr(c.id, 40) && isStr(c.name, 40) && isStr(c.emoji, 16) && /^#[0-9a-f]{6}$/i.test(c.color))
      .map((c: any) => ({ id: c.id, name: c.name, emoji: c.emoji, color: c.color }));
    return { type: 'meta', id: 'meta', name: x.name, emoji: x.emoji, currency: x.currency, people, cats, edited: Number(x.edited) || 0 };
  }
  if (x.type === 'expense') {
    if (!isStr(x.desc, 200) || !isAmt(x.amount) || !isStr(x.cat, 40) || !validDay(x.date) || !isStr(x.paidBy, 40) || !['equal', 'exact', 'percent', 'shares'].includes(x.mode)
      || !isMoneyMap(x.owed) || !isMoneyMap(x.values) || !isStr(x.by, 40)) return null;
    return { type: 'expense', id, desc: x.desc, amount: x.amount, cat: x.cat, date: x.date, paidBy: x.paidBy, mode: x.mode, values: x.values, owed: x.owed,
      ...(isStr(x.notes, 1000) && x.notes && { notes: x.notes }), ...(isStr(x.bill, 40) && x.bill && { bill: x.bill }), by: x.by,
      ...(isStr(x.addedBy, 40) && x.addedBy && { addedBy: x.addedBy, added: Number(x.added) || 0 }), edited: Number(x.edited) || 0 };
  }
  if (x.type === 'settle') {
    if (!isStr(x.from, 40) || !isStr(x.to, 40) || !isAmt(x.amount) || !validDay(x.date) || !isStr(x.by, 40)) return null;
    return { type: 'settle', id, from: x.from, to: x.to, amount: x.amount, date: x.date, ...(isStr(x.note, 300) && x.note && { note: x.note }), ...(x.pending === true && { pending: true as const }), by: x.by, edited: Number(x.edited) || 0 };
  }
  if (x.type === 'activity') {
    if (!ACTIVITY_KINDS.includes(x.kind) || !isStr(x.by, 40) || !Number.isFinite(x.ts)) return null;
    const s = (v: unknown, n: number) => (isStr(v, n) && v ? v : undefined);
    const n = (v: unknown) => (isAmt(v) ? v : undefined);
    return clean<Activity>({ type: 'activity', id, kind: x.kind, by: x.by, ts: Number(x.ts), ref: s(x.ref, 40), desc: s(x.desc, 200), amount: n(x.amount), wasDesc: s(x.wasDesc, 200),
      wasAmount: n(x.wasAmount), who: s(x.who, 40), from: s(x.from, 40), to: s(x.to, 40), name: s(x.name, 80) });
  }
  return null;
}
const clean = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

export { BUILTIN_CATS };
