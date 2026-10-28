// Reminders: this device works out what to remind you of over the next few weeks (your events,
// the evening before fasts, the morning of festivals, when to break an Ekadashi fast), seals each
// title so only your devices can read it, and gives the server the list. At the time the server
// sends a push (or a live message to an open Sanga), and your phone unseals and shows it.
// The list is replaced whenever something changes, and refreshed as the weeks move on.
import * as C from '@sanga/crypto';
import { sdk } from '@sanga/sdk';
import { addDays, observances } from './panchang';
import { eventsByDay, KINDS, occurrenceTimes, today, useCal, type CalEvent } from './model';

const HORIZON_DAYS = 45;
const MAX = 450;

export interface Upcoming { key: string; at: number; title: string; body: string }

const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const dayWord = (ms: number, at: number) => {
  const d = Math.round((new Date(ms).setHours(0, 0, 0, 0) - new Date(at).setHours(0, 0, 0, 0)) / 86400e3);
  return d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : new Date(ms).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' });
};
const atTime = (day: string, hhmm: string) => new Date(`${day}T${hhmm}`).getTime();

function eventBody(e: CalEvent, start: number, at: number) {
  const where = e.location ? ` · ${e.location}` : '';
  if (e.allDay) return dayWord(start, at) + where;
  const mins = Math.round((start - at) / 60e3);
  const lead = mins <= 0 ? 'Now' : mins < 60 ? `In ${mins} minutes` : mins < 24 * 60 && dayWord(start, at) === 'Today' ? `In ${Math.round(mins / 60)} hour${mins >= 90 ? 's' : ''}` : dayWord(start, at);
  return `${lead} · ${clock(start)}${where}`;
}

/** Everything to remind you of from now to HORIZON_DAYS ahead, soonest first. */
export function upcoming(now = Date.now()): Upcoming[] {
  const { events, fasts, settings: s } = useCal.getState();
  const from = addDays(today(), -1), to = addDays(today(), HORIZON_DAYS);
  const out: Upcoming[] = [];
  const push = (u: Upcoming) => { u.at = Math.round(u.at); if (u.at > now + 15e3 && u.at < now + HORIZON_DAYS * 86400e3) out.push(u); };

  const byDay = eventsByDay(Object.values(events), from, to, s.place);
  for (const [day, list] of byDay) {
    for (const { e, startDay } of list) {
      if (startDay !== day || !e.reminders.length) continue;
      const { start } = occurrenceTimes(e, day);
      const title = `${KINDS[e.kind].emoji} ${e.title || KINDS[e.kind].label}`;
      for (const off of e.reminders) {
        const at = start - off * 60e3;
        push({ key: `e|${e.id}|${day}|${off}`, at, title, body: eventBody(e, start, at) });
      }
    }
  }

  // Fasts and festivals from the Hindu calendar, as chosen in settings.
  const years = [...new Set([from, to].map((k) => Number(k.slice(0, 4))))];
  const obs = years.flatMap((y) => observances(y, s.place, s.monthStyle)).filter((o) => o.day >= from && o.day <= to && s.show.includes(o.group));
  for (const o of obs) {
    const extra = o.times?.find((t) => t.label === 'Moonrise');
    if (o.fast && s.remindFasts) {
      const eve = atTime(addDays(o.day, -1), s.fastTime);
      push({ key: `f|${o.id}`, at: eve, title: `${o.emoji} Tomorrow: ${o.name}`, body: extra ? `Moonrise ${clock(extra.at)}` : 'A fast day. Plan your meals tonight.' });
    }
    if ((o.group === 'festivals' || o.group === 'national') && s.remindFestivals) {
      push({ key: `m|${o.id}`, at: atTime(o.day, s.festivalTime), title: `${o.emoji} Today: ${o.name}`, body: o.about || (extra ? `Moonrise ${clock(extra.at)}` : 'Have a good one!') });
    }
    const parana = o.times?.find((t) => t.label.startsWith('Parana'));
    if (parana && s.remindParana) {
      push({ key: `p|${o.id}`, at: parana.at, title: '🍽️ Time to break your Ekadashi fast', body: `Parana until ${clock(parana.to || parana.at)}` });
    }
  }
  // Fasts you planned yourself (not already covered above).
  for (const f of Object.values(fasts)) {
    if (f.deleted || f.status !== 'planned' || f.ref || f.day < from || f.day > to) continue;
    push({ key: `l|${f.id}`, at: atTime(addDays(f.day, -1), s.fastTime), title: `🙏 Tomorrow: ${f.name || 'your fast'}`, body: 'A fast you planned.' });
  }
  return out.sort((a, b) => a.at - b.at).slice(0, MAX);
}

async function idOf(key: string) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)));
  return 'r' + C.b64(h.subarray(0, 16)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

let timer = 0;
/** Send the server the current list (soon, coalescing bursts of changes). */
export function scheduleReminders() {
  clearTimeout(timer);
  timer = window.setTimeout(() => void send().catch(() => { /* offline: next change or start tries again */ }), 1500);
}

async function send() {
  const { me, priv, pub } = sdk().identity();
  if (!priv || !useCal.getState().loaded) return;
  const list = upcoming();
  const sig = JSON.stringify(list.map((u) => [u.key, u.at, u.title, u.body]));
  const last = await sdk().store.get<{ sig: string; at: number }>('app/calendar/reminders');
  if (last?.sig === sig && Date.now() - last.at < 12 * 3600e3) return; // nothing new
  const key = await C.reminderKey(priv, pub);
  const sealed = await Promise.all(list.map(async (u) => {
    const id = await idOf(u.key);
    return { id, at: u.at, b: await C.sealReminder(key, { title: u.title, body: u.body }, me, id) };
  }));
  await sdk().api('/api/reminders', { list: sealed });
  await sdk().store.put('app/calendar/reminders', { sig, at: Date.now() });
}
