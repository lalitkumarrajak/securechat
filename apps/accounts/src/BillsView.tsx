// Credit card bills: statements whose bill isn't in yet (add it, or say there's none this month), what's
// still to pay, and every bill so far. A statement PDF or bank SMS fills a bill in by itself (Import).
import { useMemo } from 'react';
import { FileUp, Plus } from 'lucide-react';
import { Button } from '@sanga/ui/button';
import { cn } from '@sanga/ui/utils';
import { t, tk, tn } from '@sanga/i18n';
import { awaitingBill, billState, creditCards, daysToDue, liveBills, money, newBill, skipBill, todayKey, unpaid, useLedger, type CardBill, type CreditCard } from '@sanga/ledger';
import { CARD_BG } from '@sanga/ledger';
import { monthTitle, shortDay } from './util';

export const TONE = { none: 'bg-panel-2 text-muted', paid: 'bg-green-500/12 text-green-700 dark:text-green-300', overdue: 'bg-red-500/12 text-red-700 dark:text-red-300', soon: 'bg-amber-500/15 text-amber-700 dark:text-amber-300', later: 'bg-panel-2 text-muted' };
export const STATE_LABEL = { none: tk('No bill'), paid: tk('Paid'), overdue: tk('Overdue'), soon: tk('Due soon'), later: tk('Upcoming') };
const inWords = (n: number) => (n === 0 ? t('today') : n === 1 ? t('tomorrow') : t('in {n} days', { n }));

export function BillsView({ onBill, onImport, onAddCard, card }: { onBill: (b: CardBill, c: CreditCard) => void; onImport: () => void; onAddCard: () => void; card?: string }) {
  const s = useLedger();
  const now = todayKey();
  const cards = useMemo(() => creditCards(s).filter((c) => !card || c.id === card), [s, card]);
  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const bills = useMemo(() => Object.values(s.bills).filter((b) => byId.has(b.card)), [s.bills, byId]);
  const waiting = useMemo(() => awaitingBill(cards, bills, now), [cards, bills, now]);
  const owing = useMemo(() => unpaid(bills), [bills]);
  const history = useMemo(() => liveBills(bills).sort((a, b) => b.month.localeCompare(a.month) || b.due.localeCompare(a.due)), [bills]);
  const totals = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of owing) { const cur = byId.get(b.card)!.currency; m.set(cur, (m.get(cur) ?? 0) + b.amount); }
    return [...m.entries()];
  }, [owing, byId]);

  if (!cards.length) {
    return (
      <div className="grid place-items-center rounded-3xl border border-line/70 bg-panel px-6 py-12 text-center shadow-sm">
        <div className="max-w-sm">
          <span className="text-4xl" aria-hidden>💳</span>
          <h3 className="mt-2 text-lg font-bold">{t('Never miss a credit card bill')}</h3>
          <p className="mt-1 text-sm text-muted">{t('Add a card and its statement day. Share the bank’s statement or SMS to Sanga and the bill fills itself in; you’re reminded before it’s due.')}</p>
          <Button className="mt-4" onClick={onAddCard}><Plus className="size-4" />{t('Add a credit card')}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {!card && (
        <button type="button" onClick={onImport} className="flex w-full items-center gap-3 rounded-2xl border border-accent/40 bg-accent/8 p-3.5 text-left hover:bg-accent/12">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent-ink"><FileUp className="size-5" /></span>
          <span className="min-w-0 flex-1"><span className="block font-semibold">{t('Import a statement')}</span>
            <span className="block text-sm text-muted">{t('A statement PDF or the bank’s SMS: the bill, dates and every purchase, read on this phone.')}</span></span>
        </button>
      )}

      {waiting.length > 0 && (
        <section aria-label={t('Bills to enter')} className="space-y-2">
          {waiting.map(({ card: c, month, date }) => (
            <div key={c.id + month} className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3.5">
              <p className="font-semibold">{t('Is your {card} bill ready?', { card: c.name })}</p>
              <p className="text-sm text-muted">{t('Statement day was {date}. Add the amount and due date, or import the statement.', { date: shortDay(date) })}</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => onBill(newBill(c, month), c)}>{t('Add bill')}</Button>
                <Button size="sm" variant="outline" onClick={onImport}>{t('Import')}</Button>
                <Button size="sm" variant="ghost" onClick={() => void skipBill(newBill(c, month))}>{t('No bill this month')}</Button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section aria-label={t('To pay')} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="col-span-2 rounded-3xl p-4 text-white shadow-md sm:col-span-1" style={{ background: 'linear-gradient(135deg, #6366f1, #4338ca 60%, #312e81)' }}>
          <p className="text-sm text-white/80">{t('Still to pay')}</p>
          {totals.length ? totals.map(([cur, n]) => <p key={cur} className="text-2xl font-bold tabular-nums">{money(n, cur)}</p>) : <p className="text-2xl font-bold">{t('All clear 🎉')}</p>}
        </div>
        {owing.slice(0, 2).map((b) => {
          const c = byId.get(b.card)!, d = daysToDue(b, now), st = billState(b, now);
          return (
            <button key={b.id} type="button" onClick={() => onBill(b, c)} className="rounded-3xl border border-line/70 bg-panel p-4 text-left shadow-sm hover:bg-hover">
              <p className="truncate text-sm text-muted">{c.name}</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{money(b.amount, c.currency)}</p>
              <p className={cn('mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold', TONE[st])}>{d < 0 ? tn(-d, '{n} day overdue', '{n} days overdue') : t('Due {when}', { when: inWords(d) })}</p>
            </button>
          );
        })}
      </section>

      <section aria-label={t('Bills')}>
        <h3 className="mb-2 px-1 font-semibold">{t('Bills')}</h3>
        {!history.length ? <p className="px-1 text-sm text-muted">{t('Bills you enter or import show here, with whether each was paid.')}</p> : (
          <ul className="space-y-2">
            {history.map((b) => {
              const c = byId.get(b.card)!, st = billState(b, now);
              return (
                <li key={b.id}>
                  <button type="button" onClick={() => onBill(b, c)} className="flex w-full items-center gap-3 rounded-2xl border border-line/70 bg-panel p-3 text-left shadow-sm hover:bg-hover">
                    <span className="size-3 shrink-0 rounded-full" style={{ background: CARD_BG[c.color] }} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{c.name} · {monthTitle(b.month)}</span>
                      <span className="block truncate text-sm text-muted">{b.none ? t('Nothing to pay') : `${money(b.amount, c.currency)} · ${b.paid ? t('paid {date}', { date: shortDay(b.paid) }) : t('due {date}', { date: shortDay(b.due) })}`}</span>
                    </span>
                    <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold', TONE[st])}>{t(STATE_LABEL[st])}</span>
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
