import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton } from '@sanga/ui/button';
import { cn } from '@sanga/ui/utils';
import { dayDate, dayKey, today } from '../notes';

export function Calendar({ month, setMonth, day, setDay, perDay }: {
  month: string; setMonth: (m: string) => void; day: string | null; setDay: (d: string | null) => void; perDay: Map<string, number>;
}) {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const days = new Date(y, m, 0).getDate();
  const cells = [...Array(first.getDay()).fill(null), ...Array.from({ length: days }, (_, i) => dayKey(new Date(y, m - 1, i + 1)))];
  const shift = (by: number) => setMonth(dayKey(new Date(y, m - 1 + by, 1)).slice(0, 7));
  const now = today();
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2023, 0, 1 + i).toLocaleDateString([], { weekday: 'narrow' })); // 1 Jan 2023 was a Sunday

  return (
    <div className="mt-3 rounded-3xl border border-line/70 bg-panel p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-1">
        <IconButton label="Previous month" onClick={() => shift(-1)}><ChevronLeft /></IconButton>
        <h3 className="flex-1 text-center font-semibold" aria-live="polite">{first.toLocaleDateString([], { month: 'long', year: 'numeric' })}</h3>
        <IconButton label="Next month" onClick={() => shift(1)}><ChevronRight /></IconButton>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center text-sm" role="group" aria-label="Calendar">
        {weekdays.map((w, i) => <span key={i} className="pb-1 text-xs font-medium text-muted" aria-hidden>{w}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={'x' + i} />;
          const count = perDay.get(d) || 0;
          const label = dayDate(d).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' }) + (count ? `, ${count} note${count > 1 ? 's' : ''}` : '');
          return (
            <button key={d} onClick={() => setDay(day === d ? null : d)} aria-label={label} aria-pressed={day === d}
              className={cn('relative mx-auto grid size-9 place-items-center rounded-full',
                day === d ? 'bg-accent font-semibold text-white shadow-sm' : d === now ? 'font-bold text-accent-ink ring-1 ring-accent' : count ? 'bg-amber-500/10 font-medium hover:bg-amber-500/20' : 'hover:bg-hover')}>
              {Number(d.slice(8))}
              {count > 0 && <span className={cn('absolute bottom-1 size-1 rounded-full', day === d ? 'bg-white' : 'bg-amber-500')} />}
            </button>
          );
        })}
      </div>
      {month !== now.slice(0, 7) && (
        <button onClick={() => { setMonth(now.slice(0, 7)); setDay(now); }} className="mt-2 w-full rounded-lg py-1.5 text-sm text-accent-ink hover:bg-hover">Today</button>
      )}
    </div>
  );
}
