import { useMemo } from 'react';
import { CreditCard } from 'lucide-react';
import { t, tn } from '@sanga/i18n';
import { awaitingBill, billState, creditCards, daysToDue, money, unpaid, useLedger } from '@sanga/ledger';
import { today } from './model';
import { inWords } from './util';

/** Shown above every view when a card needs you: a statement whose bill isn't in yet, or a bill due soon or
 *  overdue. Cards and bills live in Accounts; this opens it. */
export function CardsBanner({ onOpen }: { onOpen: () => void }) {
  const accountsMap = useLedger((s) => s.accounts), billsMap = useLedger((s) => s.bills);
  const note = useMemo(() => {
    const now = today();
    const cards = creditCards(), bills = Object.values(billsMap);
    const byId = new Map(cards.map((c) => [c.id, c]));
    const urgent = unpaid(bills).find((b) => byId.has(b.card) && billState(b, now) !== 'later');
    if (urgent) {
      const c = byId.get(urgent.card)!, d = daysToDue(urgent, now);
      const vars = { card: c.name, amount: money(urgent.amount, c.currency) };
      return { tone: d < 0 ? 'red' : 'amber', text: d < 0 ? tn(-d, '{card}: {amount} was due {n} day ago', '{card}: {amount} was due {n} days ago', vars) : t('{card}: {amount} due {when}', { ...vars, when: inWords(d) }) };
    }
    const waiting = awaitingBill(cards, bills, now)[0];
    return waiting ? { tone: 'amber', text: t('{card}: your bill should be ready. Add the amount and due date.', { card: waiting.card.name }) } : null;
  }, [accountsMap, billsMap]);
  if (!note) return null;
  return (
    <button type="button" onClick={onOpen} className={`mt-3 flex w-full items-center gap-3 rounded-2xl border p-3 text-left text-sm font-medium ${note.tone === 'red' ? 'border-red-500/40 bg-red-500/10' : 'border-amber-500/40 bg-amber-500/10'}`}>
      <CreditCard className="size-5 shrink-0" aria-hidden /><span className="min-w-0 flex-1">{note.text}</span><span className="shrink-0 text-accent-ink">{t('Open')}</span>
    </button>
  );
}
