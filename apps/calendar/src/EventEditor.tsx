// Add or change an event: what kind (event, birthday, holiday, fast, reminder), when (all day or
// times), how it repeats (by day, week, month, year, or every lunar month on a tithi), reminders,
// colour, place and notes. A repeating event can be deleted for one day or altogether.
import { useMemo, useState } from 'react';
import { Bell, Check, MapPin, Repeat as RepeatIcon } from 'lucide-react';
import { Button } from '@sanga/ui/button';
import { Dialog } from '@sanga/ui/dialog';
import { Input, Label, Textarea } from '@sanga/ui/input';
import { Switch } from '@sanga/ui/switch';
import { sdk } from '@sanga/sdk';
import { cn } from '@sanga/ui/utils';
import { locale, t, tk } from '@sanga/i18n';
import { RepeatPicker } from './RepeatPicker';
import { dayStart, tithiAt } from './panchang';
import { sunTimes } from './astro';
import { COLORS, describeRepeat, KINDS, remove, save, useCal, type CalEvent, type Kind } from './model';

const TIMED_REMINDERS: [number, string][] = [[0, tk('At the time')], [5, tk('5 min before')], [15, tk('15 min before')], [30, tk('30 min before')], [60, tk('1 hour before')], [120, tk('2 hours before')], [1440, tk('1 day before')], [2880, tk('2 days before')], [10080, tk('1 week before')]];
const ALLDAY_REMINDERS: [number, string][] = [[-540, tk('On the day, 9 AM')], [-420, tk('On the day, 7 AM')], [180, tk('Day before, 9 PM')], [900, tk('Day before, 9 AM')], [2340, tk('2 days before, 9 AM')], [9540, tk('1 week before, 9 AM')]];
const NEW_TITLE: Record<Kind, string> = { event: tk('New event'), birthday: tk('New birthday'), holiday: tk('New holiday'), fast: tk('New fast'), reminder: tk('New reminder') };

