// Calendar: your events, holidays, birthdays and reminders, together with the Hindu calendar
// (panchang, festivals and fasts) and a fast tracker. A separate Sanga app: the shell loads it when
// the Calendar tab is opened, and it also runs on its own at /apps/calendar/.
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, Flame, ListTodo, Plus, Settings, Sunrise, Sunset } from 'lucide-react';
import { IconButton } from '@sanga/ui/button';
import { cn } from '@sanga/ui/utils';
import { sdk, type AppProps } from '@sanga/sdk';
import { addDays, monthName, panchang, type Observance } from './panchang';
import { newEvent, newFast, onChange, startCalendar, today, useCal, type CalEvent, type FastLog } from './model';
import { scheduleReminders } from './reminders';
import { MonthGrid } from './MonthGrid';
import { DayDetail } from './DayDetail';
import { Agenda } from './Agenda';
import { EventEditor } from './EventEditor';
import { FastSheet, FastTracker } from './FastTracker';
import { SettingsSheet } from './SettingsSheet';
import { BRAND, clock, daysUntil, inWords, useObservances } from './util';

type View = 'month' | 'agenda' | 'fasts';

export default function CalendarApp({ onClose, params, tab }: AppProps) {
  const [view, setView] = useState<View>('month');
  const [selected, setSelected] = useState(() => (params.day && /^\d{4}-\d\d-\d\d$/.test(params.day) ? params.day : today()));
  const [ym, setYm] = useState(selected.slice(0, 7));
  const [editing, setEditing] = useState<{ e: CalEvent; day: string } | null>(null);
  const [fast, setFast] = useState<FastLog | null>(null);
  const [settings, setSettings] = useState(false);

  useEffect(() => {
    startCalendar();
    const off = onChange(scheduleReminders);
    scheduleReminders();
    void sdk().store.put('app/bg/calendar', 'calendar'); // from now on Sanga runs ./background when it starts, keeping reminders current
    return () => { off(); };
  }, []);

  const select = (d: string) => { setSelected(d); setYm(d.slice(0, 7)); };
  const openDay = (d: string) => { select(d); setView('month'); };
  const add = (day = selected) => setEditing({ e: newEvent(day), day });
  const logFast = (o: Observance) => setFast(useCal.getState().fasts[Object.keys(useCal.getState().fasts).find((k) => useCal.getState().fasts[k].ref === o.id) || ''] || newFast(o.day, o.name, o.id));

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-bg">
      <header className="flex h-16 shrink-0 items-center gap-1 px-3">
        {!tab && <IconButton label="Back" onClick={onClose}><ArrowLeft /></IconButton>}
        <h1 className={cn('min-w-0 flex-1 truncate text-xl font-bold tracking-tight', tab && 'pl-2')}>Calendar</h1>
        <nav className="mr-1 flex rounded-full bg-panel-2 p-1" role="tablist" aria-label="Calendar views">
          {([['month', 'Month', CalendarDays], ['agenda', 'Upcoming', ListTodo], ['fasts', 'Fasts', Flame]] as const).map(([v, label, Icon]) => (
            <button key={v} role="tab" aria-selected={view === v} aria-label={label} onClick={() => setView(v)}
              className={cn('flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition', view === v ? 'bg-panel text-ink shadow-sm' : 'text-muted hover:text-ink')}>
              <Icon className="size-4" /><span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </nav>
        <IconButton label="Calendar settings" onClick={() => setSettings(true)}><Settings /></IconButton>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-3 pb-24 md:px-5 md:pb-8">
          <TodayCard onOpen={openDay} />
          {view === 'month' && (
            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
              <MonthGrid ym={ym} setYm={setYm} selected={selected} onSelect={select} />
              <DayDetail day={selected} onAdd={() => add()} onEdit={(e, day) => setEditing({ e, day })} onLogFast={logFast} onEditFast={setFast} />
            </div>
          )}
          {view === 'agenda' && <div className="mt-4"><Agenda onDay={openDay} onEdit={(e, day) => setEditing({ e, day })} /></div>}
          {view === 'fasts' && <div className="mt-4"><FastTracker onOpen={setFast} /></div>}
        </div>
      </div>

      <button onClick={() => add()} aria-label="New event"
        className="absolute right-4 bottom-4 z-10 grid size-14 place-items-center rounded-2xl text-white shadow-lg active:scale-95 md:hidden" style={{ background: BRAND }}>
        <Plus className="size-6" />
      </button>

      <EventEditor event={editing?.e ?? null} day={editing?.day ?? selected} onClose={() => setEditing(null)} />
      <FastSheet fast={fast} onClose={() => setFast(null)} />
      <SettingsSheet open={settings} onClose={() => setSettings(false)} />
    </div>
  );
}

/** Today: the date, the Hindu date, sunrise and sunset, and what's next. */
function TodayCard({ onOpen }: { onOpen: (d: string) => void }) {
  const place = useCal((s) => s.settings.place);
  const style = useCal((s) => s.settings.monthStyle);
  const now = today();
  const p = useMemo(() => panchang(now, place), [now, place]);
  const coming = useObservances(now, addDays(now, 60));
  const next = [...coming.values()].flat().filter((o) => o.fast || o.group === 'festivals')[0];
  const date = new Date(`${now}T12:00:00`);
  return (
    <section className="relative mt-1 overflow-hidden rounded-3xl p-5 text-white shadow-md md:p-6" style={{ background: BRAND }} aria-label="Today">
      <span aria-hidden className="absolute -top-10 -right-10 size-44 rounded-full bg-white/10" />
      <span aria-hidden className="absolute right-24 -bottom-16 size-36 rounded-full bg-white/10" />
      <span aria-hidden className="absolute top-4 right-5 text-5xl md:text-6xl">{p.moon}</span>
      <div className="relative flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="flex items-end gap-3">
          <span className="text-5xl leading-none font-bold tabular-nums md:text-6xl">{date.getDate()}</span>
          <span className="pb-1">
            <span className="block text-lg leading-tight font-semibold">{date.toLocaleDateString([], { weekday: 'long' })}</span>
            <span className="block text-sm text-white/80">{date.toLocaleDateString([], { month: 'long', year: 'numeric' })}</span>
          </span>
        </div>
        <div className="min-w-0 pb-1">
          <p className="font-semibold">{monthName(p.month, p.tithi, style)} {p.paksha} {p.tithiName}</p>
          <p className="text-sm text-white/85">until {clock(p.tithiEnds)} · {p.nakshatra.name} · Samvat {p.vikram}</p>
        </div>
      </div>
      <div className="relative mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold">
        <span className="inline-flex items-center gap-1 rounded-full bg-black/15 px-2.5 py-1"><Sunrise className="size-3.5" />{clock(p.sunrise)}</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-black/15 px-2.5 py-1"><Sunset className="size-3.5" />{clock(p.sunset)}</span>
        <span className="rounded-full bg-black/15 px-2.5 py-1">{place.name}</span>
        {next && (
          <button onClick={() => onOpen(next.day)} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white px-3 py-1 text-rose-700 shadow-sm hover:bg-rose-50">
            <span aria-hidden>{next.emoji}</span><span className="truncate">{next.name.split(' · ')[0]} {inWords(daysUntil(next.day, now))}</span>
          </button>
        )}
      </div>
    </section>
  );
}
