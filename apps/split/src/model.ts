// Split's data and arithmetic, with no UI and no network. Money is always a whole number of the
// currency's smallest unit (paise, cents), never a float, so shares always add up to the exact total.
//
// A group is a handful of sealed records: one 'meta' (name, people, categories) and one record per
// expense or settlement. Everything below works on the decrypted forms.

export type Mode = 'equal' | 'exact' | 'percent' | 'shares';

/** Someone in a group: a Sanga friend (`u` is their username) or just a name (not on Sanga). `gone`: left the
 *  group, but what they owe or are owed stays on the books. */
export interface Person { id: string; name: string; u?: string; gone?: true }

export interface Category { id: string; name: string; emoji: string; color: string }

export interface Meta {
  type: 'meta'; id: 'meta'; name: string; emoji: string; currency: string;
  people: Person[]; cats: Category[]; edited: number;
}

export interface Expense {
  type: 'expense'; id: string; desc: string;
  amount: number;                 // minor units
  cat: string;                    // a Category id
  date: string;                   // YYYY-MM-DD, the day it was spent
  paidBy: string;                 // Person id
  mode: Mode;
  values: Record<string, number>; // what was typed per person: minor units (exact), basis points (percent), weight (shares)
  owed: Record<string, number>;   // what each person owes, minor units; sums to `amount`
  notes?: string;
  bill?: string;                  // id of the sealed bill photo
  by: string;                     // username of whoever made the latest change
  addedBy?: string; added?: number; // who first added it, and when (kept through edits)
  edited: number; deleted?: boolean;
}

export interface Settlement {
  type: 'settle'; id: string; from: string; to: string; amount: number; date: string; note?: string;
  by: string; edited: number; deleted?: boolean;
}

/** One line of the group's history, never changed or removed: who did what, and when. */
export type ActivityKind = 'group_create' | 'group_rename' | 'person_add' | 'person_remove' | 'person_left' | 'category_add'
  | 'expense_add' | 'expense_edit' | 'expense_delete' | 'settle_add' | 'settle_undo' | 'person_link' | 'person_rename';
export interface Activity {
  type: 'activity'; id: string; kind: ActivityKind;
  by: string;                      // username of whoever did it
  ts: number;
  ref?: string;                    // the expense it is about
  desc?: string; amount?: number;  // what it was (an expense's description and total)
  wasDesc?: string; wasAmount?: number; // what an edit changed it from
  who?: string;                    // a Person id (added, removed, left)
  from?: string; to?: string;      // a payment
  name?: string;                   // a group or category name
}
export const ACTIVITY_KINDS: ActivityKind[] = ['group_create', 'group_rename', 'person_add', 'person_remove', 'person_left', 'category_add',
  'expense_add', 'expense_edit', 'expense_delete', 'settle_add', 'settle_undo', 'person_link', 'person_rename'];

export type Record_ = Meta | Expense | Settlement | Activity;

// ---------- linking a name to a real account ----------
/** Moves everything one person paid, owes or settled onto another (a name that turned out to be a Sanga
 *  account). Returns only the records that changed; totals stay exactly the same. A payment between the two
 *  becomes a payment to oneself, so it is dropped. */
export function moveLedger(expenses: Expense[], settles: Settlement[], from: string, to: string): (Expense | Settlement)[] {
  const move = (m: Record<string, number>) => {
    if (!(from in m)) return m;
    const { [from]: v, ...rest } = m;
    return { ...rest, [to]: (rest[to] ?? 0) + v };
  };
  const out: (Expense | Settlement)[] = [];
  for (const e of expenses) {
    if (e.paidBy !== from && !(from in e.owed) && !(from in e.values)) continue;
    out.push({ ...e, paidBy: e.paidBy === from ? to : e.paidBy, owed: move(e.owed), values: move(e.values) });
  }
  for (const s of settles) {
    const a = s.from === from ? to : s.from, b = s.to === from ? to : s.to;
    if (a === s.from && b === s.to) continue;
    out.push(a === b ? { ...s, from: a, to: b, deleted: true } : { ...s, from: a, to: b });
  }
  return out;
}

// ---------- across all groups ----------
export interface Standing { cur: string; get: number; owe: number; people: { key: string; name: string; u?: string; amount: number }[] }

