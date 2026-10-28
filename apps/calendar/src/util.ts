// Small helpers the calendar's screens share.
import { useMemo } from 'react';
import { addDays, observances, type Observance } from './panchang';
import { eventsByDay, useCal } from './model';

export const BRAND = 'linear-gradient(135deg, #fb923c, #f43f5e 55%, #be185d)';

export const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export const longDay = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const shortDay = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
export const monthTitle = (ym: string) => new Date(`${ym}-01T12:00:00`).toLocaleDateString([], { month: 'long', year: 'numeric' });

/** Festivals and fasts from `from` to `to` (YYYY-MM-DD), the kinds chosen in settings, by day. */
export function useObservances(from: string, to: string) {
  const place = useCal((s) => s.settings.place);
  const show = useCal((s) => s.settings.show);
  const style = useCal((s) => s.settings.monthStyle);
  return useMemo(() => {
    const years = [...new Set([Number(from.slice(0, 4)), Number(to.slice(0, 4))])];
    const map = new Map<string, Observance[]>();
    for (const o of years.flatMap((y) => observances(y, place, style))) {
      if (o.day < from || o.day > to || !show.includes(o.group)) continue;
      if (!map.has(o.day)) map.set(o.day, []);
      map.get(o.day)!.push(o);
    }
    return map;
  }, [from, to, place, show, style]);
}

/** Your events from `from` to `to`, by day. */
export function useEvents(from: string, to: string) {
  const events = useCal((s) => s.events);
  const place = useCal((s) => s.settings.place);
  return useMemo(() => eventsByDay(Object.values(events), from, to, place), [events, from, to, place]);
}

export function daysUntil(key: string, from: string) {
  return Math.round((new Date(`${key}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86400e3);
}
export const inWords = (n: number) => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`);

/** The days a month grid shows: whole weeks around the month. */
export function gridDays(ym: string, weekStart: 0 | 1) {
  const first = `${ym}-01`;
  const lead = (new Date(`${first}T12:00:00`).getDay() - weekStart + 7) % 7;
  const start = addDays(first, -lead);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}