export function EventEditor({ event, day, onClose }: { event: CalEvent | null; day: string; onClose: () => void }) {
  const [e, setE] = useState<CalEvent | null>(event);
  const [repeatOpen, setRepeatOpen] = useState(false);
  if (event && (!e || e.id !== event.id)) setE(event);
  const place = useCal((s) => s.settings.place);
  const startDay = e?.start.slice(0, 10) || day;
  const tithi = useMemo(() => tithiAt(sunTimes(dayStart(startDay), place).rise), [startDay, place]);
  if (!event || !e) return null;
  const exists = !!useCal.getState().events[e.id];
  const set = (p: Partial<CalEvent>) => setE({ ...e, ...p });

  const setKind = (kind: Kind) => {
    const allDay = kind === 'birthday' || kind === 'holiday' || kind === 'fast' ? true : e.allDay;
    set({ kind, color: KINDS[kind].color, ...(allDay !== e.allDay && toAllDay(e, allDay)),
      ...(kind === 'birthday' && !e.repeat && { repeat: { freq: 'yearly', interval: 1 } }) });
  };
  const setStart = (start: string) => {
    // Keep the length: moving the start moves the end with it.
    const len = new Date(e.end.length > 10 ? e.end : `${e.end}T00:00`).getTime() - new Date(e.start.length > 10 ? e.start : `${e.start}T00:00`).getTime();
    const end = new Date(new Date(start.length > 10 ? start : `${start}T00:00`).getTime() + Math.max(0, len));
    const p = (n: number) => String(n).padStart(2, '0');
    const endKey = `${end.getFullYear()}-${p(end.getMonth() + 1)}-${p(end.getDate())}`;
    set({ start, end: e.allDay ? endKey : `${endKey}T${p(end.getHours())}:${p(end.getMinutes())}` });
  };

  const del = async () => {
    if (e.repeat && exists) {
      const one = await sdk().confirm({ title: t('Delete just this day?'), description: t('Only {date} is removed. The other days stay.', { date: new Date(`${day}T12:00:00`).toLocaleDateString(locale(), { day: 'numeric', month: 'long' }) }), confirmText: t('Delete this day') });
      if (one) { save({ ...useCal.getState().events[e.id], skip: [...(e.skip || []), day] }); onClose(); return; }
      if (!(await sdk().confirm({ title: t('Delete every day of it?'), description: t('The whole repeating event is removed.'), confirmText: t('Delete all'), destructive: true }))) return;
    } else if (!(await sdk().confirm({ title: t('Delete this event?'), confirmText: t('Delete'), destructive: true }))) return;
    remove(useCal.getState().events[e.id] || e);
    onClose();
  };

  const reminderOptions = e.allDay ? ALLDAY_REMINDERS : TIMED_REMINDERS;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={exists ? t('Edit') : t(NEW_TITLE[e.kind])} className="md:max-w-lg">
      <form className="grid gap-4" onSubmit={(ev) => { ev.preventDefault(); if (e.end < e.start) set({ end: e.start }); save({ ...e, end: e.end < e.start ? e.start : e.end }); onClose(); }}>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('Kind')}>
          {(Object.keys(KINDS) as Kind[]).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={e.kind === k} onClick={() => setKind(k)}
              className={cn('rounded-full border px-3 py-1.5 text-sm font-medium transition', e.kind === k ? 'border-accent bg-accent text-white' : 'border-line hover:bg-hover')}>
              {KINDS[k].emoji} {t(KINDS[k].label)}
            </button>
          ))}
        </div>
        <Input aria-label={t('Title')} autoFocus={!exists} value={e.title} maxLength={200} onChange={(x) => set({ title: x.target.value })}
          placeholder={e.kind === 'birthday' ? t('Whose birthday?') : e.kind === 'holiday' ? t('e.g. Family trip to Goa') : e.kind === 'fast' ? t('e.g. Monday fast') : t('Title')}
          className="h-12 text-lg font-semibold" />

        <div className="rounded-2xl border border-line/70 p-3">
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">{t('All day')}</span>
            <Switch checked={e.allDay} onCheckedChange={(v) => set(toAllDay(e, v))} label={t('All day')} />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div><Label htmlFor="ev-start">{e.allDay ? t('From') : t('Starts')}</Label>
              <Input id="ev-start" type={e.allDay ? 'date' : 'datetime-local'} value={e.start} required onChange={(x) => x.target.value && setStart(x.target.value)} /></div>
            <div><Label htmlFor="ev-end">{e.allDay ? t('To') : t('Ends')}</Label>
              <Input id="ev-end" type={e.allDay ? 'date' : 'datetime-local'} value={e.end} min={e.start} required onChange={(x) => x.target.value && set({ end: x.target.value })} /></div>
          </div>
        </div>

        <div className="rounded-2xl border border-line/70">
          <button type="button" onClick={() => setRepeatOpen(!repeatOpen)} aria-expanded={repeatOpen} className="flex w-full items-center gap-3 p-3 text-left">
            <RepeatIcon className="size-5 text-muted" />
            <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{t('Repeat')}</span><span className="block truncate text-sm text-muted">{describeRepeat(e.repeat, e.start)}</span></span>
          </button>
          {repeatOpen && <RepeatPicker e={e} tithi={tithi} onChange={(repeat) => set({ repeat })} />}
        </div>

        <fieldset className="rounded-2xl border border-line/70 p-3">
          <legend className="sr-only">{t('Reminders')}</legend>
          <p className="mb-2 flex items-center gap-2 text-sm font-medium"><Bell className="size-4 text-muted" />{t('Remind me')}</p>
          <div className="flex flex-wrap gap-1.5">
            {reminderOptions.map(([m, label]) => {
              const on = e.reminders.includes(m);
              return (
                <button key={m} type="button" aria-pressed={on} onClick={() => set({ reminders: on ? e.reminders.filter((x) => x !== m) : [...e.reminders, m].sort((a, b) => a - b).slice(0, 8) })}
                  className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm transition', on ? 'border-accent bg-accent/12 font-medium text-accent-ink' : 'border-line hover:bg-hover')}>
                  {on && <Check className="size-3.5" />}{t(label)}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div>
          <p className="mb-1.5 text-sm font-medium">{t('Colour')}</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('Colour')}>
            {Object.entries(COLORS).map(([k, c]) => (
              <button key={k} type="button" role="radio" aria-checked={e.color === k} aria-label={t(c.label)} onClick={() => set({ color: k })}
                className={cn('size-8 rounded-full ring-offset-2 ring-offset-panel transition', c.dot, e.color === k ? 'ring-2 ring-ink' : 'hover:scale-110')} />
            ))}
          </div>
        </div>

        <div className="relative">
          <MapPin className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input aria-label={t('Place')} value={e.location} maxLength={200} onChange={(x) => set({ location: x.target.value })} placeholder={t('Add a place')} className="pl-9" />
        </div>
        <Textarea aria-label={t('Notes')} rows={3} value={e.notes} maxLength={4000} onChange={(x) => set({ notes: x.target.value })} placeholder={t('Notes')} />

        <div className="flex items-center gap-2">
          {exists && <Button variant="ghost" className="text-danger" onClick={del}>{t('Delete')}</Button>}
          <Button variant="ghost" className="ml-auto" onClick={onClose}>{t('Cancel')}</Button>
          <Button type="submit" disabled={!e.title.trim() && e.kind !== 'holiday'}>{t('Save')}</Button>
        </div>
      </form>
    </Dialog>
  );
}

function toAllDay(e: CalEvent, allDay: boolean): Partial<CalEvent> {
  if (allDay === e.allDay) return {};
  const s = e.start.slice(0, 10), en = e.end.slice(0, 10);
  return allDay
    ? { allDay, start: s, end: en, reminders: [-540] }
    : { allDay, start: `${s}T09:00`, end: `${s === en ? s : en}T10:00`, reminders: [15] };
}