/** What you are owed and what you owe over all your groups, per currency, and with whom (positive: they owe you). */
export function standing(groups: { currency: string; people: Person[]; expenses: Expense[]; settles: Settlement[] }[], me: string): Standing[] {
  const by = new Map<string, Standing & { map: Map<string, { key: string; name: string; u?: string; amount: number }> }>();
  for (const g of groups) {
    const self = g.people.find((p) => p.u === me || p.id === me)?.id ?? me;
    const net = balances(g.expenses, g.settles);
    const st = by.get(g.currency) ?? { cur: g.currency, get: 0, owe: 0, people: [], map: new Map() };
    by.set(g.currency, st);
    const mine = net[self] ?? 0;
    if (mine > 0) st.get += mine; else st.owe -= mine;
    for (const t of simplify(net)) {
      if (t.from !== self && t.to !== self) continue;
      const other = g.people.find((p) => p.id === (t.from === self ? t.to : t.from));
      if (!other) continue;
      const key = other.u ?? 'n:' + other.name.toLowerCase();
      const row = st.map.get(key) ?? { key, name: other.name, ...(other.u && { u: other.u }), amount: 0 };
      row.amount += t.to === self ? t.amount : -t.amount;
      st.map.set(key, row);
    }
  }
  return [...by.values()].map(({ map, ...st }) => ({ ...st, people: [...map.values()].filter((r) => r.amount !== 0).sort((a, b) => b.amount - a.amount) }))
    .sort((a, b) => b.get + b.owe - (a.get + a.owe));
}

// ---------- categories ----------
const C = (id: string, name: string, emoji: string, color: string): Category => ({ id, name, emoji, color });

/** Ready-made categories; each group can add its own. */
export const BUILTIN_CATS: Category[] = [
  C('trip', 'Trip', '🧳', '#0ea5e9'), C('flight', 'Flight', '✈️', '#3b82f6'), C('train', 'Train', '🚆', '#6366f1'),
  C('metro', 'Metro', '🚇', '#8b5cf6'), C('bus', 'Bus', '🚌', '#a855f7'), C('cab', 'Cab / Auto', '🚕', '#eab308'),
  C('fuel', 'Fuel', '⛽', '#f59e0b'), C('parking', 'Parking & tolls', '🅿️', '#78716c'), C('stay', 'Stay', '🏨', '#c026d3'),
  C('food', 'Food & drink', '🍽️', '#f97316'), C('cafe', 'Cafe & snacks', '☕', '#b45309'), C('groceries', 'Groceries', '🛒', '#22c55e'),
  C('gym', 'Gym & fitness', '🏋️', '#ef4444'), C('sports', 'Sports', '⚽', '#16a34a'), C('health', 'Health', '💊', '#10b981'),
  C('rent', 'Rent', '🏠', '#0891b2'), C('utilities', 'Utilities', '💡', '#14b8a6'), C('internet', 'Internet & phone', '📶', '#06b6d4'),
  C('subscriptions', 'Subscriptions', '🔁', '#7c3aed'), C('cards', 'Credit card bill', '💳', '#4f46e5'), C('lent', 'Lent', '🤝', '#059669'), C('borrowed', 'Borrowed', '🙏', '#dc2626'), C('entertainment', 'Entertainment', '🎬', '#ec4899'), C('party', 'Party & events', '🎉', '#f43f5e'),
  C('shopping', 'Shopping', '🛍️', '#e11d48'), C('gifts', 'Gifts', '🎁', '#d946ef'), C('education', 'Education', '🎓', '#2563eb'),
  C('travelmisc', 'Tickets & entry', '🎟️', '#0d9488'), C('pets', 'Pets', '🐾', '#65a30d'), C('repairs', 'Repairs', '🔧', '#64748b'),
  C('other', 'Other', '🧾', '#94a3b8'),
];

export const CAT_COLORS = ['#0ea5e9', '#22c55e', '#f97316', '#ec4899', '#8b5cf6', '#eab308', '#14b8a6', '#ef4444', '#6366f1', '#84cc16'];

/** Built-in plus the group's own, by id. An expense whose category is gone shows as "Other". */
export function categoryMap(custom: Category[] = []) {
  const m = new Map<string, Category>();
  for (const c of [...BUILTIN_CATS, ...custom]) m.set(c.id, c);
  return m;
}
export const catOf = (m: Map<string, Category>, id: string) => m.get(id) ?? m.get('other')!;

// ---------- money ----------
const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'CLP', 'UGX']);
export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'JPY', 'THB', 'NPR', 'LKR', 'BDT'];
const digits = (cur: string) => (ZERO_DECIMAL.has(cur) ? 0 : 2);

