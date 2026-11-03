import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@sanga/ui/utils';
import { money, standing } from './model';
import { useMe, useNames } from './hooks';
import { useSplit } from './store';
import { PersonDot } from './PersonDot';

/** At the top of the groups: what you will get and what you owe over all of them, and with whom. */
export function Overview() {
  const me = useMe();
  const name = useNames();
  const groups = useSplit((s) => s.groups);
  const [open, setOpen] = useState(false);
  const rows = useMemo(() => standing(Object.values(groups).filter((g) => g.meta).map((g) => ({
    currency: g.meta!.currency, people: g.meta!.people,
    expenses: Object.values(g.expenses).filter((e) => !e.deleted), settles: Object.values(g.settles).filter((s) => !s.deleted),
  })), me), [groups, me]);
  if (!rows.length) return null;
  const shown = rows.filter((r) => r.get || r.owe).length;
  const settled = rows.every((r) => r.get === 0 && r.owe === 0);
  const people = rows.flatMap((r) => r.people.map((p) => ({ ...p, cur: r.cur })));

  return (
    <section aria-label="Your balance" className="mx-3 mb-3 rounded-2xl border border-line bg-panel p-3">
      {settled ? <p className="px-1 py-1 text-center text-sm text-muted">You’re all settled up 🎉</p> : rows.filter((r) => r.get || r.owe).map((r) => (
        <div key={r.cur} className={cn('grid grid-cols-2 gap-2', shown > 1 && 'mb-2 last:mb-0')}>
          <div className="rounded-xl bg-emerald-500/15 px-3 py-2">
            <p className="text-xs text-muted">You’ll get{shown > 1 && ` · ${r.cur}`}</p>
            <p className="truncate text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{money(r.get, r.cur)}</p>
          </div>
          <div className="rounded-xl bg-danger/12 px-3 py-2">
            <p className="text-xs text-muted">You owe{shown > 1 && ` · ${r.cur}`}</p>
            <p className="truncate text-lg font-bold tabular-nums text-danger">{money(r.owe, r.cur)}</p>
          </div>
        </div>
      ))}
      {people.length > 0 && (
        <>
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="mt-2 flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-sm font-medium text-accent">
            By person<ChevronDown className={cn('size-4 transition', open && 'rotate-180')} aria-hidden />
          </button>
          {open && (
            <ul className="divide-y divide-line">
              {people.map((p) => (
                <li key={p.cur + p.key} className="flex items-center gap-3 py-2">
                  <PersonDot p={{ id: p.key, name: p.name, u: p.u }} name={name({ id: p.key, name: p.name, u: p.u })} size={32} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{name({ id: p.key, name: p.name, u: p.u })}</span>
                  <span className={cn('text-sm font-semibold tabular-nums', p.amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-danger')}>
                    {p.amount > 0 ? 'owes you ' : 'you owe '}{money(Math.abs(p.amount), p.cur)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
