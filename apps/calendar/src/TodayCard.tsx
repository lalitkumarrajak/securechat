import { useMemo } from 'react';
import { Sunrise, Sunset } from 'lucide-react';
import { addDays, monthName, panchang } from './panchang';
import { today, useCal } from './model';
import { BRAND, clock, daysUntil, inWords, useObservances } from './util';

/** Today: the date, the Hindu date, sunrise and sunset, and what's next. */
export function TodayCard({ onOpen }: { onOpen: (d: string) => void }) {
  const place = useCal((s) => s.settings.place);
  const style = useCal((s) => s.settings.monthStyle);
  const now = today();
  const p = useMemo(() => panchang(now, place), [now, place]);
  const coming = useObservances(now, addDays(now, 60));
  const next = [...coming.values()].flat().filter((o) => o.fast || o.group === 'festivals')[0];
  const date = new Date(`${now}T12:00:00`);
  return (
    <section className="relative mt-1 overflow-hidden rounded-3xl p-5 text-white shadow-md md:p-6" style={{ background: BRAND }} aria-label="Today">
      <span aria-hidden className="absolute -top-10 -right-10 size-44 rounded-full bg-white/10" />
      <span aria-hidden className="absolute right-24 -bottom-16 size-36 rounded-full bg-white/10" />
      <span aria-hidden className="absolute top-4 right-5 text-5xl md:text-6xl">{p.moon}</span>
      <div className="relative flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="flex items-end gap-3">
          <span className="text-5xl leading-none font-bold tabular-nums md:text-6xl">{date.getDate()}</span>
          <span className="pb-1">
            <span className="block text-lg leading-tight font-semibold">{date.toLocaleDateString([], { weekday: 'long' })}</span>
            <span className="block text-sm text-white/80">{date.toLocaleDateString([], { month: 'long', year: 'numeric' })}</span>
          </span>
        </div>
        <div className="min-w-0 pb-1">
          <p className="font-semibold">{monthName(p.month, p.tithi, style)} {p.paksha} {p.tithiName}</p>
          <p className="text-sm text-white/85">until {clock(p.tithiEnds)} · {p.nakshatra.name} · Samvat {p.vikram}</p>
        </div>
      </div>
      <div className="relative mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold">
        <span className="inline-flex items-center gap-1 rounded-full bg-black/15 px-2.5 py-1"><Sunrise className="size-3.5" />{clock(p.sunrise)}</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-black/15 px-2.5 py-1"><Sunset className="size-3.5" />{clock(p.sunset)}</span>
        <span className="rounded-full bg-black/15 px-2.5 py-1">{place.name}</span>
        {next && (
          <button onClick={() => onOpen(next.day)} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white px-3 py-1 text-rose-700 shadow-sm hover:bg-rose-50">
            <span aria-hidden>{next.emoji}</span><span className="truncate">{next.name.split(' · ')[0]} {inWords(daysUntil(next.day, now))}</span>
          </button>
        )}
      </div>
    </section>
  );
}