export function money(minor: number, cur: string, opts: { sign?: boolean; compact?: boolean } = {}) {
  const d = digits(cur);
  const v = Math.abs(minor) / 10 ** d;
  let s: string;
  try {
    s = new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, minimumFractionDigits: Number.isInteger(v) && opts.compact ? 0 : d, maximumFractionDigits: d }).format(v);
  } catch { s = `${cur} ${v.toFixed(d)}`; }
  return (minor < 0 ? '−' : opts.sign && minor > 0 ? '+' : '') + s;
}

/** "1,234.5" → 123450. Null if it isn't an amount. */
export function parseAmount(text: string, cur: string): number | null {
  const t = text.trim().replace(/,/g, '');
  if (!/^\d*\.?\d*$/.test(t) || t === '' || t === '.') return null;
  const d = digits(cur);
  const [whole, frac = ''] = t.split('.');
  if (frac.length > d) return null;
  const n = Number(whole || '0') * 10 ** d + Number(frac.padEnd(d, '0') || '0');
  return Number.isSafeInteger(n) ? n : null;
}
export const toInput = (minor: number, cur: string) => (minor / 10 ** digits(cur)).toFixed(digits(cur));

// ---------- splitting an amount ----------
/** Splits `total` in proportion to `weights` (whole numbers) using the largest-remainder method, so the
 *  parts always sum to exactly `total`. Ties go to the earlier person, so the result is the same everywhere. */
export function apportion(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (total * w) / sum);
  const out = exact.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (const [, i] of order) { if (left <= 0) break; out[i]++; left--; }
  return out;
}

/** What each of `ids` owes. `values` is what was typed: minor units (exact), basis points (percent, 10000
 *  = 100%) or weights (shares); ignored for equal. Returns an error message instead if it doesn't add up. */
export function splitAmount(amount: number, mode: Mode, ids: string[], values: Record<string, number>): { owed: Record<string, number> } | { error: string } {
  if (!ids.length) return { error: 'Pick at least one person to split with' };
  if (!(amount > 0)) return { error: 'Enter an amount' };
  let parts: number[];
  if (mode === 'equal') parts = apportion(amount, ids.map(() => 1));
  else if (mode === 'shares') {
    const w = ids.map((i) => values[i] ?? 0);
    if (w.some((x) => x < 0 || !Number.isInteger(x)) || w.every((x) => x === 0)) return { error: 'Give at least one person a share' };
    parts = apportion(amount, w);
  } else if (mode === 'percent') {
    const w = ids.map((i) => values[i] ?? 0);
    const sum = w.reduce((a, b) => a + b, 0);
    if (sum !== 10000) return { error: `Percentages add up to ${(sum / 100).toFixed(2).replace(/\.00$/, '')}%, not 100%` };
    parts = apportion(amount, w);
  } else {
    parts = ids.map((i) => values[i] ?? 0);
    const sum = parts.reduce((a, b) => a + b, 0);
    if (parts.some((x) => x < 0)) return { error: 'Amounts can’t be negative' };
    if (sum !== amount) return { error: sum < amount ? `${amount - sum} still to assign (in the smallest unit)` : 'The amounts add up to more than the total' };
  }
  return { owed: Object.fromEntries(ids.map((id, k) => [id, parts[k]])) };
}

// ---------- who owes whom ----------
/** Net position per person: positive is owed money, negative owes. Deleted records are ignored. */
export function balances(expenses: Expense[], settles: Settlement[]): Record<string, number> {
  const net: Record<string, number> = {};
  const add = (id: string, n: number) => { net[id] = (net[id] ?? 0) + n; };
  for (const e of expenses) {
    if (e.deleted) continue;
    add(e.paidBy, e.amount);
    for (const [id, n] of Object.entries(e.owed)) add(id, -n);
  }
  for (const s of settles) { if (s.deleted) continue; add(s.from, s.amount); add(s.to, -s.amount); }
  return net;
}

export interface Transfer { from: string; to: string; amount: number }

/** The fewest-ish payments that settle everyone (at most people − 1): the biggest debtor pays the biggest creditor. */
export function simplify(net: Record<string, number>): Transfer[] {
  const debtors = Object.entries(net).filter(([, n]) => n < 0).map(([id, n]) => ({ id, n: -n })).sort((a, b) => b.n - a.n || a.id.localeCompare(b.id));
  const creditors = Object.entries(net).filter(([, n]) => n > 0).map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n || a.id.localeCompare(b.id));
  const out: Transfer[] = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].n, creditors[j].n);
    if (pay > 0) out.push({ from: debtors[i].id, to: creditors[j].id, amount: pay });
    debtors[i].n -= pay; creditors[j].n -= pay;
    if (debtors[i].n === 0) i++;
    if (creditors[j].n === 0) j++;
  }
  return out;
}

