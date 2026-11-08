// The records behind Accounts, kept the way the Calendar keeps its own: a readable copy on this device,
// each record sealed with a key only your devices can derive (crypto.appKey 'accounts') and synced
// through the server, which sees only ciphertext. Split and the Calendar use this too (Split to take a
// payment out of the account it came from, the Calendar for bill reminders); every app bundles its
// own copy of this package, so the state lives on globalThis and they all share one.
import { create, type StoreApi, type UseBoundStore } from 'zustand';
import * as C from '@sanga/crypto';
import { sdk } from '@sanga/sdk';
import { addDays, asCard, billId, lastStatement, MAX_TXNS, statementId, suggestedDue, todayKey, type CardBill, type CardStatement, type CreditCard, type StatementTxn } from './cards';
import { NETWORKS, type Account, type AccountKind, type DebitCard, type Entry } from './types';

export type Item = Account | DebitCard | Entry | CardBill | CardStatement;
export interface LedgerState {
  accounts: Record<string, Account>;
  debits: Record<string, DebitCard>;
  entries: Record<string, Entry>;
  bills: Record<string, CardBill>;
  statements: Record<string, CardStatement>;
  loaded: boolean;
}
const EMPTY = (): LedgerState => ({ accounts: {}, debits: {}, entries: {}, bills: {}, statements: {}, loaded: false });

interface Shared {
  store: UseBoundStore<StoreApi<LedgerState>>;
  started: boolean; loading: Promise<void> | null; running: Promise<void> | null; again: boolean; timer: number;
  key: Promise<CryptoKey> | null; changed: Set<() => void>;
}
const G = globalThis as typeof globalThis & { __sangaLedger?: Shared };
const S: Shared = (G.__sangaLedger ??= { store: create<LedgerState>(EMPTY), started: false, loading: null, running: null, again: false, timer: 0, key: null, changed: new Set() });
export const useLedger = S.store;

export const COLORS = ['blue', 'teal', 'violet', 'pink', 'red', 'orange', 'amber', 'green', 'slate'] as const;
export const CARD_BG: Record<string, string> = {
  blue: 'linear-gradient(135deg, #0ea5e9, #1e3a8a)', teal: 'linear-gradient(135deg, #14b8a6, #134e4a)', violet: 'linear-gradient(135deg, #8b5cf6, #3b0764)',
  pink: 'linear-gradient(135deg, #ec4899, #831843)', red: 'linear-gradient(135deg, #f43f5e, #7f1d1d)', orange: 'linear-gradient(135deg, #f97316, #7c2d12)',
  amber: 'linear-gradient(135deg, #f59e0b, #78350f)', green: 'linear-gradient(135deg, #10b981, #064e3b)', slate: 'linear-gradient(135deg, #64748b, #0f172a)',
};

// ---------- making records ----------
const now = () => Date.now();
export function newAccount(kind: AccountKind, over: Partial<Account> = {}): Account {
  const base: Account = { id: C.randomId(12), type: 'account', kind, name: '', currency: 'INR', color: kind === 'cash' ? 'green' : kind === 'credit' ? 'violet' : kind === 'wallet' ? 'amber' : 'blue', opening: 0, created: now(), edited: now() };
  if (kind === 'credit') Object.assign(base, { statementDay: 1, dueAfter: 20, remind: [3, 1, 0], time: '09:00' });
  if (kind === 'bank') base.accType = 'savings';
  return { ...base, ...over };
}
export const newDebit = (account: string): DebitCard => ({ id: C.randomId(12), type: 'debit', account, name: '', created: now(), edited: now() });
export const newEntry = (kind: Entry['kind'], account: string, over: Partial<Entry> = {}): Entry =>
  ({ id: C.randomId(12), type: 'entry', kind, account, amount: 0, date: todayKey(), desc: '', created: now(), edited: now(), ...over });
/** A bill for the card's statement month, due when its usual gap says (change it to what the statement says). */
export function newBill(card: CreditCard, month: string): CardBill {
  return { id: billId(card.id, month), type: 'bill', card: card.id, month, amount: 0, due: suggestedDue(card, month), created: now(), edited: now() };
}

