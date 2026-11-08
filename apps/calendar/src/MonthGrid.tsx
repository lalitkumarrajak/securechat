// The month: a grid of days, each with its tithi (the moon on Purnima and Amavasya), festivals and
// fasts, your events as coloured marks, and holidays in red.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton } from '@sanga/ui/button';
import { cn } from '@sanga/ui/utils';
import { t } from '@sanga/i18n';
import { dayStart, tithiAt } from './panchang';
import { sunTimes } from './astro';
import { today, useCal, WEEKDAYS_SHORT } from './model';
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
  const names = Array.from({ length: 7 }, (_, i) => (i + weekStart) % 7);
  // Swipe the month sideways on a phone: left for the next month, right for the one before.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const [dir, setDir] = useState(0);
  const go = (n: number) => { setDir(n); shift(n); };
  const gridRef = useRef<HTMLDivElement>(null);
  useEffect(() => { // the new month slides in from the side it came from
    if (!dir || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gridRef.current?.animate?.([{ transform: `translateX(${dir * 18}%)`, opacity: 0.2 }, { transform: 'none', opacity: 1 }], { duration: 220, easing: 'ease-out' });
  }, [ym]); // eslint-disable-line react-hooks/exhaustive-deps
  const onTouchStart = (e: React.TouchEvent) => { const p = e.touches[0]; touch.current = e.touches.length === 1 ? { x: p.clientX, y: p.clientY } : null; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s0 = touch.current; touch.current = null;
    if (!s0) return;
    const p = e.changedTouches[0], dx = p.clientX - s0.x, dy = p.clientY - s0.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > 1.5 * Math.abs(dy)) go(dx < 0 ? 1 : -1);
  };

  return (
    <section aria-label={t('Month')} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onTouchCancel={() => { touch.current = null; }} className="touch-pan-y overflow-hidden rounded-3xl border border-line/70 bg-panel p-2 shadow-sm sm:p-3">
      <div className="mb-1 flex items-center gap-1 px-1">
        <h2 className="flex-1 text-lg font-bold tracking-tight" aria-live="polite">{monthTitle(ym)}</h2>
        {ym !== now.slice(0, 7) && <button onClick={() => { setYm(now.slice(0, 7)); onSelect(now); }} className="mr-1 rounded-full border border-line px-3 py-1 text-sm font-medium hover:bg-hover">{t('Today')}</button>}
        <IconButton label={t('Previous month')} onClick={() => go(-1)}><ChevronLeft /></IconButton>
        <IconButton label={t('Next month')} onClick={() => go(1)}><ChevronRight /></IconButton>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] font-semibold tracking-wide text-muted uppercase">
        {names.map((n) => <span key={n} className={cn('py-1.5', n === 0 && 'text-rose-500')}>{t(WEEKDAYS_SHORT[n])}</span>)}
      </div>
      <div ref={gridRef} className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl bg-line/60" role="grid" aria-label={t('Days')}>
        {days.map((d) => (
          <Cell key={d} d={d} inMonth={d.startsWith(ym)} isToday={d === now} selected={d === selected} tithi={tithis.get(d)!}
            obs={obs.get(d)} events={events.get(d)} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}
