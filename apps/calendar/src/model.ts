// The calendar's own records: events (with holidays, birthdays, fasts you plan and plain reminders
// among them), the fast log, and settings. Each is sealed on this device with a key only your own
// devices can derive (crypto.appKey), and synced through the server, which keeps only ciphertext,
// the same way the diary works. A readable copy stays on this device; changes made offline go up
// on reconnect. Everything outside this app comes through the Sanga SDK.
import { create } from 'zustand';
import * as C from '@sanga/crypto';
import { sdk } from '@sanga/sdk';
import { addDays, dayKey, dayStart, lunarMonth, tithiAt, type Group } from './panchang';
import type { Place } from './astro';

export type Kind = 'event' | 'birthday' | 'holiday' | 'fast' | 'reminder';
export type Freq = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'tithi';
export interface Repeat {
  freq: Freq;
  interval: number;           // every N days/weeks/months/years
  days?: number[];            // weekly: weekdays, 0 Sunday … 6 Saturday
  byWeekday?: boolean;        // monthly: "the 2nd Monday" rather than "the 14th"
  tithi?: number;             // tithi: 1–30, every lunar month
  until?: string;             // YYYY-MM-DD, last day it can happen
  count?: number;             // or after this many times
}
export interface CalEvent {
  id: string; type: 'event';
  kind: Kind;
  title: string;
  notes: string;
  location: string;
  color: string;              // a key of COLORS
  allDay: boolean;
  start: string;              // YYYY-MM-DD, or YYYY-MM-DDTHH:mm (local time)
  end: string;                // same form; for all-day events the last day
  repeat: Repeat | null;
  skip?: string[];            // days a repeating event doesn't happen
  reminders: number[];        // minutes before the start (all-day: before midnight, so -540 is 9 AM that day)
  created: number; edited: number;
  srv?: number; dirty?: boolean; deleted?: boolean;
}
export type FastStatus = 'planned' | 'kept' | 'partial' | 'broken';
export type FastType = 'nirjala' | 'phalahar' | 'one-meal' | 'water' | 'custom';
export interface FastLog {
  id: string; type: 'fast';
  day: string;                // YYYY-MM-DD
  name: string;               // "Nirjala Ekadashi", "Monday fast"…
  ref?: string;               // the observance it's for, if any
  status: FastStatus;
  fastType: FastType;
  notes: string;              // what you ate, how it went
  brokeAt?: string;           // HH:mm
  created: number; edited: number;
  srv?: number; dirty?: boolean; deleted?: boolean;
}
export interface Settings {
  id: typeof SETTINGS_ID; type: 'settings';
  place: Place & { name: string };
  monthStyle: 'purnimanta' | 'amanta';
  show: Group[];               // which kinds of festivals and fasts to show
  remindFasts: boolean;        // the evening before a fast you're showing
  fastTime: string;            // HH:mm
  remindFestivals: boolean;    // the morning of a festival
  festivalTime: string;
  remindParana: boolean;       // when to break an Ekadashi fast
  weekStart: 0 | 1;
  edited: number;
  srv?: number; dirty?: boolean; deleted?: boolean;
}
type Item = CalEvent | FastLog | Settings;

export const SETTINGS_ID = 'settings-v1';
export const DEFAULT_SETTINGS: Settings = {
  id: SETTINGS_ID, type: 'settings',
  place: { name: 'New Delhi', lat: 28.6139, lon: 77.209 },
  monthStyle: 'purnimanta',
  show: ['festivals', 'ekadashi', 'pradosh', 'sankashti', 'purnima', 'amavasya', 'shivratri', 'national'],
  remindFasts: true, fastTime: '19:00', remindFestivals: true, festivalTime: '07:00', remindParana: true,
  weekStart: 0, edited: 0,
};