// ---------- reading ----------
export const live = <T extends { deleted?: boolean }>(xs: T[]) => xs.filter((x) => !x.deleted);
export const liveAccounts = (s: LedgerState = useLedger.getState()) => live(Object.values(s.accounts)).filter((a) => !a.archived);
/** Credit card accounts, with their bill settings filled in. */
export const creditCards = (s: LedgerState = useLedger.getState()) => liveAccounts(s).filter((a) => a.kind === 'credit').map(asCard);

/** A credit card's credit line: its own limit, or the one it shares with other cards of the bank
 *  (one card holds the limit; the others point at it). What's owed on all of them uses it up. */
export function creditLine(a: Account, s: LedgerState = useLedger.getState(), bal: Map<string, number> = balances(s)) {
  const w = a.limitWith && s.accounts[a.limitWith];
  const root = w && !w.deleted && w.kind === 'credit' ? w : a;
  const cards = liveAccounts(s).filter((x) => x.kind === 'credit' && (x.id === root.id || x.limitWith === root.id));
  if (!cards.some((x) => x.id === a.id)) cards.push(a);
  const owe = cards.reduce((n, x) => n + Math.max(0, -(bal.get(x.id) ?? 0)), 0);
  const limit = root.limit;
  return { limit, owe, available: limit ? Math.max(0, limit - owe) : undefined, root, others: cards.filter((x) => x.id !== a.id), shared: cards.length > 1 };
}

/** Each account's balance now: what it started with, plus everything since. A card's is negative while you owe. */
export function balances(s: LedgerState = useLedger.getState()): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of Object.values(s.accounts)) if (!a.deleted) m.set(a.id, a.opening);
  const add = (id: string | undefined, n: number) => { if (id && m.has(id)) m.set(id, m.get(id)! + n); };
  for (const e of Object.values(s.entries)) {
    if (e.deleted) continue;
    if (e.kind === 'in') add(e.account, e.amount);
    else if (e.kind === 'out') add(e.account, -e.amount);
    else if (e.kind === 'adjust') add(e.account, e.amount);
    else { add(e.account, -e.amount); add(e.to, e.amount); }
  }
  return m;
}
/** What an entry did to one account: + in, − out. */
export function effect(e: Entry, account: string) {
  if (e.kind === 'transfer') return e.to === account ? e.amount : e.account === account ? -e.amount : 0;
  if (e.account !== account) return 0;
  return e.kind === 'out' ? -e.amount : e.amount;
}
export const entriesOf = (account: string, s: LedgerState = useLedger.getState()) =>
  live(Object.values(s.entries)).filter((e) => e.account === account || e.to === account).sort((a, b) => b.date.localeCompare(a.date) || b.created - a.created);

/** Totals across accounts, per currency: money you have, what you owe on cards, and the two together. */
export function netWorth(s: LedgerState = useLedger.getState()) {
  const bal = balances(s);
  const out = new Map<string, { have: number; owe: number }>();
  for (const a of liveAccounts(s)) {
    const n = bal.get(a.id) ?? 0, t = out.get(a.currency) ?? { have: 0, owe: 0 };
    if (a.kind === 'credit') { if (n < 0) t.owe += -n; else t.have += n; } else t.have += n;
    out.set(a.currency, t);
  }
  return [...out.entries()].map(([currency, t]) => ({ currency, ...t, net: t.have - t.owe }));
}

// ---------- on this device ----------
const KEY = 'app/accounts/item/';
/** Load what's on this device, listen for changes from your other devices, sync on every reconnect. */
export function startLedger() {
  if (S.started) return load();
  S.started = true;
  sdk().on('accounts', () => void syncLedger());
  sdk().onReady(() => void syncLedger());
  return load().then(() => { void syncLedger(); });
}

