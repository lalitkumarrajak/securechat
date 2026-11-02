import { cn } from '@sanga/ui/utils';
import type { Preset } from './model';

const PRESETS: { id: Preset; label: string }[] = [
  { id: 'today', label: 'Today' }, { id: 'week', label: 'This week' }, { id: 'month', label: 'This month' }, { id: 'last30', label: 'Last 30 days' },
  { id: 'lastMonth', label: 'Last month' }, { id: 'year', label: 'This year' }, { id: 'all', label: 'All time' }, { id: 'custom', label: 'Custom' },
];

/** Pick the period to look at: a ready-made one, or any two dates. */
export function PeriodBar({ preset, onPreset, from, to, onDates, min }: { preset: Preset; onPreset: (p: Preset) => void; from: string; to: string; onDates: (from: string, to: string) => void; min?: string }) {
  const today = new Date().toLocaleDateString('en-CA');
  return (
    <div>
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1" role="group" aria-label="Period">
        {PRESETS.map((p) => (
          <button key={p.id} type="button" aria-pressed={preset === p.id} onClick={() => onPreset(p.id)}
            className={cn('shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition', preset === p.id ? 'border-transparent bg-accent font-semibold text-white' : 'border-line bg-panel hover:bg-hover')}>{p.label}</button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="mt-2 flex items-center gap-2 text-sm">
          <input type="date" value={from} min={min} max={to} aria-label="From" onChange={(e) => e.target.value && onDates(e.target.value, to)} className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-panel-2 px-3 outline-none focus:border-accent" />
          <span className="text-muted">to</span>
          <input type="date" value={to} min={from} max={today} aria-label="To" onChange={(e) => e.target.value && onDates(from, e.target.value)} className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-panel-2 px-3 outline-none focus:border-accent" />
        </div>
      )}
    </div>
  );
}
