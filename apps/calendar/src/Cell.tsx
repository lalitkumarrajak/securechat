import { memo } from 'react';
import { cn } from '@sanga/ui/utils';
import type { Observance } from './panchang';
import { COLORS, type CalEvent } from './model';

export const Cell = memo(function Cell({ d, inMonth, isToday, selected, tithi, obs = [], events = [], onSelect }: {
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
