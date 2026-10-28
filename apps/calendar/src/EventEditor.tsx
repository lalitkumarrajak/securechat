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
import { addDays, dayStart, tithiAt, tithiName } from './panchang';
import { sunTimes } from './astro';
import { COLORS, describeRepeat, KINDS, remove, save, useCal, WEEKDAYS, type CalEvent, type Freq, type Kind, type Repeat } from './model';

const TIMED_REMINDERS: [number, string][] = [[0, 'At the time'], [5, '5 min before'], [15, '15 min before'], [30, '30 min before'], [60, '1 hour before'], [120, '2 hours before'], [1440, '1 day before'], [2880, '2 days before'], [10080, '1 week before']];
const ALLDAY_REMINDERS: [number, string][] = [[-540, 'On the day, 9 AM'], [-420, 'On the day, 7 AM'], [180, 'Day before, 9 PM'], [900, 'Day before, 9 AM'], [2340, '2 days before, 9 AM'], [9540, '1 week before, 9 AM']];

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
      const one = await sdk().confirm({ title: 'Delete just this day?', description: `Only ${new Date(`${day}T12:00:00`).toLocaleDateString([], { day: 'numeric', month: 'long' })} is removed. The other days stay.`, confirmText: 'Delete this day' });
      if (one) { save({ ...useCal.getState().events[e.id], skip: [...(e.skip || []), day] }); onClose(); return; }
      if (!(await sdk().confirm({ title: 'Delete every day of it?', description: 'The whole repeating event is removed.', confirmText: 'Delete all', destructive: true }))) return;
    } else if (!(await sdk().confirm({ title: 'Delete this event?', confirmText: 'Delete', destructive: true }))) return;
    remove(useCal.getState().events[e.id] || e);
    onClose();
  };

  const reminderOptions = e.allDay ? ALLDAY_REMINDERS : TIMED_REMINDERS;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={exists ? 'Edit' : `New ${KINDS[e.kind].label.toLowerCase()}`} className="md:max-w-lg">
      <form className="grid gap-4" onSubmit={(ev) => { ev.preventDefault(); if (e.end < e.start) set({ end: e.start }); save({ ...e, end: e.end < e.start ? e.start : e.end }); onClose(); }}>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Kind">
          {(Object.keys(KINDS) as Kind[]).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={e.kind === k} onClick={() => setKind(k)}
              className={cn('rounded-full border px-3 py-1.5 text-sm font-medium transition', e.kind === k ? 'border-accent bg-accent text-white' : 'border-line hover:bg-hover')}>
              {KINDS[k].emoji} {KINDS[k].label}
            </button>
          ))}
        </div>
        <Input aria-label="Title" autoFocus={!exists} value={e.title} maxLength={200} onChange={(x) => set({ title: x.target.value })}
          placeholder={e.kind === 'birthday' ? 'Whose birthday?' : e.kind === 'holiday' ? 'e.g. Family trip to Goa' : e.kind === 'fast' ? 'e.g. Monday fast' : 'Title'}
          className="h-12 text-lg font-semibold" />

        <div className="rounded-2xl border border-line/70 p-3">
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">All day</span>
            <Switch checked={e.allDay} onCheckedChange={(v) => set(toAllDay(e, v))} label="All day" />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div><Label htmlFor="ev-start">{e.allDay ? 'From' : 'Starts'}</Label>
              <Input id="ev-start" type={e.allDay ? 'date' : 'datetime-local'} value={e.start} required onChange={(x) => x.target.value && setStart(x.target.value)} /></div>
            <div><Label htmlFor="ev-end">{e.allDay ? 'To' : 'Ends'}</Label>
              <Input id="ev-end" type={e.allDay ? 'date' : 'datetime-local'} value={e.end} min={e.start} required onChange={(x) => x.target.value && set({ end: x.target.value })} /></div>
          </div>
        </div>

        <div className="rounded-2xl border border-line/70">
          <button type="button" onClick={() => setRepeatOpen(!repeatOpen)} aria-expanded={repeatOpen} className="flex w-full items-center gap-3 p-3 text-left">
            <RepeatIcon className="size-5 text-muted" />
            <span className="min-w-0 flex-1"><span className="block text-sm font-medium">Repeat</span><span className="block truncate text-sm text-muted">{describeRepeat(e.repeat, e.start)}</span></span>
          </button>
          {repeatOpen && <RepeatPicker e={e} tithi={tithi} onChange={(repeat) => set({ repeat })} />}
        </div>

        <fieldset className="rounded-2xl border border-line/70 p-3">
          <legend className="sr-only">Reminders</legend>
          <p className="mb-2 flex items-center gap-2 text-sm font-medium"><Bell className="size-4 text-muted" />Remind me</p>
          <div className="flex flex-wrap gap-1.5">
            {reminderOptions.map(([m, label]) => {
              const on = e.reminders.includes(m);
              return (
                <button key={m} type="button" aria-pressed={on} onClick={() => set({ reminders: on ? e.reminders.filter((x) => x !== m) : [...e.reminders, m].sort((a, b) => a - b).slice(0, 8) })}
                  className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm transition', on ? 'border-accent bg-accent/12 font-medium text-accent-ink' : 'border-line hover:bg-hover')}>
                  {on && <Check className="size-3.5" />}{label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div>
          <p className="mb-1.5 text-sm font-medium">Colour</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Colour">
            {Object.entries(COLORS).map(([k, c]) => (
              <button key={k} type="button" role="radio" aria-checked={e.color === k} aria-label={c.label} onClick={() => set({ color: k })}
                className={cn('size-8 rounded-full ring-offset-2 ring-offset-panel transition', c.dot, e.color === k ? 'ring-2 ring-ink' : 'hover:scale-110')} />
            ))}
          </div>
        </div>

        <div className="relative">
          <MapPin className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input aria-label="Place" value={e.location} maxLength={200} onChange={(x) => set({ location: x.target.value })} placeholder="Add a place" className="pl-9" />
        </div>
        <Textarea aria-label="Notes" rows={3} value={e.notes} maxLength={4000} onChange={(x) => set({ notes: x.target.value })} placeholder="Notes" />

        <div className="flex items-center gap-2">
          {exists && <Button variant="ghost" className="text-danger" onClick={del}>Delete</Button>}
          <Button variant="ghost" className="ml-auto" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!e.title.trim() && e.kind !== 'holiday'}>Save</Button>
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

function RepeatPicker({ e, tithi, onChange }: { e: CalEvent; tithi: number; onChange: (r: Repeat | null) => void }) {
  const r = e.repeat;
  const start = e.start.slice(0, 10);
  const wd = new Date(`${start}T12:00:00`).getDay();
  const nth = Math.ceil(Number(start.slice(8)) / 7);
  const pick = (freq: Freq | null, extra: Partial<Repeat> = {}) => onChange(freq ? { freq, interval: r?.freq === freq ? r.interval : 1, until: r?.until, count: r?.count, ...extra } : null);
  const opts: { label: string; on: boolean; go: () => void }[] = [
    { label: 'Does not repeat', on: !r, go: () => pick(null) },
    { label: 'Every day', on: r?.freq === 'daily', go: () => pick('daily') },
    { label: `Every week on ${WEEKDAYS[wd]}`, on: r?.freq === 'weekly', go: () => pick('weekly', { days: [wd] }) },
    { label: `Every month on the ${start.slice(8).replace(/^0/, '')}${['th', 'st', 'nd', 'rd'][Number(start.slice(8)) % 10 > 3 || [11, 12, 13].includes(Number(start.slice(8))) ? 0 : Number(start.slice(8)) % 10]}`, on: r?.freq === 'monthly' && !r.byWeekday, go: () => pick('monthly', { byWeekday: false }) },
    { label: `Every month on the ${['first', 'second', 'third', 'fourth', 'fifth'][nth - 1]} ${WEEKDAYS[wd]}`, on: r?.freq === 'monthly' && !!r.byWeekday, go: () => pick('monthly', { byWeekday: true }) },
    { label: `Every year on ${new Date(`${start}T12:00:00`).toLocaleDateString([], { day: 'numeric', month: 'long' })}`, on: r?.freq === 'yearly', go: () => pick('yearly') },
    { label: `Every lunar month on ${tithi <= 15 ? 'Shukla' : 'Krishna'} ${tithiName(tithi)} (Hindu calendar)`, on: r?.freq === 'tithi', go: () => pick('tithi', { tithi }) },
  ];
  const unit = r?.freq === 'daily' ? 'days' : r?.freq === 'weekly' ? 'weeks' : r?.freq === 'monthly' ? 'months' : r?.freq === 'yearly' ? 'years' : null;
  const ends = r?.until ? 'until' : r?.count ? 'count' : 'never';
  return (
    <div className="space-y-3 border-t border-line/70 p-3">
      <div className="grid gap-1" role="radiogroup" aria-label="Repeat">
        {opts.map((o) => (
          <button key={o.label} type="button" role="radio" aria-checked={o.on} onClick={o.go}
            className={cn('flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm', o.on ? 'bg-accent/12 font-medium text-accent-ink' : 'hover:bg-hover')}>
            <span className={cn('grid size-4 shrink-0 place-items-center rounded-full border-2', o.on ? 'border-accent' : 'border-muted')}>{o.on && <span className="size-2 rounded-full bg-accent" />}</span>
            {o.label}
          </button>
        ))}
      </div>
      {r && unit && (
        <label className="flex items-center gap-2 text-sm">
          Every <Input aria-label="Interval" type="number" min={1} max={99} value={r.interval} onChange={(x) => onChange({ ...r, interval: Math.min(99, Math.max(1, Number(x.target.value) || 1)) })} className="h-9 w-20" /> {unit}
        </label>
      )}
      {r?.freq === 'weekly' && (
        <div className="flex gap-1.5" role="group" aria-label="On these days">
          {WEEKDAYS.map((w, i) => {
            const on = (r.days?.length ? r.days : [wd]).includes(i);
            return (
              <button key={w} type="button" aria-pressed={on} aria-label={w} onClick={() => {
                const cur = r.days?.length ? r.days : [wd];
                const days = on ? cur.filter((x) => x !== i) : [...cur, i];
                if (days.length) onChange({ ...r, days: days.sort() });
              }} className={cn('grid size-9 place-items-center rounded-full text-sm font-semibold', on ? 'bg-accent text-white' : 'bg-panel-2 hover:bg-hover')}>{w[0]}</button>
            );
          })}
        </div>
      )}
      {r && (
        <div className="space-y-2 text-sm">
          <p className="font-medium">Ends</p>
          <div className="flex flex-wrap items-center gap-2">
            {(['never', 'until', 'count'] as const).map((k) => (
              <button key={k} type="button" aria-pressed={ends === k} onClick={() => onChange({ ...r, until: k === 'until' ? r.until || addDays(start, 90) : undefined, count: k === 'count' ? r.count || 10 : undefined })}
                className={cn('rounded-full border px-3 py-1', ends === k ? 'border-accent bg-accent/12 font-medium text-accent-ink' : 'border-line hover:bg-hover')}>
                {k === 'never' ? 'Never' : k === 'until' ? 'On a date' : 'After a number of times'}
              </button>
            ))}
          </div>
          {ends === 'until' && <Input aria-label="Last day" type="date" min={start} value={r.until} onChange={(x) => x.target.value && onChange({ ...r, until: x.target.value })} className="h-9 w-48" />}
          {ends === 'count' && <label className="flex items-center gap-2">After <Input aria-label="Times" type="number" min={1} max={999} value={r.count} onChange={(x) => onChange({ ...r, count: Math.min(999, Math.max(1, Number(x.target.value) || 1)) })} className="h-9 w-24" /> times</label>}
        </div>
      )}
    </div>
  );
}