// ---------- dates ----------
const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => ymd(new Date());
export const parseDay = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s: string, n: number) => { const d = parseDay(s); d.setDate(d.getDate() + n); return ymd(d); };
export const daysBetween = (a: string, b: string) => Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 864e5);
export const validDay = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d\d-\d\d$/.test(s) && ymd(parseDay(s)) === s;

export interface Range { from: string; to: string }
export type Preset = 'today' | 'week' | 'month' | 'last30' | 'lastMonth' | 'year' | 'all' | 'custom';

/** A date range for a named period (weeks start on Monday). 'all' is resolved by the caller from the data. */
export function rangeFor(p: Exclude<Preset, 'custom' | 'all'>, now = new Date()): Range {
  const t = ymd(now);
  switch (p) {
    case 'today': return { from: t, to: t };
    case 'week': return { from: addDays(t, -((now.getDay() + 6) % 7)), to: t };
    case 'month': return { from: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, to: t };
    case 'last30': return { from: addDays(t, -29), to: t };
    case 'lastMonth': {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1), last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: ymd(first), to: ymd(last) };
    }
    case 'year': return { from: `${now.getFullYear()}-01-01`, to: t };
  }
}

// ---------- spending statistics ----------
/** One amount spent: what the charts add up. */
export interface Line { id: string; group: string; date: string; cat: string; amount: number; desc: string }

/** The expenses as lines. `share`: only what `me` owes (their own spending); `total`: the whole bill. */
export function linesOf(group: string, expenses: Expense[], view: 'share' | 'total', me: string): Line[] {
  const out: Line[] = [];
  for (const e of expenses) {
    if (e.deleted) continue;
    const amount = view === 'total' ? e.amount : (e.owed[me] ?? 0);
    if (amount > 0) out.push({ id: e.id, group, date: e.date, cat: e.cat, amount, desc: e.desc });
  }
  return out;
}

export const inRange = (lines: Line[], r: Range) => lines.filter((l) => l.date >= r.from && l.date <= r.to);

export interface CatTotal { cat: string; total: number; count: number }
/** Totals per category, biggest first. */
export function byCategory(lines: Line[]): CatTotal[] {
  const m = new Map<string, CatTotal>();
  for (const l of lines) {
    const t = m.get(l.cat) ?? { cat: l.cat, total: 0, count: 0 };
    t.total += l.amount; t.count++;
    m.set(l.cat, t);
  }
  return [...m.values()].sort((a, b) => b.total - a.total || a.cat.localeCompare(b.cat));
}

export type Grain = 'day' | 'week' | 'month';
/** Day by day for up to ~6 weeks, week by week up to ~6 months, month by month beyond. */
export const grainFor = (r: Range): Grain => { const n = daysBetween(r.from, r.to) + 1; return n <= 45 ? 'day' : n <= 190 ? 'week' : 'month'; };

export interface Bucket { key: string; from: string; to: string; total: number }
const startOf = (day: string, g: Grain) => {
  if (g === 'day') return day;
  const d = parseDay(day);
  if (g === 'month') return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
  return addDays(day, -((d.getDay() + 6) % 7));
};
const nextStart = (s: string, g: Grain) => {
  if (g === 'day') return addDays(s, 1);
  if (g === 'week') return addDays(s, 7);
  const d = parseDay(s); return ymd(new Date(d.getFullYear(), d.getMonth() + 1, 1));
};

/** Spending per day / week / month across the range, empty periods included (so a bar chart has no gaps). */
export function series(lines: Line[], r: Range, g: Grain = grainFor(r)): Bucket[] {
  const out: Bucket[] = [];
  for (let s = startOf(r.from, g); s <= r.to; s = nextStart(s, g)) {
    const end = addDays(nextStart(s, g), -1);
    out.push({ key: s, from: s < r.from ? r.from : s, to: end > r.to ? r.to : end, total: 0 });
  }
  const index = new Map(out.map((b, i) => [b.key, i]));
  for (const l of lines) { const i = index.get(startOf(l.date, g)); if (i !== undefined) out[i].total += l.amount; }
  return out;
}

export const sum = (lines: Line[]) => lines.reduce((a, l) => a + l.amount, 0);
