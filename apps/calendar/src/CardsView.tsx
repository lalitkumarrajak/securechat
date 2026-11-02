// Credit cards: when each bill is generated and due, what you owe, and the bills so far. On a card's
// statement day a reminder asks for the bill; enter the amount and due date and reminders follow.
import { useMemo } from 'react';
import { CreditCard as CardIcon, Plus } from 'lucide-react';
import { Button } from '@sanga/ui/button';
import { cn } from '@sanga/ui/utils';
import { awaitingBill, billState, daysToDue, liveBills, liveCards, money, statementDate, unpaid, addMonths, monthOf, type CardBill, type CreditCard } from './cards';
import { COLORS, newBill, newCard, today, useCal } from './model';
import { inWords, shortDay } from './util';

const TONE = { paid: 'bg-green-500/12 text-green-700 dark:text-green-300', overdue: 'bg-red-500/12 text-red-700 dark:text-red-300', soon: 'bg-amber-500/15 text-amber-700 dark:text-amber-300', later: 'bg-panel-2 text-muted' };
const LABEL = { paid: 'Paid', overdue: 'Overdue', soon: 'Due soon', later: 'Upcoming' };

export function CardsView({ onCard, onBill }: { onCard: (c: CreditCard) => void; onBill: (b: CardBill, c: CreditCard) => void }) {
  const cardsMap = useCal((s) => s.cards), billsMap = useCal((s) => s.bills);
  const now = today();
  const cards = useMemo(() => liveCards(Object.values(cardsMap)), [cardsMap]);
  const bills = useMemo(() => Object.values(billsMap), [billsMap]);
  const byId = useMemo(() => new Map(Object.values(cardsMap).map((c) => [c.id, c])), [cardsMap]);
  const waiting = useMemo(() => awaitingBill(cards, bills, now), [cards, bills, now]);
  const owing = useMemo(() => unpaid(bills).filter((b) => byId.get(b.card) && !byId.get(b.card)!.archived), [bills, byId]);
  const history = useMemo(() => liveBills(bills).filter((b) => byId.has(b.card)).sort((a, b) => b.due.localeCompare(a.due)), [bills, byId]);
  // Total still to pay, per currency.
  const totals = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of owing) { const cur = byId.get(b.card)!.currency; m.set(cur, (m.get(cur) ?? 0) + b.amount); }
    return [...m.entries()];
  }, [owing, byId]);

  if (!cards.length) {
    return (
      <div className="grid place-items-center rounded-3xl border border-line/70 bg-panel px-6 py-14 text-center shadow-sm">
        <div className="max-w-sm">
          <CardIcon className="mx-auto size-10 text-accent-ink" aria-hidden />
          <h3 className="mt-3 text-lg font-bold">Never miss a credit card bill</h3>
          <p className="mt-1 text-sm text-muted">Add a card and its statement day. On that day I’ll ask how much the bill is and when it’s due, then remind you before the due date.</p>
          <Button className="mt-4" onClick={() => onCard(newCard())}><Plus className="size-4" />Add a card</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {waiting.length > 0 && (
        <section aria-label="Bills to enter" className="space-y-2">
          {waiting.map(({ card, month, date }) => (
            <button key={card.id + month} type="button" onClick={() => onBill(newBill(card, month), card)}
              className="flex w-full items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-left">
              <span className="text-2xl" aria-hidden>🧾</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">Is your {card.name} bill ready?</span>
                <span className="block text-sm text-muted">Statement day was {shortDay(date)}. Add the amount and due date.</span>
              </span>
              <span className="rounded-full bg-amber-500 px-3 py-1 text-sm font-semibold text-white">Add bill</span>
            </button>
          ))}
        </section>
      )}

      <section aria-label="To pay" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="col-span-2 rounded-3xl p-4 text-white shadow-md sm:col-span-1" style={{ background: 'linear-gradient(135deg, #6366f1, #4338ca 60%, #312e81)' }}>
          <p className="text-sm text-white/80">Still to pay</p>
          {totals.length ? totals.map(([cur, n]) => <p key={cur} className="text-2xl font-bold tabular-nums">{money(n, cur)}</p>) : <p className="text-2xl font-bold">All clear 🎉</p>}
        </div>
        {owing.slice(0, 2).map((b) => {
          const c = byId.get(b.card)!, d = daysToDue(b, now), st = billState(b, now);
          return (
            <button key={b.id} type="button" onClick={() => onBill(b, c)} className="rounded-3xl border border-line/70 bg-panel p-4 text-left shadow-sm hover:bg-hover">
              <p className="truncate text-sm text-muted">{c.name}</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{money(b.amount, c.currency)}</p>
              <p className={cn('mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold', TONE[st])}>{d < 0 ? `${-d} day${d === -1 ? '' : 's'} overdue` : `Due ${inWords(d)}`}</p>
            </button>
          );
        })}
      </section>

      <section aria-label="Your cards">
        <div className="mb-2 flex items-center px-1">
          <h3 className="flex-1 font-semibold">Your cards</h3>
          <Button size="sm" variant="ghost" onClick={() => onCard(newCard())}><Plus className="size-4" />Add card</Button>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {cards.map((c) => {
            const next = statementDate(monthOf(now), c.statementDay) > now ? statementDate(monthOf(now), c.statementDay) : statementDate(addMonths(monthOf(now), 1), c.statementDay);
            return (
              <li key={c.id}>
                <button type="button" onClick={() => onCard(c)} className="flex w-full items-center gap-3 rounded-2xl border border-line/70 bg-panel p-3 text-left shadow-sm hover:bg-hover">
                  <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl text-white', COLORS[c.color]?.dot)} aria-hidden><CardIcon className="size-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{c.name}{c.last4 && <span className="font-normal text-muted"> ••{c.last4}</span>}</span>
                    <span className="block truncate text-sm text-muted">Statement on the {ordinal(c.statementDay)} · next {shortDay(next)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-label="Bills">
        <h3 className="mb-2 px-1 font-semibold">Bills</h3>
        {!history.length ? <p className="px-1 text-sm text-muted">Bills you enter show here, with whether each was paid.</p> : (
          <ul className="space-y-2">
            {history.map((b) => {
              const c = byId.get(b.card)!, st = billState(b, now);
              return (
                <li key={b.id}>
                  <button type="button" onClick={() => onBill(b, c)} className="flex w-full items-center gap-3 rounded-2xl border border-line/70 bg-panel p-3 text-left shadow-sm hover:bg-hover">
                    <span className={cn('size-2.5 shrink-0 rounded-full', COLORS[c.color]?.dot)} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{c.name} · {new Date(`${b.month}-01T12:00:00`).toLocaleDateString([], { month: 'long', year: 'numeric' })}</span>
                      <span className="block truncate text-sm text-muted">{money(b.amount, c.currency)} · {b.paid ? `paid ${shortDay(b.paid)}` : `due ${shortDay(b.due)}`}</span>
                    </span>
                    <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold', TONE[st])}>{LABEL[st]}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

const ordinal = (n: number) => n + (['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]);
