// One day in full: its panchang (tithi and when it ends, nakshatra, yoga, month, samvat, sunrise,
// sunset, moonrise), its festivals and fasts with their timings, your events and your fast log.
import { useMemo } from 'react';
import { Clock, MapPin, Moon, Plus, Repeat, Sunrise, Sunset } from 'lucide-react';
import { cn } from '@sanga/ui/utils';
import { locale, t } from '@sanga/i18n';
import { monthLabel, nakshatraLabel, panchang, type Observance } from './panchang';
import { COLORS, describeRepeat, KINDS, occurrenceTimes, useCal, type CalEvent, type FastLog } from './model';
import { clock, longDay, useEvents, useObservances } from './util';
import { STATUS } from './fasts';
import { Fact } from './Fact';
import { ObservanceCard } from './ObservanceCard';
import { creditCards, live, money, useLedger } from '@sanga/ledger';

export function DayDetail({ day, onEdit, onAdd, onLogFast, onEditFast, onBill }: {
  day: string; onBill: () => void; onEdit: (e: CalEvent, day: string) => void; onAdd: () => void;
  onLogFast: (o: Observance) => void; onEditFast: (f: FastLog) => void;
}) {
  const place = useCal((s) => s.settings.place);
  const style = useCal((s) => s.settings.monthStyle);
  const allFasts = useCal((s) => s.fasts);
  const p = useMemo(() => panchang(day, place), [day, place]);
  const obs = useObservances(day, day).get(day) || [];
  const events = useEvents(day, day).get(day) || [];
  const fasts = Object.values(allFasts).filter((f) => f.day === day && !f.deleted);
  // Credit card bills due this day (kept in Accounts).
  const billsMap = useLedger((s) => s.bills), accountsMap = useLedger((s) => s.accounts);
  const dues = useMemo(() => { const cards = new Map(creditCards().map((c) => [c.id, c])); return live(Object.values(billsMap)).filter((b) => b.due === day && !b.none && cards.has(b.card)).map((b) => ({ b, c: cards.get(b.card)! })); }, [billsMap, accountsMap, day]);

  return (
    <section aria-label={t('Details for {day}', { day: longDay(day) })} className="space-y-3">
      <div className="flex items-end gap-2 px-1">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold tracking-tight">{longDay(day)}</h2>
          <p className="text-sm text-muted">{t('{month} {paksha} {tithi} · Vikram Samvat {year}', { month: monthLabel(p.month, p.tithi, style), paksha: t(p.paksha), tithi: t(p.tithiName), year: p.vikram })}</p>
        </div>
        <button onClick={onAdd} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-110">
          <Plus className="size-4" /> {t('Add')}
        </button>
      </div>

      {dues.map(({ b, c }) => (
        <button key={b.id} type="button" onClick={onBill} className="flex w-full items-center gap-3 rounded-2xl border border-line/70 bg-panel p-3 text-left shadow-sm hover:shadow-md">
          <span className="text-xl" aria-hidden>💳</span>
          <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{t('{card} bill due', { card: c.name })}</span>
            <span className="block text-sm text-muted">{b.paid ? t('Paid') : money(b.amount, c.currency)}</span></span>
        </button>
      ))}
      {obs.map((o) => <ObservanceCard key={o.id} o={o} logged={fasts.find((f) => f.ref === o.id)} onLog={() => onLogFast(o)} onEditFast={onEditFast} />)}

      {events.length > 0 && (
        <ul className="space-y-2" aria-label={t('Your events')}>
          {events.map(({ e, startDay }) => {
            const tm = occurrenceTimes(e, startDay);
            const c = COLORS[e.color] || COLORS.teal;
            return (
              <li key={e.id + startDay}>
                <button onClick={() => onEdit(e, startDay)} className="flex w-full items-stretch gap-3 rounded-2xl border border-line/70 bg-panel p-3 text-left shadow-sm transition hover:shadow-md">
                  <span className={cn('w-1.5 shrink-0 rounded-full', c.dot)} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 font-semibold"><span aria-hidden>{KINDS[e.kind].emoji}</span><span className="truncate">{e.title || t(KINDS[e.kind].label)}</span></span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted">
                      <span className="flex items-center gap-1"><Clock className="size-3.5" />{e.allDay ? t('All day') : `${clock(tm.start)} – ${clock(tm.end)}`}</span>
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
          <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{f.name || t('Fast')}</span><span className="text-sm text-muted">{t(STATUS[f.status].label)}{f.notes ? ` · ${f.notes}` : ''}</span></span>
        </button>
      ))}

      {!obs.length && !events.length && !fasts.length && (
        <p className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">{t('Nothing on this day. Tap Add to plan something.')}</p>
      )}

      <div className="rounded-3xl border border-line/70 bg-panel p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-wide text-muted uppercase"><span className="text-lg" aria-hidden>{p.moon}</span>{t('Panchang')}</h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Fact label={t('Tithi')} value={t('{paksha} {tithi}', { paksha: t(p.paksha), tithi: t(p.tithiName) })} sub={t('until {time}', { time: fmtWhen(p.tithiEnds, day) })} />
          <Fact label={t('Nakshatra')} value={nakshatraLabel(p.nakshatra.name)} sub={t('until {time}', { time: fmtWhen(p.nakshatra.end, day) })} />
          <Fact label={t('Month')} value={monthLabel(p.month, p.tithi, style)} sub={style === 'purnimanta' ? t('Purnimanta') : t('Amanta')} />
          <Fact label={t('Yoga')} value={t(p.yoga)} />
          <Fact label={<><Sunrise className="size-3.5" />{t('Sunrise')}</>} value={clock(p.sunrise)} />
          <Fact label={<><Sunset className="size-3.5" />{t('Sunset')}</>} value={clock(p.sunset)} />
          <Fact label={<><Moon className="size-3.5" />{t('Moonrise')}</>} value={p.moonrise ? clock(p.moonrise) : t('No moonrise')} />
          <Fact label={t('Samvat')} value={t('Vikram {year}', { year: p.vikram })} sub={t('Shaka {year}', { year: p.shaka })} />
        </dl>
      </div>
    </section>
  );
}

const fmtWhen = (ms: number, day: string) => {
  const d = new Date(ms);
  const sameDay = d.toDateString() === new Date(`${day}T12:00:00`).toDateString();
  return clock(ms) + (sameDay ? '' : ', ' + d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' }));
};