export function load() {
  return (S.loading ??= sdk().store.prefix<Item>(KEY).then((list) => {
    const n = EMPTY();
    for (const x of list) put(n, x);
    useLedger.setState((s) => ({ loaded: true, accounts: { ...n.accounts, ...s.accounts }, debits: { ...n.debits, ...s.debits }, entries: { ...n.entries, ...s.entries }, bills: { ...n.bills, ...s.bills }, statements: { ...n.statements, ...s.statements } }));
  }));
}
const bucket = (x: Item): keyof Omit<LedgerState, 'loaded'> => (x.type === 'account' ? 'accounts' : x.type === 'debit' ? 'debits' : x.type === 'entry' ? 'entries' : x.type === 'bill' ? 'bills' : 'statements');
function put(s: LedgerState, x: Item) { (s[bucket(x)] as Record<string, Item>)[x.id] = x; }

function keep(x: Item) {
  const b = bucket(x);
  useLedger.setState((s) => ({ [b]: { ...s[b], [x.id]: x } }) as Partial<LedgerState>);
  return sdk().store.put(KEY + x.id, x);
}
function drop(x: Item) {
  const b = bucket(x);
  useLedger.setState((s) => { const m = { ...s[b] } as Record<string, Item>; delete m[x.id]; return { [b]: m } as Partial<LedgerState>; });
  return sdk().store.del(KEY + x.id);
}

/** Run after any change (here or synced in). */
export const onLedgerChange = (fn: () => void) => { S.changed.add(fn); return () => { S.changed.delete(fn); }; };
const notify = () => S.changed.forEach((f) => f());

export function save(x: Item) { return keep({ ...x, edited: now(), dirty: true } as Item).then(() => { notify(); soon(); }); }
export function remove(x: Item) { return keep({ ...x, deleted: true, dirty: true, edited: now() } as Item).then(() => { notify(); soon(); }); }

// ---------- what the screens do ----------
/** Set an account's balance to what it really is now: the difference is kept as a correction. */
export function setBalance(a: Account, target: number, date = todayKey(), desc = '') {
  const diff = target - (balances().get(a.id) ?? a.opening);
  if (!diff) return Promise.resolve();
  return save(newEntry('adjust', a.id, { amount: diff, date, desc }));
}

/** Remove an account: its debit cards, entries (a transfer stays with the other account as money in or out),
 *  bills and statements go too. */
export async function removeAccount(a: Account) {
  const s = useLedger.getState();
  for (const d of live(Object.values(s.debits))) if (d.account === a.id) await remove(d);
  for (const e of live(Object.values(s.entries))) {
    if (e.kind === 'transfer' && e.to === a.id) await save({ ...e, kind: 'out', to: undefined, desc: e.desc || a.name });
    else if (e.kind === 'transfer' && e.account === a.id && e.to) await save({ ...e, kind: 'in', account: e.to, to: undefined, desc: e.desc || a.name });
    else if (e.account === a.id) await remove(e);
  }
  for (const b of live(Object.values(s.bills))) if (b.card === a.id) await remove(b);
  for (const x of live(Object.values(s.statements))) if (x.card === a.id) await remove(x);
  // Cards that shared this one's limit: the first one holds it now, the others share with that one.
  const sharing = live(Object.values(s.accounts)).filter((x) => x.limitWith === a.id);
  if (sharing.length) {
    const [first, ...rest] = sharing;
    await save({ ...first, limitWith: undefined, limit: first.limit ?? a.limit });
    for (const x of rest) await save({ ...x, limitWith: first.id });
  }
  await remove(a);
}

/** Spent on a credit card since its last statement, so on the next bill: purchases and Split expenses
 *  paid with it, less refunds. Paying the bill isn't spending, so transfers don't count. */
export function unbilled(card: CreditCard, s: LedgerState = useLedger.getState(), now = todayKey()) {
  const imported = live(Object.values(s.statements)).filter((x) => x.card === card.id).map((x) => x.date).sort().pop();
  const cycle = lastStatement(card, now).date;
  const since = imported && imported > cycle ? imported : cycle;
  const list = live(Object.values(s.entries)).filter((e) => e.account === card.id && e.date > since && (e.kind === 'out' || e.kind === 'in'))
    .sort((a, b) => b.date.localeCompare(a.date) || b.created - a.created);
  return { since, list, total: list.reduce((n, e) => n + (e.kind === 'out' ? e.amount : -e.amount), 0) };
}

