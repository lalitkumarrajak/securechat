// One day in full: its panchang (tithi and when it ends, nakshatra, yoga, month, samvat, sunrise,
// sunset, moonrise), its festivals and fasts with their timings, your events and your fast log.
import { useMemo } from 'react';
import { Clock, MapPin, Moon, Plus, Repeat, Sunrise, Sunset } from 'lucide-react';
import { cn } from '@sanga/ui/utils';
import { monthName, panchang, type Observance } from './panchang';
import { COLORS, describeRepeat, KINDS, occurrenceTimes, useCal, type CalEvent, type FastLog } from './model';
import { clock, longDay, useEvents, useObservances } from './util';
import { STATUS } from './fasts';
import { Fact } from './Fact';
import { ObservanceCard } from './ObservanceCard';

export function DayDetail({ day, onEdit, onAdd, onLogFast, onEditFast }: {
  day: string; onEdit: (e: CalEvent, day: string) => void; onAdd: () => void;
  onLogFast: (o: Observance) => void; onEditFast: (f: FastLog) => void;
}) {
  const place = useCal((s) => s.settings.place);
  const style = useCal((s) => s.settings.monthStyle);
  const allFasts = useCal((s) => s.fasts);
  const p = useMemo(() => panchang(day, place), [day, place]);
  const obs = useObservances(day, day).get(day) || [];
  const events = useEvents(day, day).get(day) || [];
  const fasts = Object.values(allFasts).filter((f) => f.day === day && !f.deleted);

  return (
    <section aria-label={`Details for ${longDay(day)}`} className="space-y-3">
      <div className="flex items-end gap-2 px-1">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold tracking-tight">{longDay(day)}</h2>
          <p className="text-sm text-muted">{monthName(p.month, p.tithi, style)} {p.paksha} {p.tithiName} · Vikram Samvat {p.vikram}</p>
        </div>
        <button onClick={onAdd} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-110">
          <Plus className="size-4" /> Add
        </button>
      </div>

      {obs.map((o) => <ObservanceCard key={o.id} o={o} logged={fasts.find((f) => f.ref === o.id)} onLog={() => onLogFast(o)} onEditFast={onEditFast} />)}

      {events.length > 0 && (
        <ul className="space-y-2" aria-label="Your events">
          {events.map(({ e, startDay }) => {
            const t = occurrenceTimes(e, startDay);
            const c = COLORS[e.color] || COLORS.teal;
            return (
              <li key={e.id + startDay}>
                <button onClick={() => onEdit(e, startDay)} className="flex w-full items-stretch gap-3 rounded-2xl border border-line/70 bg-panel p-3 text-left shadow-sm transition hover:shadow-md">
                  <span className={cn('w-1.5 shrink-0 rounded-full', c.dot)} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 font-semibold"><span aria-hidden>{KINDS[e.kind].emoji}</span><span className="truncate">{e.title || KINDS[e.kind].label}</span></span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted">
                      <span className="flex items-center gap-1"><Clock className="size-3.5" />{e.allDay ? 'All day' : `${clock(t.start)} – ${clock(t.end)}`}</span>
                      {e.location && <span className="flex min-w-0 items-center gap-1"><MapPin className="size-3.5" /><span className="truncate">{e.location}</span></span>}
                      {e.repeat && <span className="flex items-center gap-1"><Repeat className="size-3.5" />{describeRepeat(e.repeat, e.start)}</span>}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {fasts.filter((f) => !f.ref || !obs.some((o) => o.id === f.ref)).map((f) => (
        <button key={f.id} onClick={() => onEditFast(f)} className="flex w-full items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/8 p-3 text-left">
          <span className="text-2xl" aria-hidden>🙏</span>
          <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{f.name || 'Fast'}</span><span className="text-sm text-muted">{STATUS[f.status].label}{f.notes ? ` · ${f.notes}` : ''}</span></span>
        </button>
      ))}

      {!obs.length && !events.length && !fasts.length && (
        <p className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">Nothing on this day. Tap Add to plan something.</p>
      )}

      <div className="rounded-3xl border border-line/70 bg-panel p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-wide text-muted uppercase"><span className="text-lg" aria-hidden>{p.moon}</span>Panchang</h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Fact label="Tithi" value={`${p.paksha} ${p.tithiName}`} sub={`until ${fmtWhen(p.tithiEnds, day)}`} />
          <Fact label="Nakshatra" value={p.nakshatra.name} sub={`until ${fmtWhen(p.nakshatra.end, day)}`} />
          <Fact label="Month" value={monthName(p.month, p.tithi, style)} sub={style === 'purnimanta' ? 'Purnimanta' : 'Amanta'} />
          <Fact label="Yoga" value={p.yoga} />
          <Fact label={<><Sunrise className="size-3.5" />Sunrise</>} value={clock(p.sunrise)} />
          <Fact label={<><Sunset className="size-3.5" />Sunset</>} value={clock(p.sunset)} />
          <Fact label={<><Moon className="size-3.5" />Moonrise</>} value={p.moonrise ? clock(p.moonrise) : 'No moonrise'} />
          <Fact label="Samvat" value={`Vikram ${p.vikram}`} sub={`Shaka ${p.shaka}`} />
        </dl>
      </div>
    </section>
  );
}

const fmtWhen = (ms: number, day: string) => {
  const d = new Date(ms);
  const sameDay = d.toDateString() === new Date(`${day}T12:00:00`).toDateString();
  return clock(ms) + (sameDay ? '' : ', ' + d.toLocaleDateString([], { day: 'numeric', month: 'short' }));
};
