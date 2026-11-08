// A card's bill for one month: what you owe and when it's due; then mark it paid (from one of your
// accounts, if you like: that's a transfer to the card), say there's no bill this month, or send it to Split.
import { useMemo, useState } from 'react';
import { BarChart3, Check, Send } from 'lucide-react';
import { Button } from '@sanga/ui/button';
import { Dialog } from '@sanga/ui/dialog';
import { Input, Label } from '@sanga/ui/input';
import { sdk } from '@sanga/sdk';
import { t, tx } from '@sanga/i18n';
import { billPayment, liveAccounts, money, payBill, remove, save, skipBill, statementId, todayKey, unpayBill, useLedger, type CardBill, type CreditCard } from '@sanga/ledger';
import { label, longDay, monthTitle, parseAmount, SELECT, shortDay, toInput } from './util';

export function BillSheet({ bill, card, onClose, onSpending }: { bill: CardBill | null; card: CreditCard | null; onClose: () => void; onSpending: (statement: string) => void }) {
  if (!bill || !card) return null;
  return <Form key={bill.id + bill.edited} b={bill} card={card} onClose={onClose} onSpending={onSpending} />;
}

function Form({ b, card, onClose, onSpending }: { b: CardBill; card: CreditCard; onClose: () => void; onSpending: (statement: string) => void }) {
  const cur = card.currency;
  const saved = useLedger((s) => s.bills[b.id]);
  const statement = useLedger((s) => s.statements[statementId(card.id, b.month)]);
  const accountsMap = useLedger((s) => s.accounts);
  const payFrom = useMemo(() => liveAccounts({ ...useLedger.getState(), accounts: accountsMap }).filter((a) => a.kind !== 'credit' && a.currency === cur), [accountsMap, cur]);
  const exists = !!saved && !saved.deleted;
  const cur$ = exists ? saved : b;
  const [amount, setAmount] = useState(b.amount ? toInput(b.amount, cur) : '');
  const [min, setMin] = useState(b.minDue ? toInput(b.minDue, cur) : '');
  const [due, setDue] = useState(b.due);
  const [paidOn, setPaidOn] = useState(todayKey());
  const [from, setFrom] = useState(() => billPayment(b)?.account ?? payFrom[0]?.id ?? '');
  const [paidText, setPaidText] = useState(toInput(b.paidAmount ?? b.amount, cur));
  const total = parseAmount(amount, cur), minDue = min.trim() ? parseAmount(min, cur) : undefined;
  const paidAmount = parseAmount(paidText, cur);
  const ok = !!total && total > 0 && minDue !== null && !!due && (minDue === undefined || minDue <= total);
  const build = (): CardBill => ({ ...cur$, amount: total ?? 0, minDue: minDue ?? undefined, due, none: undefined });
  const [error, setError] = useState('');

  const toSplit = (x: CardBill) => {
    try {
      sdk().open('split', { draft: JSON.stringify({ desc: t('{card} card bill', { card: card.name }), amount: x.paidAmount ?? x.amount, cur, date: x.paid ?? todayKey(), cat: 'cards' }) });
      void save({ ...x, split: true });
    } catch (e) { setError(e instanceof Error ? e.message : t('Couldn’t open Split')); }
  };
  const generated = new Date(`${b.month}-${String(Math.min(card.statementDay, 28)).padStart(2, '0')}T12:00:00`);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`${card.name} · ${monthTitle(b.month)}`}
      description={statement ? t('Statement of {date}', { date: longDay(statement.date) }) : t('Statement bill, generated around {date}', { date: shortDay(generated.toISOString().slice(0, 10)) })}>
      {cur$.none ? (
        <div className="grid gap-4">
          <p className="rounded-2xl bg-panel-2 p-4 text-center">
            <span className="block text-2xl" aria-hidden>🎉</span>
            <span className="mt-1 block font-semibold">{t('No bill this month')}</span>
            <span className="block text-sm text-muted">{t('Nothing to pay, so there are no reminders for it.')}</span>
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" className="text-danger" onClick={async () => { await remove(cur$); onClose(); }}>{t('Remove')}</Button>
            <Button className="ml-auto" variant="outline" onClick={() => void save({ ...cur$, none: undefined })}>{t('There is a bill after all')}</Button>
          </div>
        </div>
      ) : (
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (ok) { void save(build()); onClose(); } }}>
          <div>
            <Label htmlFor="b-amt">{t('Total amount due ({currency})', { currency: cur })}</Label>
            <Input id="b-amt" autoFocus={!exists} inputMode="decimal" className="h-14 text-2xl font-semibold tabular-nums" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="b-due">{t('Due date')}</Label><Input id="b-due" type="date" required value={due} onChange={(e) => e.target.value && setDue(e.target.value)} /></div>
            <div><Label htmlFor="b-min" hint={t('optional')}>{t('Minimum due')}</Label><Input id="b-min" inputMode="decimal" placeholder="0.00" value={min} onChange={(e) => setMin(e.target.value)} /></div>
          </div>
          {minDue !== undefined && minDue !== null && total !== null && minDue > total && <p className="-mt-2 text-sm text-danger" role="alert">{t('The minimum can’t be more than the total.')}</p>}

          {!exists && (
            <button type="button" onClick={async () => { await skipBill(cur$); onClose(); }} className="rounded-xl border border-dashed border-line p-3 text-left text-sm hover:bg-hover">
              <span className="font-medium">{t('No bill this month')}</span>
              <span className="block text-muted">{t('Didn’t use the card, or it has a credit balance? Nothing to pay, and no reminders.')}</span>
            </button>
          )}

          {exists && (
            <div className="rounded-2xl border border-line p-3">
              {cur$.paid ? (
                <div className="flex items-center gap-2 text-sm">
                  <Check className="size-4 text-green-600" aria-hidden />
                  <span className="flex-1">{tx('Paid {amount} on {date}', { /* i18n-ok */ amount: <b>{money(cur$.paidAmount ?? cur$.amount, cur)}</b>, date: <b>{shortDay(cur$.paid)}</b> })}
                    {billPayment(cur$) && <span className="block text-muted">{t('from {name}', { name: accountsMap[billPayment(cur$)!.account]?.name ?? '' })}</span>}</span>
                  <button type="button" className="text-muted underline" onClick={() => void unpayBill(cur$)}>{t('Undo')}</button>
                </div>
              ) : (
                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label htmlFor="b-paid">{t('Paid on')}</Label><Input id="b-paid" type="date" max={todayKey()} value={paidOn} onChange={(e) => e.target.value && setPaidOn(e.target.value)} /></div>
                    <div><Label htmlFor="b-pa">{t('Amount paid')}</Label><Input id="b-pa" inputMode="decimal" value={paidText} onChange={(e) => setPaidText(e.target.value)} /></div>
                  </div>
                  <div><Label htmlFor="b-from">{t('Paid from')}</Label>
                    <select id="b-from" className={SELECT} value={from} onChange={(e) => setFrom(e.target.value)}>
                      {payFrom.map((a) => <option key={a.id} value={a.id}>{label(a)}</option>)}
                      <option value="">{t('An account not in Sanga')}</option>
                    </select></div>
                  <Button variant="secondary" disabled={!ok || !paidAmount} onClick={async () => { await save(build()); await payBill(build(), paidOn, paidAmount!, from || undefined); }}>
                    <Check className="size-4" />{t('Mark as paid')}</Button>
                </div>
              )}
              <div className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-sm">
                <span className="flex-1 text-muted">{cur$.split ? t('Recorded in Split.') : t('Record this payment in a Split group too.')}</span>
                <Button variant="outline" size="sm" disabled={!ok} onClick={() => toSplit({ ...build(), paid: cur$.paid, paidAmount: cur$.paidAmount })}><Send className="size-4" />{cur$.split ? t('Send again') : t('Add to Split')}</Button>
              </div>
            </div>
          )}
          {statement && (
            <Button variant="outline" onClick={() => { onClose(); onSpending(statement.id); }}><BarChart3 className="size-4" />{t('Where the money went ({n} lines)', { n: statement.txns.length })}</Button>
          )}
          {error && <p className="text-sm text-danger" role="alert">{error}</p>}
          <div className="flex items-center gap-2">
            {exists && (
              <Button variant="ghost" className="text-danger" onClick={async () => {
                if (await sdk().confirm({ title: t('Remove this bill?'), description: t('{amount} for {month}', { amount: money(cur$.amount, cur), month: monthTitle(b.month) }), confirmText: t('Remove'), destructive: true })) {
                  if (billPayment(cur$)) await unpayBill(cur$);
                  await remove(cur$); onClose();
                }
              }}>{t('Remove')}</Button>
            )}
            <Button type="submit" className="ml-auto" disabled={!ok}>{exists ? t('Save') : t('Save bill')}</Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