/** The entry recording a bill's payment, if it was paid from an account here. */
export const billPayment = (b: CardBill) => live(Object.values(useLedger.getState().entries)).find((e) => e.ref === `bill:${b.id}`);

/** Mark a bill paid; `from`: the account it was paid from (a transfer to the card), if you track it here. */
export async function payBill(b: CardBill, date: string, amount: number, from?: string) {
  await save({ ...b, paid: date, paidAmount: amount, none: undefined });
  const old = billPayment(b);
  if (!from) { if (old) await remove(old); return; }
  await save({ ...(old ?? newEntry('transfer', from)), kind: 'transfer', account: from, to: b.card, amount, date, desc: old?.desc ?? '', ref: `bill:${b.id}` });
}
export async function unpayBill(b: CardBill) {
  const { paid: _p, paidAmount: _a, ...rest } = b;
  await save(rest as CardBill);
  const old = billPayment(b);
  if (old) await remove(old);
}
/** No bill this month: nothing to pay, nothing to remind of. */
export const skipBill = (b: CardBill) => save({ ...b, amount: 0, minDue: undefined, paid: undefined, paidAmount: undefined, none: true });

// ---------- Split: the account a payment came from (yours only: never in the group's records) ----------
/** A short, stable id for what an entry records, so every device finds the same one. */
function refId(ref: string) {
  let h1 = 0x811c9dc5, h2 = 0x1b873593;
  for (let i = 0; i < ref.length; i++) { const c = ref.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 ^ c, 2246822519); }
  return 'r' + (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
}
export const linked = (ref: string) => { const e = useLedger.getState().entries[refId(ref)]; return e && !e.deleted ? e : undefined; };

/** Record (or change) the money a Split expense or payment took out of, or put into, one of your accounts. */
export function link(ref: string, e: { account: string; kind: 'in' | 'out'; amount: number; date: string; desc: string; cat?: string; via?: string }) {
  const id = refId(ref), old = useLedger.getState().entries[id];
  void sdk().store.put('app/accounts/last', e.via ? `d:${e.via}` : e.account);
  return save({ ...(old ?? newEntry(e.kind, e.account)), id, ...e, deleted: undefined, ref } as Entry);
}
export function unlink(ref: string) { const old = linked(ref); return old ? remove(old) : Promise.resolve(); }
/** The account (or "d:<debit card>") last paid from, to offer first next time. */
export const lastUsed = () => sdk().store.get<string>('app/accounts/last').catch(() => undefined);

// ---------- statements ----------
export interface StatementInput {
  card: CreditCard;            // saved here (new, or with its statement day and due gap updated)
  date: string; due?: string; from?: string;
  total: number; minDue?: number; limit?: number;
  txns: { date: string; desc: string; amount: number; credit: boolean; cat: string }[];
  setOutstanding?: boolean;    // make the card's balance what the statement says you owe
}
/** Save what was read from a statement: the card, its bill for that month (or "no bill" if nothing is due), and the statement. */
export async function saveStatement(x: StatementInput) {
  const month = x.date.slice(0, 7);
  await save(x.card);
  const s = useLedger.getState();
  const bid = billId(x.card.id, month);
  const old = s.bills[bid] && !s.bills[bid].deleted ? s.bills[bid] : undefined;
  const bill: CardBill = { ...(old ?? newBill(x.card, month)), amount: Math.max(0, x.total), due: x.due ?? old?.due ?? suggestedDue(x.card, month) };
  if (x.minDue) bill.minDue = x.minDue; else delete bill.minDue;
  if (x.total <= 0) { bill.none = true; bill.amount = 0; delete bill.minDue; } else delete bill.none;
  await save(bill);
  const txns: StatementTxn[] = fit(x.txns.slice(0, MAX_TXNS).map((t) => ({ d: t.date, t: t.desc.slice(0, 60), a: t.credit ? -t.amount : t.amount, c: t.cat })));
  const sid = statementId(x.card.id, month);
  await save({ id: sid, type: 'statement', card: x.card.id, month, date: x.date, ...(x.from && { from: x.from }), ...(x.due && { due: x.due }), total: x.total, ...(x.minDue && { minDue: x.minDue }), ...(x.limit && { limit: x.limit }), txns, created: s.statements[sid]?.created ?? now(), edited: now() });
  if (x.setOutstanding) await setBalance(x.card, -x.total, x.date);
  return { month, bill: bid, statement: sid };
}

