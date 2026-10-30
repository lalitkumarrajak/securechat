import { Input } from '@sanga/ui/input';
import { cn } from '@sanga/ui/utils';
import { addDays, tithiName } from './panchang';
import { WEEKDAYS, type CalEvent, type Freq, type Repeat } from './model';

export function RepeatPicker({ e, tithi, onChange }: { e: CalEvent; tithi: number; onChange: (r: Repeat | null) => void }) {
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
