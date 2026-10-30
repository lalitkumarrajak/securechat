// The month: a grid of days, each with its tithi (the moon on Purnima and Amavasya), festivals and
// fasts, your events as coloured marks, and holidays in red.
import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton } from '@sanga/ui/button';
import { cn } from '@sanga/ui/utils';
import { dayStart, tithiAt } from './panchang';
import { sunTimes } from './astro';
import { today, useCal, WEEKDAYS } from './model';
import { Cell } from './Cell';
import { gridDays, monthTitle, useEvents, useObservances } from './util';

export function MonthGrid({ ym, setYm, selected, onSelect }: { ym: string; setYm: (m: string) => void; selected: string; onSelect: (d: string) => void }) {
  const weekStart = useCal((s) => s.settings.weekStart);
  const place = useCal((s) => s.settings.place);
  const days = useMemo(() => gridDays(ym, weekStart), [ym, weekStart]);
  const obs = useObservances(days[0], days[41]);
  const events = useEvents(days[0], days[41]);
  // Tithi at sunrise for each day shown.
  const tithis = useMemo(() => new Map(days.map((d) => [d, tithiAt(sunTimes(dayStart(d), place).rise)])), [days, place]);
  const now = today();
  const shift = (n: number) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); setYm(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); };
  const names = Array.from({ length: 7 }, (_, i) => WEEKDAYS[(i + weekStart) % 7]);

  return (
    <section aria-label="Month" className="rounded-3xl border border-line/70 bg-panel p-2 shadow-sm sm:p-3">
      <div className="mb-1 flex items-center gap-1 px-1">
        <h2 className="flex-1 text-lg font-bold tracking-tight" aria-live="polite">{monthTitle(ym)}</h2>
        {ym !== now.slice(0, 7) && <button onClick={() => { setYm(now.slice(0, 7)); onSelect(now); }} className="mr-1 rounded-full border border-line px-3 py-1 text-sm font-medium hover:bg-hover">Today</button>}
        <IconButton label="Previous month" onClick={() => shift(-1)}><ChevronLeft /></IconButton>
        <IconButton label="Next month" onClick={() => shift(1)}><ChevronRight /></IconButton>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] font-semibold tracking-wide text-muted uppercase">
        {names.map((n) => <span key={n} className={cn('py-1.5', n === 'Sunday' && 'text-rose-500')}>{n.slice(0, 3)}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl bg-line/60" role="grid" aria-label="Days">
        {days.map((d) => (
          <Cell key={d} d={d} inMonth={d.startsWith(ym)} isToday={d === now} selected={d === selected} tithi={tithis.get(d)!}
            obs={obs.get(d)} events={events.get(d)} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}