/** A statement is one record, and the server takes records of up to 60 kB (sealed, so a third more):
 *  a very long one keeps its biggest lines, in date order. */
const TXN_BYTES = 38_000;
function fit(txns: StatementTxn[]) {
  const size = (t: StatementTxn) => new TextEncoder().encode(JSON.stringify(t)).length + 1;
  let total = txns.reduce((n, t) => n + size(t), 0);
  if (total <= TXN_BYTES) return txns;
  const keep = new Set(txns);
  for (const t of [...txns].sort((a, b) => Math.abs(a.a) - Math.abs(b.a))) { if (total <= TXN_BYTES) break; keep.delete(t); total -= size(t); }
  return txns.filter((t) => keep.has(t));
}

/** The last unpaid bill of a card, which a payment SMS pays. */
export function openBill(card: string) {
  return live(Object.values(useLedger.getState().bills)).filter((b) => b.card === card && !b.paid && !b.none).sort((a, b) => b.month.localeCompare(a.month))[0];
}

// ---------- moving the Calendar's cards here ----------
/** Credit cards and bills kept by the Calendar before Accounts existed: added here under the same ids
 *  (so two devices doing it at once make no copies). Returns those it took, for the Calendar to let go. */
export async function adopt(cards: Partial<Account>[], bills: CardBill[]) {
  await load();
  await syncLedger();
  const s = useLedger.getState();
  const took: string[] = [];
  for (const c of cards) {
    if (!c.id) continue;
    if (!s.accounts[c.id]) await save(newAccount('credit', { ...c, type: 'account', kind: 'credit', opening: 0, created: c.created ?? now() } as Partial<Account>));
    took.push(c.id);
  }
  for (const b of bills) {
    if (!s.bills[b.id]) await save({ ...b, type: 'bill' });
    took.push(b.id);
  }
  return took;
}

// ---------- sync ----------
const soon = () => { clearTimeout(S.timer); S.timer = setTimeout(() => void syncLedger(), 600) as unknown as number; };
function ledgerKey() {
  const { priv, pub } = sdk().identity();
  if (!priv) throw new Error('Not signed in'); // i18n-ok
  return (S.key ??= C.appKey(priv, pub, 'accounts'));
}

/** Send this device's changes, then fetch the ones made elsewhere. Safe to call any time. */
export function syncLedger(): Promise<void> {
  if (S.running) { S.again = true; return S.running; }
  S.running = sync().catch(() => { /* offline: changes stay marked and go up on reconnect */ }).finally(() => {
    S.running = null;
    if (S.again) { S.again = false; void syncLedger(); }
  });
  return S.running;
}

const all = (): Item[] => { const s = useLedger.getState(); return [...Object.values(s.accounts), ...Object.values(s.debits), ...Object.values(s.entries), ...Object.values(s.bills), ...Object.values(s.statements)]; };
const sealed = (x: Item) => { const { srv: _s, dirty: _d, ...rest } = x; return rest; };

