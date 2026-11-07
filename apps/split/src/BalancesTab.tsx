import { locale, t, tx } from '@sanga/i18n';
import { useMemo, useState } from 'react';
import { ArrowRight, Check, Clock, Undo2, X } from 'lucide-react';
import { Button } from '@sanga/ui/button';
import { balances, kindOf, money, pairDebts, parseDay, simplify, type Transfer } from './model';
import { useLedger, useMe, useNames } from './hooks';
import { confirmPayment, removeRecord, type GroupData } from './store';
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
  // Lending: each pays back whoever lent to them. Otherwise the fewest payments that settle everyone.
  const lending = kindOf(meta) === 'lending';
  const plan = useMemo(() => (lending ? pairDebts(expenses, settles) : simplify(net)), [lending, expenses, settles, net]);
  const waiting = settles.filter((s) => s.pending), done = settles.filter((s) => !s.pending);
  const rows = people.filter((p) => net[p.id] || !p.gone).sort((a, b) => (net[b.id] ?? 0) - (net[a.id] ?? 0));

  if (!expenses.length && !settles.length) return <Empty emoji="⚖️" title={t('Nothing to settle')}>{t('Balances appear once there are expenses.')}</Empty>;
  return (
    <div className="space-y-5 px-4 pb-6">
      <section aria-label={t('Balances')}>
        <h3 className="mb-2 text-sm font-semibold">{t('Balances')}</h3>
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
          {rows.map((p) => {
            const n = net[p.id] ?? 0;
            return (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <PersonDot p={p} name={name(p)} size={36} />
                <span className="min-w-0 flex-1 truncate font-medium">{name(p)}</span>
                <span className={`text-sm font-semibold tabular-nums ${n > 0 ? 'text-emerald-600 dark:text-emerald-400' : n < 0 ? 'text-danger' : 'text-muted'}`}>
                  {n === 0 ? t('settled up') : n > 0 ? t('gets back {amount}', { amount: money(n, currency) }) : t('owes {amount}', { amount: money(-n, currency) })}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-label={t('Suggested payments')}>
        <h3 className="mb-2 text-sm font-semibold">{t('Settle up')}</h3>
        {lending && <p className="-mt-1 mb-2 text-xs text-muted">{t('Person to person: each pays back whoever lent to them.')}</p>}
        {plan.length === 0 ? <p className="rounded-2xl border border-line bg-panel p-4 text-center text-sm text-muted">{t('Everyone is settled up 🎉')}</p> : (
          <ul className="space-y-2">
            {plan.map((tr) => (
              <li key={tr.from + tr.to} className="flex items-center gap-2 rounded-2xl border border-line bg-panel p-3">
                <span className="min-w-0 flex-1 text-sm">
                  <b>{name(person(tr.from))}</b> <ArrowRight className="mx-0.5 inline size-3.5 text-muted" aria-label={t('pays')} /> <b>{name(person(tr.to))}</b>
                  <span className="block text-base font-semibold tabular-nums">{money(tr.amount, currency)}</span>
                </span>
                <Button size="sm" variant={tr.from === me || tr.to === me ? 'primary' : 'outline'} onClick={() => setPaying(tr)}>{t('Record payment')}</Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {waiting.length > 0 && (
        <section aria-label={t('Waiting for confirmation')}>
          <h3 className="mb-2 text-sm font-semibold">{t('Waiting for confirmation')}</h3>
          <ul className="space-y-2">
            {waiting.map((s) => {
              const mine = person(s.to).u === me;
              return (
                <li key={s.id} className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  <span className="flex items-start gap-2">
                    <Clock className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
                    <span className="min-w-0 flex-1">
                      {tx('{from} paid {to} {amount}', { from: name(person(s.from)), to: name(person(s.to)), amount: <b className="tabular-nums">{money(s.amount, currency)}</b> })}
                      <span className="block text-xs text-muted">
                        {parseDay(s.date).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' })}{s.note && ` · ${s.note}`}
                        {' · '}{mine ? t('recorded by {name}', { name: name(person(s.by)) }) : t('waiting for {name} to confirm', { name: name(person(s.to)) })}
                      </span>
                    </span>
                  </span>
                  <span className="mt-2 flex justify-end gap-2">
                    {mine ? (<>
                      <Button size="sm" variant="outline" onClick={() => removeRecord(g.gid, s)}><X className="size-4" />{t('Decline')}</Button>
                      <Button size="sm" onClick={() => confirmPayment(g.gid, s)}><Check className="size-4" />{t('Confirm I got it')}</Button>
                    </>) : (s.by === me || person(s.from).u === me) && (
                      <Button size="sm" variant="ghost" onClick={() => removeRecord(g.gid, s)}>{t('Cancel')}</Button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {done.length > 0 && (
        <section aria-label={t('Payments made')}>
          <h3 className="mb-2 text-sm font-semibold">{t('Payments made')}</h3>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
            {done.map((s) => (
              <li key={s.id} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  {tx('{from} paid {to} {amount}', { from: name(person(s.from)), to: name(person(s.to)), amount: <b className="tabular-nums">{money(s.amount, currency)}</b> })}
                  <span className="block text-xs text-muted">{parseDay(s.date).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' })}{s.note && ` · ${s.note}`}</span>
                </span>
                <button type="button" aria-label={t('Undo this payment')} title={t('Undo')} onClick={() => removeRecord(g.gid, s)} className="rounded-full p-2 text-muted hover:bg-hover"><Undo2 className="size-4" /></button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <SettleDialog g={g} transfer={paying} onClose={() => setPaying(null)} />
    </div>
  );
}
