import { t, tx } from '@sanga/i18n';
import { ArrowRight } from 'lucide-react';
import { money, type Person } from './model';
import { PersonDot } from './PersonDot';

export interface OweRow { key: string; from: Person; to: Person; amount: number; lent?: number; where?: string }

/** "Vikram owes You ₹5,000": who has to give whom money, one line per pair, with how much of what was
 *  lent has come back (lending), and which group it's in (across groups). */
export function WhoOwes({ title, hint, rows, currency, name, me }: {
  title: string; hint?: string; rows: OweRow[]; currency: string; name: (p: Person) => string; me: string;
}) {
  return (
    <section aria-label={title} className="rounded-2xl border border-line bg-panel p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      {rows.length === 0 ? <p className="mt-3 text-center text-sm text-muted">{t('Nobody owes anyone 🎉')}</p> : (
        <ul className="mt-2 divide-y divide-line">
          {rows.map((r) => {
            const mine = r.to.u === me || r.to.id === me ? 'in' : r.from.u === me || r.from.id === me ? 'out' : null;
            const back = r.lent && r.lent > r.amount ? r.lent - r.amount : 0;
            const from = <b>{name(r.from)}</b>, to = <b>{name(r.to)}</b>;
            return (
              <li key={r.key} className="flex items-center gap-3 py-2.5">
                <span className="flex shrink-0 items-center gap-1" aria-hidden>
                  <PersonDot p={r.from} name={name(r.from)} size={28} /><ArrowRight className="size-3.5 text-muted" /><PersonDot p={r.to} name={name(r.to)} size={28} />
                </span>
                <span className="min-w-0 flex-1 text-sm">
                  <span className="block truncate">{mine === 'out' ? tx('You owe {to}', { to }) : mine === 'in' ? tx('{from} owes you', { from }) : tx('{from} owes {to}', { from, to })}</span>
                  {(back > 0 || r.where) && (
                    <span className="block truncate text-xs text-muted">
                      {back > 0 && t('{back} of {lent} paid back', { back: money(back, currency), lent: money(r.lent!, currency) })}
                      {back > 0 && r.where && ' · '}{r.where}
                    </span>
                  )}
                </span>
                <span className={`text-sm font-semibold tabular-nums ${mine === 'in' ? 'text-emerald-600 dark:text-emerald-400' : mine === 'out' ? 'text-danger' : ''}`}>{money(r.amount, currency)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