async function sync() {
  await load();
  const { me } = sdk().identity();
  const k = await ledgerKey();
  let got = false, refused = 0;
  for (const x of all()) {
    if (!x.dirty) continue;
    const body = x.deleted ? '' : await C.encryptItem(k, sealed(x), me, 'accounts', x.id);
    let updated: number;
    try { ({ updated } = await sdk().api<{ updated: number }>('/api/items?app=accounts', { id: x.id, body })); }
    catch (e) {
      // One record refused (too big, say): the others still go, and changes still come in. No
      // connection, or the server refusing everything (asleep, busy): stop, and try again later.
      if ((e as Error).name === 'NetworkError' || ++refused > 2) throw e;
      continue;
    }
    refused = 0;

    const cur = all().find((y) => y.id === x.id);
    if (!cur || cur.edited !== x.edited) continue; // changed again while sending: that goes next time
    if (x.deleted) await drop(x); else await keep({ ...cur, dirty: false, srv: updated } as Item);
  }
  let since: number = (await sdk().store.get<number>('app/accounts/since')) || 0;
  for (;;) {
    const r = await sdk().api<{ items: { id: string; body: string; updated: number }[]; more: boolean }>(`/api/items?app=accounts&since=${since}`);
    got = (await receive(k, me, r.items)) || got;
    if (r.items.length) since = r.items[r.items.length - 1].updated;
    await sdk().store.put('app/accounts/since', since);
    if (!r.more) break;
  }
  if (got) notify();
}

/** A page of changes from your other devices: decrypted together, then put in place at once (one
 *  update of the screens, not one per record) and saved on this device side by side. */
async function receive(k: CryptoKey, me: string, rows: { id: string; body: string; updated: number }[]) {
  if (!rows.length) return false;
  const byId = new Map(all().map((x) => [x.id, x]));
  const got = await Promise.all(rows.map(async (row): Promise<Item | { gone: Item } | null> => {
    const local = byId.get(row.id);
    if (local?.dirty) return null;
    if (local?.srv && local.srv >= row.updated) return null;
    if (!row.body) return local ? { gone: local } : null;
    try {
      const x = valid(await C.decryptItem(k, row.body, me, 'accounts', row.id), row.id);
      return x ? ({ ...x, srv: row.updated } as Item) : null;
    } catch { return null; }
  }));
  const put: Item[] = [], gone: Item[] = [];
  for (const g of got) if (g) { if ('gone' in g) gone.push(g.gone); else put.push(g); }
  if (!put.length && !gone.length) return false;
  useLedger.setState((s) => {
    const n = { accounts: { ...s.accounts }, debits: { ...s.debits }, entries: { ...s.entries }, bills: { ...s.bills }, statements: { ...s.statements } };
    for (const x of put) (n[bucket(x)] as Record<string, Item>)[x.id] = x;
    for (const x of gone) delete (n[bucket(x)] as Record<string, Item>)[x.id];
    return n;
  });
  await Promise.all([...put.map((x) => sdk().store.put(KEY + x.id, x)), ...gone.map((x) => sdk().store.del(KEY + x.id))]);
  return true;
}

// From your own devices, but check the shape anyway so a bad one can't break anything.
const DAY = /^\d{4}-\d\d-\d\d$/;
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const opt = (v: unknown, max: number) => str(v, max) || undefined;
const int = (v: unknown) => (Number.isSafeInteger(v) ? (v as number) : 0);
const amt = (v: unknown) => (Number.isSafeInteger(v) && (v as number) >= 0 ? (v as number) : undefined);
const four = (v: unknown) => (typeof v === 'string' && /^\d{4}$/.test(v) ? v : undefined);
const clean = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

