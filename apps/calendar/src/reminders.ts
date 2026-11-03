// Reminders: this device works out what to remind you of over the next few weeks (your events,
// the evening before fasts, the morning of festivals, when to break an Ekadashi fast), seals each
// title so only your devices can read it, and gives the server the list. At the time the server
// sends a push (or a live message to an open Sanga), and your phone unseals and shows it.
// The list is replaced whenever something changes, and refreshed as the weeks move on.
import * as C from '@sanga/crypto';
import { sdk } from '@sanga/sdk';
import { locale, t, tn } from '@sanga/i18n';
import { addDays, obsName, observances } from './panchang';
import { cardReminders } from './cards';
import { eventsByDay, KINDS, occurrenceTimes, today, useCal, type CalEvent } from './model';

const HORIZON_DAYS = 45;
const MAX = 450;

export interface Upcoming { key: string; at: number; title: string; body: string }

const clock = (ms: number) => new Date(ms).toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit' });
const dayWord = (ms: number, at: number) => {
  const d = Math.round((new Date(ms).setHours(0, 0, 0, 0) - new Date(at).setHours(0, 0, 0, 0)) / 86400e3);
  return d === 0 ? t('Today') : d === 1 ? t('Tomorrow') : new Date(ms).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'short' });
};
const atTime = (day: string, hhmm: string) => new Date(`${day}T${hhmm}`).getTime();

function eventBody(e: CalEvent, start: number, at: number) {
  const where = e.location ? ` · ${e.location}` : '';
  if (e.allDay) return dayWord(start, at) + where;
  const mins = Math.round((start - at) / 60e3);
  const lead = mins <= 0 ? t('Now') : mins < 60 ? t('In {n} minutes', { n: mins }) : mins < 24 * 60 && dayWord(start, at) === t('Today') ? tn(Math.round(mins / 60), 'In {n} hour', 'In {n} hours') : dayWord(start, at);
  return `${lead} · ${clock(start)}${where}`;
}

/** Everything to remind you of from now to HORIZON_DAYS ahead, soonest first. */
export function upcoming(now = Date.now()): Upcoming[] {
  const { events, fasts, cards, bills, settings: s } = useCal.getState();
  const from = addDays(today(), -1), to = addDays(today(), HORIZON_DAYS);
  const out: Upcoming[] = [];
  const push = (u: Upcoming) => { u.at = Math.round(u.at); if (u.at > now + 15e3 && u.at < now + HORIZON_DAYS * 86400e3) out.push(u); };

  const byDay = eventsByDay(Object.values(events), from, to, s.place);
  for (const [day, list] of byDay) {
    for (const { e, startDay } of list) {
      if (startDay !== day || !e.reminders.length) continue;
      const { start } = occurrenceTimes(e, day);
      const title = `${KINDS[e.kind].emoji} ${e.title || t(KINDS[e.kind].label)}`;
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
    const extra = o.times?.find((x) => x.label === 'Moonrise');
    if (o.fast && s.remindFasts) {
      const eve = atTime(addDays(o.day, -1), s.fastTime);
      push({ key: `f|${o.id}`, at: eve, title: `${o.emoji} ${t('Tomorrow: {name}', { name: obsName(o) })}`, body: extra ? t('Moonrise {time}', { time: clock(extra.at) }) : t('A fast day. Plan your meals tonight.') });
    }
    if ((o.group === 'festivals' || o.group === 'national') && s.remindFestivals) {
      push({ key: `m|${o.id}`, at: atTime(o.day, s.festivalTime), title: `${o.emoji} ${t('Today: {name}', { name: obsName(o) })}`, body: o.about ? t(o.about) : extra ? t('Moonrise {time}', { time: clock(extra.at) }) : t('Have a good one!') });
    }
    const parana = o.times?.find((x) => x.label.startsWith('Parana'));
    if (parana && s.remindParana) {
      push({ key: `p|${o.id}`, at: parana.at, title: `🍽️ ${t('Time to break your Ekadashi fast')}`, body: t('Parana until {time}', { time: clock(parana.to || parana.at) }) });
    }
  }
  // Fasts you planned yourself (not already covered above).
  for (const f of Object.values(fasts)) {
    if (f.deleted || f.status !== 'planned' || f.ref || f.day < from || f.day > to) continue;
    push({ key: `l|${f.id}`, at: atTime(addDays(f.day, -1), s.fastTime), title: `🙏 ${t('Tomorrow: {name}', { name: f.name || t('your fast') })}`, body: t('A fast you planned.') });
  }
  // Credit cards: asking for the bill on statement day, and reminding before the due date.
  for (const r of cardReminders(Object.values(cards), Object.values(bills), today())) push({ key: r.key, at: r.at, title: r.title, body: r.body });
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
