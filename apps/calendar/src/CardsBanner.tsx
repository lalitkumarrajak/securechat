import { useMemo } from 'react';
import { CreditCard } from 'lucide-react';
import { awaitingBill, billState, daysToDue, liveCards, money, unpaid } from './cards';
import { today, useCal } from './model';
import { inWords } from './util';

/** Shown above every view when a card needs you: a statement whose bill isn't entered, or a bill due soon or overdue. */
export function CardsBanner({ onOpen }: { onOpen: () => void }) {
  const cardsMap = useCal((s) => s.cards), billsMap = useCal((s) => s.bills);
  const note = useMemo(() => {
    const now = today();
    const cards = liveCards(Object.values(cardsMap)), bills = Object.values(billsMap);
    const byId = new Map(cards.map((c) => [c.id, c]));
    const urgent = unpaid(bills).find((b) => byId.has(b.card) && billState(b, now) !== 'later');
    if (urgent) {
      const c = byId.get(urgent.card)!, d = daysToDue(urgent, now);
      return { tone: d < 0 ? 'red' : 'amber', text: `${c.name}: ${money(urgent.amount, c.currency)} ${d < 0 ? `was due ${-d} day${d === -1 ? '' : 's'} ago` : `due ${inWords(d)}`}` };
    }
    const waiting = awaitingBill(cards, bills, now)[0];
    return waiting ? { tone: 'amber', text: `${waiting.card.name}: your bill should be ready. Add the amount and due date.` } : null;
  }, [cardsMap, billsMap]);
  if (!note) return null;
  return (
    <button type="button" onClick={onOpen} className={`mt-3 flex w-full items-center gap-3 rounded-2xl border p-3 text-left text-sm font-medium ${note.tone === 'red' ? 'border-red-500/40 bg-red-500/10' : 'border-amber-500/40 bg-amber-500/10'}`}>
      <CreditCard className="size-5 shrink-0" aria-hidden /><span className="min-w-0 flex-1">{note.text}</span><span className="shrink-0 text-accent-ink">Open</span>
    </button>
  );
}
