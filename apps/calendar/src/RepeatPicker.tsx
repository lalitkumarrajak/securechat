import { Input } from '@sanga/ui/input';
import { cn } from '@sanga/ui/utils';
import { lang, locale, t, tk, tx } from '@sanga/i18n';
import { addDays, pakshaOf, tithiName } from './panchang';
import { ORD, ordinal, WEEKDAYS, WEEKDAYS_SHORT, type CalEvent, type Freq, type Repeat } from './model';

const UNITS = { daily: tk('days'), weekly: tk('weeks'), monthly: tk('months'), yearly: tk('years') };

export function RepeatPicker({ e, tithi, onChange }: { e: CalEvent; tithi: number; onChange: (r: Repeat | null) => void }) {
  const r = e.repeat;
  const start = e.start.slice(0, 10);
  const wd = new Date(`${start}T12:00:00`).getDay();
  const nth = Math.ceil(Number(start.slice(8)) / 7);
  const pick = (freq: Freq | null, extra: Partial<Repeat> = {}) => onChange(freq ? { freq, interval: r?.freq === freq ? r.interval : 1, until: r?.until, count: r?.count, ...extra } : null);
  const opts: { label: string; on: boolean; go: () => void }[] = [
    { label: t('Does not repeat'), on: !r, go: () => pick(null) },
    { label: t('Every day'), on: r?.freq === 'daily', go: () => pick('daily') },
    { label: t('Every week on {days}', { days: t(WEEKDAYS[wd]) }), on: r?.freq === 'weekly', go: () => pick('weekly', { days: [wd] }) },
    { label: t('Every month on the {day}', { day: ordinal(Number(start.slice(8))) }), on: r?.freq === 'monthly' && !r.byWeekday, go: () => pick('monthly', { byWeekday: false }) },
    { label: t('Every month on the {nth} {weekday}', { nth: t(ORD[nth - 1]), weekday: t(WEEKDAYS[wd]) }), on: r?.freq === 'monthly' && !!r.byWeekday, go: () => pick('monthly', { byWeekday: true }) },
    { label: t('Every year on {date}', { date: new Date(`${start}T12:00:00`).toLocaleDateString(locale(), { day: 'numeric', month: 'long' }) }), on: r?.freq === 'yearly', go: () => pick('yearly') },
    { label: t('Every lunar month on {paksha} {tithi} (Hindu calendar)', { paksha: t(pakshaOf(tithi)), tithi: t(tithiName(tithi)) }), on: r?.freq === 'tithi', go: () => pick('tithi', { tithi }) },
  ];
  const unit = r && r.freq !== 'tithi' ? UNITS[r.freq] : null;
  const ends = r?.until ? 'until' : r?.count ? 'count' : 'never';
  return (
    <div className="space-y-3 border-t border-line/70 p-3">
      <div className="grid gap-1" role="radiogroup" aria-label={t('Repeat')}>
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
          {tx('Every {input} {unit}', { input: <Input aria-label={t('Interval')} type="number" min={1} max={99} value={r.interval} onChange={(x) => onChange({ ...r, interval: Math.min(99, Math.max(1, Number(x.target.value) || 1)) })} className="h-9 w-20" />, unit: t(unit) })}
        </label>
      )}
      {r?.freq === 'weekly' && (
        <div className="flex gap-1.5" role="group" aria-label={t('On these days')}>
          {WEEKDAYS.map((w, i) => {
            const on = (r.days?.length ? r.days : [wd]).includes(i);
            return (
              <button key={w} type="button" aria-pressed={on} aria-label={t(w)} onClick={() => {
                const cur = r.days?.length ? r.days : [wd];
                const days = on ? cur.filter((x) => x !== i) : [...cur, i];
                if (days.length) onChange({ ...r, days: days.sort() });
              }} className={cn('grid size-9 place-items-center rounded-full text-sm font-semibold', on ? 'bg-accent text-white' : 'bg-panel-2 hover:bg-hover')}>{lang() === 'en' ? w[0] : t(WEEKDAYS_SHORT[i])}</button>
            );
          })}
        </div>
      )}
      {r && (
        <div className="space-y-2 text-sm">
          <p className="font-medium">{t('Ends')}</p>
          <div className="flex flex-wrap items-center gap-2">
            {(['never', 'until', 'count'] as const).map((k) => (
              <button key={k} type="button" aria-pressed={ends === k} onClick={() => onChange({ ...r, until: k === 'until' ? r.until || addDays(start, 90) : undefined, count: k === 'count' ? r.count || 10 : undefined })}
                className={cn('rounded-full border px-3 py-1', ends === k ? 'border-accent bg-accent/12 font-medium text-accent-ink' : 'border-line hover:bg-hover')}>
                {k === 'never' ? t('Never') : k === 'until' ? t('On a date') : t('After a number of times')}
              </button>
            ))}
          </div>
          {ends === 'until' && <Input aria-label={t('Last day')} type="date" min={start} value={r.until} onChange={(x) => x.target.value && onChange({ ...r, until: x.target.value })} className="h-9 w-48" />}
          {ends === 'count' && <label className="flex items-center gap-2">{tx('After {input} times', { input: <Input aria-label={t('Times')} type="number" min={1} max={999} value={r.count} onChange={(x) => onChange({ ...r, count: Math.min(999, Math.max(1, Number(x.target.value) || 1)) })} className="h-9 w-24" /> })}</label>}
        </div>
      )}
    </div>
  );
}
