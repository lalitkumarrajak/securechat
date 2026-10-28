// What's coming up: the next two months of your events, festivals and fasts, day by day.
import { Repeat } from 'lucide-react';
import { cn } from '@sanga/ui/utils';
import { addDays } from './panchang';
import { COLORS, KINDS, occurrenceTimes, today, type CalEvent } from './model';
import { clock, daysUntil, inWords, shortDay, useEvents, useObservances } from './util';

export function Agenda({ onDay, onEdit }: { onDay: (d: string) => void; onEdit: (e: CalEvent, day: string) => void }) {
  const from = today(), to = addDays(from, 60);
  const obs = useObservances(from, to);
  const events = useEvents(from, to);
  const days = [...new Set([...obs.keys(), ...events.keys()])].sort();
  if (!days.length) return <p className="rounded-3xl border border-dashed border-line p-8 text-center text-sm text-muted">Nothing in the next two months yet.</p>;
  return (
    <ol className="space-y-4">
      {days.map((d) => {
        const n = daysUntil(d, from);
        return (
          <li key={d} className="flex gap-3">
            <button onClick={() => onDay(d)} className="w-14 shrink-0 pt-1 text-center" aria-label={`Open ${shortDay(d)}`}>
              <span className={cn('block text-2xl leading-none font-bold tabular-nums', n === 0 && 'text-accent-ink')}>{Number(d.slice(8))}</span>
              <span className="block text-xs text-muted uppercase">{new Date(`${d}T12:00:00`).toLocaleDateString([], { weekday: 'short' })}</span>
              <span className="block text-[10px] text-muted">{n <= 1 ? inWords(n) : new Date(`${d}T12:00:00`).toLocaleDateString([], { month: 'short' })}</span>
            </button>
            <ul className="min-w-0 flex-1 space-y-1.5">
              {(obs.get(d) || []).map((o) => (
                <li key={o.id}>
                  <button onClick={() => onDay(d)} className={cn('flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm',
                    o.group === 'festivals' || o.group === 'national' ? 'bg-rose-500/10' : 'bg-amber-500/10')}>
                    <span aria-hidden>{o.emoji}</span><span className="min-w-0 flex-1 truncate font-medium">{o.name}</span>
                    {o.fast && <span className="shrink-0 text-xs text-muted">Fast</span>}
                  </button>
                </li>
              ))}
              {(events.get(d) || []).map(({ e, startDay }) => {
                const c = COLORS[e.color] || COLORS.teal;
                return (
                  <li key={e.id + startDay}>
                    <button onClick={() => onEdit(e, startDay)} className={cn('flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm', c.soft)}>
                      <span className={cn('size-2 shrink-0 rounded-full', c.dot)} />
                      <span className="min-w-0 flex-1 truncate"><b className="font-semibold">{e.title || KINDS[e.kind].label}</b>{e.location ? <span className="text-muted"> · {e.location}</span> : null}</span>
                      {e.repeat && <Repeat className="size-3.5 shrink-0 text-muted" aria-label="Repeats" />}
                      <span className="shrink-0 text-xs text-muted">{e.allDay ? 'All day' : clock(occurrenceTimes(e, startDay).start)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
