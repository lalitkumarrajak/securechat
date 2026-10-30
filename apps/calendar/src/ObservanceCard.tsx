import { cn } from '@sanga/ui/utils';
import type { Observance } from './panchang';
import type { FastLog } from './model';
import { clock } from './util';
import { STATUS } from './fasts';

export function ObservanceCard({ o, logged, onLog, onEditFast }: { o: Observance; logged?: FastLog; onLog: () => void; onEditFast: (f: FastLog) => void }) {
  const festival = o.group === 'festivals' || o.group === 'national';
  return (
    <article className={cn('relative overflow-hidden rounded-3xl border p-4 shadow-sm',
      festival ? 'border-rose-500/25 bg-gradient-to-br from-rose-500/10 to-orange-400/10' : 'border-amber-500/25 bg-gradient-to-br from-amber-400/12 to-yellow-300/8')}>
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/70 text-2xl shadow-sm dark:bg-white/10" aria-hidden>{o.emoji}</span>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold">{o.name}</h3>
          {o.about && <p className="mt-0.5 text-sm text-muted">{o.about}</p>}
          {o.times && o.times.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm">
              {o.times.map((t) => (
                <li key={t.label} className="flex gap-2"><span className="text-muted">{t.label}</span><b className="font-semibold">{clock(t.at)}{t.to ? ` – ${clock(t.to)}` : ''}</b>
                  {t.to && new Date(t.to).toDateString() !== new Date(t.at).toDateString() && <span className="text-xs text-muted">({new Date(t.to).toLocaleDateString([], { day: 'numeric', month: 'short' })})</span>}
                </li>
              ))}
            </ul>
          )}
          {o.fast && (
            logged ? (
              <button onClick={() => onEditFast(logged)} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-sm font-semibold shadow-sm dark:bg-white/10">
                {STATUS[logged.status].emoji} {STATUS[logged.status].label}
              </button>
            ) : (
              <button onClick={onLog} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:brightness-110">
                🙏 Track this fast
              </button>
            )
          )}
        </div>
      </div>
    </article>
  );
}