export const COLORS: Record<string, { label: string; dot: string; soft: string; text: string }> = {
  teal: { label: 'Teal', dot: 'bg-teal-500', soft: 'bg-teal-500/12', text: 'text-teal-700 dark:text-teal-300' },
  blue: { label: 'Blue', dot: 'bg-sky-500', soft: 'bg-sky-500/12', text: 'text-sky-700 dark:text-sky-300' },
  violet: { label: 'Violet', dot: 'bg-violet-500', soft: 'bg-violet-500/12', text: 'text-violet-700 dark:text-violet-300' },
  pink: { label: 'Pink', dot: 'bg-pink-500', soft: 'bg-pink-500/12', text: 'text-pink-700 dark:text-pink-300' },
  red: { label: 'Red', dot: 'bg-red-500', soft: 'bg-red-500/12', text: 'text-red-700 dark:text-red-300' },
  orange: { label: 'Orange', dot: 'bg-orange-500', soft: 'bg-orange-500/12', text: 'text-orange-700 dark:text-orange-300' },
  amber: { label: 'Amber', dot: 'bg-amber-500', soft: 'bg-amber-500/12', text: 'text-amber-700 dark:text-amber-300' },
  green: { label: 'Green', dot: 'bg-green-500', soft: 'bg-green-500/12', text: 'text-green-700 dark:text-green-300' },
  slate: { label: 'Grey', dot: 'bg-slate-500', soft: 'bg-slate-500/12', text: 'text-slate-700 dark:text-slate-300' },
};
export const KINDS: Record<Kind, { label: string; emoji: string; color: string }> = {
  event: { label: 'Event', emoji: '📅', color: 'teal' },
  birthday: { label: 'Birthday', emoji: '🎂', color: 'pink' },
  holiday: { label: 'Holiday', emoji: '🏖️', color: 'red' },
  fast: { label: 'Fast', emoji: '🙏', color: 'amber' },
  reminder: { label: 'Reminder', emoji: '⏰', color: 'violet' },
};

interface CalState {
  events: Record<string, CalEvent>;
  fasts: Record<string, FastLog>;
  settings: Settings;
  loaded: boolean;
}
export const useCal = create<CalState>(() => ({ events: {}, fasts: {}, settings: DEFAULT_SETTINGS, loaded: false }));

