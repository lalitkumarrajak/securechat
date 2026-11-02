import { useMemo, useState } from 'react';
import { ArrowRight, Undo2 } from 'lucide-react';
import { Button } from '@sanga/ui/button';
import { balances, money, parseDay, simplify, type Transfer } from './model';
import { useLedger, useMe, useNames } from './hooks';
import { removeRecord, type GroupData } from './store';
import { Empty } from './Empty';
import { PersonDot } from './PersonDot';
import { SettleDialog } from './SettleDialog';

/** Who is owed and who owes, the few payments that would settle it all, and payments made so far. */
export function BalancesTab({ g }: { g: GroupData }) {
  const me = useMe();
  const name = useNames();
  const { meta, expenses, settles, people, person } = useLedger(g);
  const [paying, setPaying] = useState<Transfer | null>(null);
  const currency = meta?.currency ?? 'INR';
  const net = useMemo(() => balances(expenses, settles), [expenses, settles]);
  const plan = useMemo(() => simplify(net), [net]);
  const rows = people.filter((p) => net[p.id] || !p.gone).sort((a, b) => (net[b.id] ?? 0) - (net[a.id] ?? 0));

  if (!expenses.length && !settles.length) return <Empty emoji="⚖️" title="Nothing to settle">Balances appear once there are expenses.</Empty>;
  return (
    <div className="space-y-5 px-4 pb-6">
      <section aria-label="Balances">
        <h3 className="mb-2 text-sm font-semibold">Balances</h3>
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
          {rows.map((p) => {
            const n = net[p.id] ?? 0;
            return (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <PersonDot p={p} name={name(p)} size={36} />
                <span className="min-w-0 flex-1 truncate font-medium">{name(p)}</span>
                <span className={`text-sm font-semibold tabular-nums ${n > 0 ? 'text-emerald-600 dark:text-emerald-400' : n < 0 ? 'text-danger' : 'text-muted'}`}>
                  {n === 0 ? 'settled up' : n > 0 ? `gets back ${money(n, currency)}` : `owes ${money(-n, currency)}`}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-label="Suggested payments">
        <h3 className="mb-2 text-sm font-semibold">Settle up</h3>
        {plan.length === 0 ? <p className="rounded-2xl border border-line bg-panel p-4 text-center text-sm text-muted">Everyone is settled up 🎉</p> : (
          <ul className="space-y-2">
            {plan.map((t) => (
              <li key={t.from + t.to} className="flex items-center gap-2 rounded-2xl border border-line bg-panel p-3">
                <span className="min-w-0 flex-1 text-sm">
                  <b>{name(person(t.from))}</b> <ArrowRight className="mx-0.5 inline size-3.5 text-muted" aria-label="pays" /> <b>{name(person(t.to))}</b>
                  <span className="block text-base font-semibold tabular-nums">{money(t.amount, currency)}</span>
                </span>
                <Button size="sm" variant={t.from === me || t.to === me ? 'primary' : 'outline'} onClick={() => setPaying(t)}>Record payment</Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {settles.length > 0 && (
        <section aria-label="Payments made">
          <h3 className="mb-2 text-sm font-semibold">Payments made</h3>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
            {settles.map((s) => (
              <li key={s.id} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  {name(person(s.from))} paid {name(person(s.to))} <b className="tabular-nums">{money(s.amount, currency)}</b>
                  <span className="block text-xs text-muted">{parseDay(s.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}{s.note && ` · ${s.note}`}</span>
                </span>
                <button type="button" aria-label="Undo this payment" title="Undo" onClick={() => removeRecord(g.gid, s)} className="rounded-full p-2 text-muted hover:bg-hover"><Undo2 className="size-4" /></button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <SettleDialog g={g} transfer={paying} onClose={() => setPaying(null)} />
    </div>
  );
}
