// The month: a grid of days, each with its tithi (the moon on Purnima and Amavasya), festivals and
// fasts, your events as coloured marks, and holidays in red.
import { memo, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton } from '@sanga/ui/button';
import { cn } from '@sanga/ui/utils';
import { dayStart, tithiAt, type Observance } from './panchang';
import { sunTimes } from './astro';
import { COLORS, today, useCal, WEEKDAYS, type CalEvent } from './model';
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

const Cell = memo(function Cell({ d, inMonth, isToday, selected, tithi, obs = [], events = [], onSelect }: {
  d: string; inMonth: boolean; isToday: boolean; selected: boolean; tithi: number;
  obs?: Observance[]; events?: { e: CalEvent; startDay: string }[];
  onSelect: (d: string) => void;
}) {
  const sunday = new Date(`${d}T12:00:00`).getDay() === 0;
  const holiday = events.some((x) => x.e.kind === 'holiday') || obs.some((o) => o.group === 'national' || (o.group === 'festivals' && !o.fast && /Diwali|Holi$|Dussehra|Republic|Independence/.test(o.name)));
  const fast = obs.some((o) => o.fast) || events.some((x) => x.e.kind === 'fast');
  const big = obs.find((o) => o.group === 'festivals' || o.group === 'national') || obs[0];
  const moon = tithi === 15 ? '🌕' : tithi === 30 ? '🌑' : tithi === 11 || tithi === 26 ? 'Ek' : null;
  const label = [
    new Date(`${d}T12:00:00`).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' }),
    ...obs.map((o) => o.name), ...events.map((x) => x.e.title || 'Event'),
  ].join(', ');
  return (
    <button role="gridcell" aria-selected={selected} aria-label={label} onClick={() => onSelect(d)}
      className={cn('group relative flex min-h-16 flex-col items-stretch gap-0.5 bg-panel p-1 text-left transition sm:min-h-24 sm:p-1.5',
        !inMonth && 'bg-panel-2/40 text-muted/70', selected ? 'bg-accent/8 ring-2 ring-accent ring-inset' : 'hover:bg-hover')}>
      <span className="flex items-center justify-between gap-1">
        <span className={cn('grid size-7 place-items-center rounded-full text-sm font-semibold tabular-nums',
          isToday ? 'bg-accent text-white' : holiday || sunday ? 'text-rose-500' : '')}>{Number(d.slice(8))}</span>
        {moon && <span className={cn('text-[10px] leading-none font-bold', moon === 'Ek' ? 'rounded bg-amber-500/15 px-1 py-0.5 text-amber-700 dark:text-amber-300' : 'text-sm')} aria-hidden>{moon}</span>}
      </span>
      {big && (
        <span className={cn('truncate rounded-md px-1 text-[10px] leading-4 font-medium sm:text-[11px]',
          big.group === 'festivals' || big.group === 'national' ? 'bg-rose-500/12 text-rose-700 dark:text-rose-300' : 'bg-amber-500/12 text-amber-800 dark:text-amber-300')}>
          <span className="sm:hidden">{big.emoji}</span><span className="hidden sm:inline">{big.emoji} {big.name.split(' · ')[0]}</span>
        </span>
      )}
      {events.slice(0, 2).map((x) => (
        <span key={x.e.id} className={cn('hidden truncate rounded-md px-1 text-[11px] leading-4 sm:block', COLORS[x.e.color]?.soft, COLORS[x.e.color]?.text)}>
          {!x.e.allDay && <b className="font-semibold">{x.e.start.slice(11)} </b>}{x.e.title || 'Event'}
        </span>
      ))}
      <span className="mt-auto flex items-center gap-0.5">
        {events.slice(0, 4).map((x) => <span key={x.e.id} className={cn('size-1.5 rounded-full sm:hidden', COLORS[x.e.color]?.dot)} />)}
        {events.length > 2 && <span className="hidden text-[10px] text-muted sm:inline">+{events.length - 2} more</span>}
        {fast && <span className="ml-auto text-[10px]" aria-hidden title="Fast day">🙏</span>}
      </span>
    </button>
  );
});

