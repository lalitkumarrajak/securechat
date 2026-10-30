// Calendar: your events, holidays, birthdays and reminders, together with the Hindu calendar
// (panchang, festivals and fasts) and a fast tracker. A separate Sanga app: the shell loads it when
// the Calendar tab is opened, and it also runs on its own at /apps/calendar/.
import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, Flame, ListTodo, Plus, Settings } from 'lucide-react';
import { IconButton } from '@sanga/ui/button';
import { cn } from '@sanga/ui/utils';
import { sdk, type AppProps } from '@sanga/sdk';
import type { Observance } from './panchang';
import { newEvent, newFast, onChange, startCalendar, today, useCal, type CalEvent, type FastLog } from './model';
import { scheduleReminders } from './reminders';
import { TodayCard } from './TodayCard';
import { MonthGrid } from './MonthGrid';
import { DayDetail } from './DayDetail';
import { Agenda } from './Agenda';
import { EventEditor } from './EventEditor';
import { FastSheet } from './FastSheet';
import { FastTracker } from './FastTracker';
import { SettingsSheet } from './SettingsSheet';
import { BRAND } from './util';

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