// ---------- dates ----------
export const today = () => dayKey(new Date());
export const isTimed = (s: string) => s.length > 10;
/** A local date-time string as a timestamp. */
export const toMs = (s: string) => (isTimed(s) ? new Date(s).getTime() : dayStart(s));
const pad = (n: number) => String(n).padStart(2, '0');
export const toLocal = (ms: number) => { const d = new Date(ms); return `${dayKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };

export function newEvent(day: string, kind: Kind = 'event'): CalEvent {
  const allDay = kind === 'birthday' || kind === 'holiday' || kind === 'fast';
  // Today: the next hour (within the day); another day: 10 AM.
  const hour = day === today() ? Math.min(Math.max(new Date().getHours() + 1, 7), 22) : 10;
  const start = allDay ? day : `${day}T${pad(hour)}:00`;
  return {
    id: C.randomId(12), type: 'event', kind, title: '', notes: '', location: '', color: KINDS[kind].color, allDay,
    start, end: allDay ? day : `${day}T${pad(hour + 1)}:00`,
    repeat: kind === 'birthday' ? { freq: 'yearly', interval: 1 } : null,
    reminders: allDay ? (kind === 'holiday' ? [] : [-540]) : [15],
    created: Date.now(), edited: Date.now(),
  };
}
export function newFast(day: string, name: string, ref?: string): FastLog {
  return { id: C.randomId(12), type: 'fast', day, name, ref, status: day > today() ? 'planned' : 'kept', fastType: 'phalahar', notes: '', created: Date.now(), edited: Date.now() };
}

// ---------- repeating ----------
const daysBetween = (a: string, b: string) => Math.round((dayStart(b) - dayStart(a)) / 86400e3);
const nthWeekday = (key: string) => Math.ceil(Number(key.slice(8)) / 7);

/** The days (YYYY-MM-DD) an event starts on, from `from` to `to` inclusive. */
export function occurrences(e: CalEvent, from: string, to: string, place?: Place): string[] {
  const first = e.start.slice(0, 10);
  const span = Math.max(0, daysBetween(first, e.end.slice(0, 10)));
  const out: string[] = [];
  const r = e.repeat;
  if (!r) return first <= to && addDays(first, span) >= from ? [first] : [];
  const last = r.until && r.until < to ? r.until : to;
  const skip = new Set(e.skip || []);
  const interval = Math.max(1, r.interval || 1);
  let n = 0;
  const take = (key: string) => {
    if (key < first || key > last) return false;
    n++;
    if (r.count && n > r.count) return true; // stop
    if (addDays(key, span) >= from && !skip.has(key)) out.push(key);
    return false;
  };
  const [fy, fm, fd] = first.split('-').map(Number);
  if (r.freq === 'daily') {
    for (let k = first; k <= last; k = addDays(k, interval)) if (take(k)) break;
  } else if (r.freq === 'weekly') {
    const days = r.days?.length ? r.days : [new Date(dayStart(first)).getDay()];
    const weekOf = (k: string) => addDays(k, -new Date(dayStart(k)).getDay());
    for (let w = weekOf(first); w <= last; w = addDays(w, 7 * interval)) {
      let stop = false;
      for (const d of [...days].sort()) if (take(addDays(w, d))) { stop = true; break; }
      if (stop) break;
    }
  } else if (r.freq === 'monthly') {
    const wd = new Date(dayStart(first)).getDay(), nth = nthWeekday(first);
    for (let i = 0; ; i += interval) {
      const y = fy + Math.floor((fm - 1 + i) / 12), m = (fm - 1 + i) % 12;
      if (dayKey(new Date(y, m, 1)) > last) break;
      let key: string | null;
      if (r.byWeekday) {
        const firstWd = (wd - new Date(y, m, 1).getDay() + 7) % 7 + 1;
        const day = firstWd + (nth - 1) * 7;
        key = day <= new Date(y, m + 1, 0).getDate() ? dayKey(new Date(y, m, day)) : null;
      } else key = fd <= new Date(y, m + 1, 0).getDate() ? dayKey(new Date(y, m, fd)) : null; // no 31 June: skipped
      if (key && take(key)) break;
    }
  } else if (r.freq === 'yearly') {
    for (let y = fy; ; y += interval) {
      const leap = fm === 2 && fd === 29 && new Date(y, 1, 29).getMonth() !== 1;
      const key = dayKey(new Date(y, fm - 1, leap ? 28 : fd)); // 29 Feb: the 28th in other years
      if (key > last) break;
      if (take(key)) break;
    }
  } else if (r.freq === 'tithi' && r.tithi && place) {
    // Every lunar month, the day this tithi holds at sunrise (or begins). Months are found from new moons.
    let t = Math.max(dayStart(first), dayStart(from) - 40 * 86400e3);
    for (let guard = 0; guard < 400 && dayKey(new Date(t)) <= last; guard++) {
      const m = lunarMonth(t);
      for (let d = 0; d < 31; d++) {
        const key = addDays(dayKey(new Date(m.start)), d);
        const rise = dayStart(key) + 6 * 3600e3;
        if (rise >= m.end) break;
        if (tithiAt(rise) === r.tithi) { if (take(key)) return out; break; }
      }
      t = m.end + 2 * 86400e3;
    }
  }
  return out;
}

/** When an occurrence starting on `day` begins and ends, as timestamps. */
export function occurrenceTimes(e: CalEvent, day: string) {
  const shift = daysBetween(e.start.slice(0, 10), day);
  if (e.allDay) return { start: dayStart(day), end: dayStart(addDays(day, Math.max(0, daysBetween(e.start, e.end)) + 1)) };
  const start = toMs(`${day}T${e.start.slice(11)}`);
  const end = toMs(`${addDays(e.end.slice(0, 10), shift)}T${e.end.slice(11)}`);
  return { start, end: Math.max(end, start) };
}

/** Events touching each day from `from` to `to`: day -> [{ event, first }] (`first`: it starts that day). */
export function eventsByDay(events: CalEvent[], from: string, to: string, place: Place) {
  const map = new Map<string, { e: CalEvent; startDay: string }[]>();
  for (const e of events) {
    if (e.deleted) continue;
    const span = Math.max(0, daysBetween(e.start.slice(0, 10), e.end.slice(0, 10)));
    for (const s of occurrences(e, from, to, place)) {
      for (let i = 0; i <= span; i++) {
        const k = addDays(s, i);
        if (k < from || k > to) continue;
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push({ e, startDay: s });
      }
    }
  }
  for (const list of map.values()) list.sort((a, b) => Number(b.e.allDay) - Number(a.e.allDay) || a.e.start.slice(11).localeCompare(b.e.start.slice(11)));
  return map;
}

export function describeRepeat(r: Repeat | null, start: string) {
  if (!r) return 'Does not repeat';
  const n = Math.max(1, r.interval || 1);
  const d = new Date(dayStart(start.slice(0, 10)));
  const wd = d.toLocaleDateString([], { weekday: 'long' });
  const every = (one: string, many: string) => (n === 1 ? `Every ${one}` : `Every ${n} ${many}`);
  let s: string;
  switch (r.freq) {
    case 'daily': s = every('day', 'days'); break;
    case 'weekly': s = every('week', 'weeks') + ' on ' + (r.days?.length ? r.days.map((x) => WEEKDAYS[x].slice(0, 3)).join(', ') : wd); break;
    case 'monthly': s = every('month', 'months') + (r.byWeekday ? ` on the ${ORD[nthWeekday(start.slice(0, 10)) - 1]} ${wd}` : ` on the ${ordinal(d.getDate())}`); break;
    case 'yearly': s = every('year', 'years') + ' on ' + d.toLocaleDateString([], { day: 'numeric', month: 'long' }); break;
    case 'tithi': s = `Every lunar month on ${r.tithi ? (r.tithi <= 15 ? 'Shukla ' : 'Krishna ') + TITHI_SHORT(r.tithi) : 'this tithi'}`; break;
  }
  if (r.until) s += `, until ${new Date(dayStart(r.until)).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}`;
  else if (r.count) s += `, ${r.count} times`;
  return s;
}
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ORD = ['first', 'second', 'third', 'fourth', 'fifth'];
const ordinal = (n: number) => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
const TITHI_SHORT = (n: number) => (n === 15 ? 'Purnima' : n === 30 ? 'Amavasya' : ['Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi',
  'Saptami', 'Ashtami', 'Navami', 'Dashami', 'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi'][(n - 1) % 15]);

// ---------- on this device ----------
const KEY = 'app/calendar/item/';
let started = false;
/** Load what's on this device, listen for changes from your other devices, sync on every reconnect. */
export function startCalendar() {
  if (started) return;
  started = true;
  sdk().on('calendar', () => void syncCalendar());
  sdk().onReady(() => void syncCalendar());
  void load().then(() => syncCalendar());
}

let loading: Promise<void> | null = null;
export function load() {
  return (loading ??= sdk().store.prefix<Item>(KEY).then((list) => {
    const events: Record<string, CalEvent> = {}, fasts: Record<string, FastLog> = {};
    let settings: Settings | null = null;
    for (const x of list) {
      if (x.type === 'event') events[x.id] = x;
      else if (x.type === 'fast') fasts[x.id] = x;
      else if (x.type === 'settings') settings = { ...DEFAULT_SETTINGS, ...x };
    }
    useCal.setState((s) => ({ loaded: true, events: { ...events, ...s.events }, fasts: { ...fasts, ...s.fasts }, settings: settings ?? s.settings }));
  }));
}

function keep(x: Item) {
  useCal.setState((s) => (x.type === 'event' ? { events: { ...s.events, [x.id]: x } } : x.type === 'fast' ? { fasts: { ...s.fasts, [x.id]: x } } : { settings: x }));
  return sdk().store.put(KEY + x.id, x);
}
function drop(x: Item) {
  useCal.setState((s) => {
    if (x.type === 'event') { const events = { ...s.events }; delete events[x.id]; return { events }; }
    if (x.type === 'fast') { const fasts = { ...s.fasts }; delete fasts[x.id]; return { fasts }; }
    return { settings: DEFAULT_SETTINGS };
  });
  return sdk().store.del(KEY + x.id);
}

const changed = new Set<() => void>();
/** Run after any change (here or synced in): reminders are recomputed then. */
export const onChange = (fn: () => void) => { changed.add(fn); return () => changed.delete(fn); };
const notify = () => changed.forEach((f) => f());

export function save(x: Item) { keep({ ...x, edited: Date.now(), dirty: true } as Item).then(() => { notify(); soon(); }); }
export function remove(x: CalEvent | FastLog) { keep({ ...x, deleted: true, dirty: true, edited: Date.now() }).then(() => { notify(); soon(); }); }
export const saveSettings = (patch: Partial<Settings>) => save({ ...useCal.getState().settings, ...patch });

// ---------- sync ----------
let timer = 0;
const soon = () => { clearTimeout(timer); timer = window.setTimeout(() => void syncCalendar(), 600); };

let key: Promise<CryptoKey> | null = null;
function calKey() {
  const { priv, pub } = sdk().identity();
  if (!priv) throw new Error('Not signed in');
  return (key ??= C.appKey(priv, pub, 'calendar'));
}

let running: Promise<void> | null = null;
let again = false;
/** Send this device's changes, then fetch the ones made elsewhere. Safe to call any time. */
export function syncCalendar(): Promise<void> {
  if (running) { again = true; return running; }
  running = sync().catch(() => { /* offline: changes stay marked and go up on reconnect */ }).finally(() => {
    running = null;
    if (again) { again = false; void syncCalendar(); }
  });
  return running;
}

const all = (): Item[] => { const s = useCal.getState(); return [...Object.values(s.events), ...Object.values(s.fasts), s.settings]; };
const sealed = (x: Item) => { const { srv: _s, dirty: _d, ...rest } = x; return rest; };

async function sync() {
  await load();
  const { me } = sdk().identity();
  const k = await calKey();
  let got = false;
  for (const x of all()) {
    if (!x.dirty) continue;
    const body = x.deleted ? '' : await C.encryptItem(k, sealed(x), me, 'calendar', x.id);
    const { updated } = await sdk().api<{ updated: number }>('/api/items?app=calendar', { id: x.id, body });
    const now = all().find((y) => y.id === x.id);
    if (!now || now.edited !== x.edited) continue; // changed again while sending: that goes next time
    if (x.deleted) await drop(x); else await keep({ ...now, dirty: false, srv: updated } as Item);
  }
  let since: number = (await sdk().store.get('app/calendar/since')) || 0;
  for (;;) {
    const r = await sdk().api<{ items: { id: string; body: string; updated: number }[]; more: boolean }>(`/api/items?app=calendar&since=${since}`);
    for (const row of r.items) got = (await receive(k, me, row)) || got;
    if (r.items.length) since = r.items[r.items.length - 1].updated;
    await sdk().store.put('app/calendar/since', since);
    if (!r.more) break;
  }
  if (got) notify();
}

async function receive(k: CryptoKey, me: string, row: { id: string; body: string; updated: number }) {
  const local = all().find((x) => x.id === row.id);
  if (local?.dirty) return false;                        // this device's newer change goes up next
  if (local?.srv && local.srv >= row.updated) return false; // already have it
  if (!row.body) { if (local) await drop(local); return !!local; }
  try {
    const x = valid(await C.decryptItem(k, row.body, me, 'calendar', row.id), row.id);
    if (!x) return false;
    await keep({ ...x, srv: row.updated } as Item);
    return true;
  } catch { return false; } // not readable with this key: skip it
}

// From your own devices, but check the shape anyway so a bad one can't break the calendar.
const DATE = /^\d{4}-\d\d-\d\d(T\d\d:\d\d)?$/;
function valid(o: any, id: string): Item | null {
  if (!o || typeof o !== 'object') return null;
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
  const num = (v: unknown) => (Number.isSafeInteger(v) ? (v as number) : 0);
  if (o.type === 'settings' && id === SETTINGS_ID) return { ...DEFAULT_SETTINGS, ...o, id: SETTINGS_ID, type: 'settings', edited: num(o.edited) };
  if (o.type === 'fast' && typeof o.day === 'string' && DATE.test(o.day)) {
    return { id, type: 'fast', day: o.day.slice(0, 10), name: str(o.name, 120), ref: str(o.ref, 80) || undefined,
      status: ['planned', 'kept', 'partial', 'broken'].includes(o.status) ? o.status : 'kept',
      fastType: ['nirjala', 'phalahar', 'one-meal', 'water', 'custom'].includes(o.fastType) ? o.fastType : 'custom',
      notes: str(o.notes, 4000), brokeAt: /^\d\d:\d\d$/.test(o.brokeAt) ? o.brokeAt : undefined, created: num(o.created), edited: num(o.edited) };
  }
  if (o.type === 'event' && DATE.test(o.start) && DATE.test(o.end)) {
    const r = o.repeat;
    const repeat: Repeat | null = r && ['daily', 'weekly', 'monthly', 'yearly', 'tithi'].includes(r.freq) ? {
      freq: r.freq, interval: Math.min(99, Math.max(1, num(r.interval) || 1)),
      ...(Array.isArray(r.days) && { days: r.days.filter((d: unknown) => Number.isInteger(d) && (d as number) >= 0 && (d as number) < 7) }),
      ...(r.byWeekday && { byWeekday: true }), ...(Number.isInteger(r.tithi) && r.tithi >= 1 && r.tithi <= 30 && { tithi: r.tithi }),
      ...(typeof r.until === 'string' && /^\d{4}-\d\d-\d\d$/.test(r.until) && { until: r.until }), ...(num(r.count) > 0 && { count: Math.min(999, num(r.count)) }),
    } : null;
    return { id, type: 'event', kind: o.kind in KINDS ? o.kind : 'event', title: str(o.title, 200), notes: str(o.notes, 4000), location: str(o.location, 200),
      color: o.color in COLORS ? o.color : 'teal', allDay: !!o.allDay, start: o.start, end: o.end, repeat,
      skip: Array.isArray(o.skip) ? o.skip.filter((d: unknown) => typeof d === 'string' && /^\d{4}-\d\d-\d\d$/.test(d)).slice(0, 500) : undefined,
      reminders: Array.isArray(o.reminders) ? o.reminders.filter((m: unknown) => Number.isInteger(m) && Math.abs(m as number) < 60 * 24 * 60).slice(0, 8) : [],
      created: num(o.created), edited: num(o.edited) };
  }
  return null;
}