export function valid(o: any, id: string): Item | null {
  if (!o || typeof o !== 'object') return null;
  const base = { created: int(o.created), edited: int(o.edited) };
  if (o.type === 'account' && ['bank', 'credit', 'cash', 'wallet'].includes(o.kind)) {
    const day = Math.round(Number(o.statementDay));
    return clean<Account>({
      id, type: 'account', kind: o.kind, name: str(o.name, 60), bank: opt(o.bank, 60), currency: /^[A-Z]{3}$/.test(o.currency) ? o.currency : 'INR',
      color: COLORS.includes(o.color) ? o.color : 'blue', opening: int(o.opening), notes: opt(o.notes, 1000), archived: o.archived ? true : undefined,
      acc4: four(o.acc4), ifsc: /^[A-Z]{4}0[A-Z0-9]{6}$/.test(o.ifsc) ? o.ifsc : undefined, holder: opt(o.holder, 80),
      accType: ['savings', 'current', 'salary', 'nre', 'nro', 'other'].includes(o.accType) ? o.accType : undefined,
      limit: amt(o.limit), limitWith: opt(o.limitWith, 40), last4: four(o.last4), network: NETWORKS.includes(o.network) ? o.network : undefined,
      expiry: typeof o.expiry === 'string' && /^(0[1-9]|1[0-2])\/\d\d$/.test(o.expiry) ? o.expiry : undefined, nameOnCard: opt(o.nameOnCard, 80),
      statementDay: day >= 1 && day <= 31 ? day : undefined, dueAfter: Number.isInteger(o.dueAfter) && o.dueAfter >= 0 && o.dueAfter <= 60 ? o.dueAfter : undefined,
      remind: Array.isArray(o.remind) ? [...new Set<number>(o.remind.filter((n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 30))].slice(0, 6) : undefined,
      time: typeof o.time === 'string' && /^\d\d:\d\d$/.test(o.time) ? o.time : undefined, pdfPass: opt(o.pdfPass, 64), ...base,
    });
  }
  if (o.type === 'debit' && typeof o.account === 'string') {
    return clean<DebitCard>({ id, type: 'debit', account: o.account.slice(0, 40), name: str(o.name, 60), network: NETWORKS.includes(o.network) ? o.network : undefined,
      last4: four(o.last4), expiry: typeof o.expiry === 'string' && /^(0[1-9]|1[0-2])\/\d\d$/.test(o.expiry) ? o.expiry : undefined, nameOnCard: opt(o.nameOnCard, 80), notes: opt(o.notes, 1000), ...base });
  }
  if (o.type === 'entry' && ['in', 'out', 'transfer', 'adjust'].includes(o.kind) && typeof o.account === 'string' && DAY.test(o.date) && Number.isSafeInteger(o.amount)) {
    if (o.kind === 'transfer' && typeof o.to !== 'string') return null;
    return clean<Entry>({ id, type: 'entry', kind: o.kind, account: o.account.slice(0, 40), to: o.kind === 'transfer' ? o.to.slice(0, 40) : undefined,
      amount: o.kind === 'adjust' ? o.amount : Math.abs(o.amount), date: o.date, desc: str(o.desc, 120), cat: opt(o.cat, 30), via: opt(o.via, 40), ref: opt(o.ref, 120), ...base });
  }
  if (o.type === 'bill' && typeof o.card === 'string' && /^\d{4}-\d\d$/.test(o.month) && DAY.test(o.due)) {
    return clean<CardBill>({ id, type: 'bill', card: o.card.slice(0, 40), month: o.month, amount: amt(o.amount) ?? 0, minDue: amt(o.minDue), due: o.due,
      paid: DAY.test(o.paid) ? o.paid : undefined, paidAmount: DAY.test(o.paid) ? amt(o.paidAmount) : undefined, split: o.split ? true : undefined, none: o.none ? true : undefined, ...base });
  }
  if (o.type === 'statement' && typeof o.card === 'string' && /^\d{4}-\d\d$/.test(o.month) && DAY.test(o.date)) {
    const txns = Array.isArray(o.txns) ? o.txns.filter((x: any) => x && DAY.test(x.d) && Number.isSafeInteger(x.a) && typeof x.t === 'string')
      .slice(0, MAX_TXNS).map((x: any) => ({ d: x.d, t: x.t.slice(0, 60), a: x.a, c: str(x.c, 20) || 'other' })) : [];
    return clean<CardStatement>({ id, type: 'statement', card: o.card.slice(0, 40), month: o.month, date: o.date, from: DAY.test(o.from) ? o.from : undefined, due: DAY.test(o.due) ? o.due : undefined,
      total: int(o.total), minDue: amt(o.minDue), limit: amt(o.limit), txns, ...base });
  }
  return null;
}

export { addDays, todayKey };
