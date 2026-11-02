import { cn } from '@sanga/ui/utils';
import { money, type Mode, type Person } from './model';
import { PersonDot } from './PersonDot';

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: 'equal', label: 'Equally', hint: 'Everyone ticked pays the same' },
  { id: 'exact', label: 'Exact', hint: 'Type what each person owes' },
  { id: 'percent', label: '%', hint: 'Percentages that add up to 100' },
  { id: 'shares', label: 'Shares', hint: 'e.g. 2 shares for a couple, 1 for one person' },
];

export interface SplitDraft { mode: Mode; who: string[]; texts: Record<string, string> }

/** Who shares an expense and how: equally, by exact amounts, percentages or shares. */
export function SplitEditor({ people, name, draft, onChange, owed, currency, error }: {
  people: Person[]; name: (p: Person) => string; draft: SplitDraft; onChange: (d: SplitDraft) => void;
  owed: Record<string, number> | null; currency: string; error: string;
}) {
  const { mode, who, texts } = draft;
  const set = (patch: Partial<SplitDraft>) => onChange({ ...draft, ...patch });
  const toggle = (id: string) => set({ who: who.includes(id) ? who.filter((x) => x !== id) : [...who, id] });
  const unit = mode === 'percent' ? '%' : mode === 'shares' ? 'shares' : '';

  return (
    <div>
      <div className="flex gap-1 rounded-xl bg-panel-2 p-1" role="tablist" aria-label="How to split">
        {MODES.map((m) => (
          <button key={m.id} type="button" role="tab" aria-selected={mode === m.id} onClick={() => set({ mode: m.id, texts: {} })}
            className={cn('flex-1 rounded-lg px-2 py-1.5 text-sm font-medium transition', mode === m.id ? 'bg-panel shadow-sm' : 'text-muted hover:text-ink')}>{m.label}</button>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-muted">{MODES.find((m) => m.id === mode)!.hint}</p>
      <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
        {people.map((p) => {
          const on = who.includes(p.id);
          return (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2">
              <input type="checkbox" checked={on} onChange={() => toggle(p.id)} aria-label={`Include ${name(p)}`} className="size-4 accent-[var(--accent)]" />
              <PersonDot p={p} name={name(p)} size={28} />
              <span className={cn('min-w-0 flex-1 truncate text-sm', !on && 'text-muted')}>{name(p)}{p.gone && ' (left)'}</span>
              {on && mode !== 'equal' && (
                <label className="flex items-center gap-1 text-sm">
                  <input inputMode="decimal" value={texts[p.id] ?? ''} onChange={(e) => set({ texts: { ...texts, [p.id]: e.target.value } })}
                    aria-label={`${name(p)} ${mode === 'exact' ? 'amount' : mode === 'percent' ? 'percent' : 'shares'}`} placeholder={mode === 'shares' ? '1' : '0'}
                    className="h-8 w-20 rounded-lg border border-line bg-panel-2 px-2 text-right outline-none focus:border-accent" />
                  {unit && <span className="w-9 text-xs text-muted">{unit}</span>}
                </label>
              )}
              {on && owed && <span className="w-24 text-right text-sm tabular-nums text-muted">{money(owed[p.id] ?? 0, currency)}</span>}
            </li>
          );
        })}
      </ul>
      {error && <p className="mt-1.5 text-sm text-danger" role="alert">{error}</p>}
    </div>
  );
}
