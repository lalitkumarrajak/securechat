import { useState } from 'react';
import { Check, Send } from 'lucide-react';
import { Button } from '@sanga/ui/button';
import { Dialog } from '@sanga/ui/dialog';
import { Input, Label } from '@sanga/ui/input';
import { sdk } from '@sanga/sdk';
import { money, parseAmount, toInput, type CardBill, type CreditCard } from './cards';
import { remove, save, today, useCal } from './model';
import { monthTitle } from './util';

/** A card's bill for one month: what you owe and when it's due; then mark it paid, or send it to Split. */
export function BillSheet({ bill, card, onClose }: { bill: CardBill | null; card: CreditCard | null; onClose: () => void }) {
  // Each time it's opened with a record (even the same bill again, which a new one and a saved one both are),
  // the form starts afresh from it: otherwise it would show what it held last time.
  const [b, setB] = useState<CardBill | null>(bill);
  const [seen, setSeen] = useState<CardBill | null>(bill);
  const [opened, setOpened] = useState(0);
  if (bill !== seen) { setSeen(bill); setB(bill); if (bill) setOpened((n) => n + 1); }
  if (!bill || !b || !card) return null;
  return <Form key={`${b.id}:${opened}`} b={b} card={card} setB={setB} onClose={onClose} />;
}

function Form({ b, card, setB, onClose }: { b: CardBill; card: CreditCard; setB: (b: CardBill) => void; onClose: () => void }) {
  const cur = card.currency;
  const saved = useCal((s) => s.bills[b.id]);
  const exists = !!saved && !saved.deleted;
  const [amount, setAmount] = useState(b.amount ? toInput(b.amount, cur) : '');
  const [min, setMin] = useState(b.minDue ? toInput(b.minDue, cur) : '');
  const [due, setDue] = useState(b.due);
  const [paid, setPaid] = useState(b.paid ?? '');
  const total = parseAmount(amount, cur), minDue = min.trim() ? parseAmount(min, cur) : undefined;
  const ok = !!total && total > 0 && minDue !== null && !!due && (minDue === undefined || minDue <= total);
  const build = (over: Partial<CardBill> = {}): CardBill => ({ ...b, amount: total ?? 0, minDue: minDue ?? undefined, due, paid: paid || undefined, paidAmount: paid ? (b.paidAmount ?? total ?? 0) : undefined, ...over });
  const [error, setError] = useState('');

  const toSplit = (x: CardBill) => {
    try {
      sdk().open('split', { draft: JSON.stringify({ desc: `${card.name} card bill`, amount: x.paidAmount ?? x.amount, cur, date: x.paid ?? today(), cat: 'cards' }) });
      save({ ...x, split: true });
    } catch (e) { setError(e instanceof Error ? e.message : 'Couldn’t open Split'); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`${card.name} · ${monthTitle(b.month)}`} description={`Statement bill, generated ${new Date(`${b.month}-${String(card.statementDay).padStart(2, '0')}T12:00:00`).toLocaleDateString([], { day: 'numeric', month: 'long' })}`}>
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (ok) { save(build()); onClose(); } }}>
        <div>
          <Label htmlFor="b-amt">Total amount due ({cur})</Label>
          <Input id="b-amt" autoFocus={!exists} inputMode="decimal" className="h-14 text-2xl font-semibold tabular-nums" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="b-due">Due date</Label><Input id="b-due" type="date" required value={due} onChange={(e) => e.target.value && setDue(e.target.value)} /></div>
          <div><Label htmlFor="b-min" hint="optional">Minimum due</Label><Input id="b-min" inputMode="decimal" placeholder="0.00" value={min} onChange={(e) => setMin(e.target.value)} /></div>
        </div>
        {minDue !== undefined && minDue !== null && total !== null && minDue > total && <p className="-mt-2 text-sm text-danger" role="alert">The minimum can’t be more than the total.</p>}

        {exists && (
          <div className="rounded-2xl border border-line p-3">
            {paid ? (
              <div className="flex items-center gap-2 text-sm">
                <Check className="size-4 text-green-600" aria-hidden />
                <span className="flex-1">Paid on <b>{new Date(`${paid}T12:00:00`).toLocaleDateString([], { day: 'numeric', month: 'short' })}</b></span>
                <button type="button" className="text-muted underline" onClick={() => { setPaid(''); save(build({ paid: undefined, paidAmount: undefined })); }}>Undo</button>
              </div>
            ) : (
              <div className="flex items-end gap-2">
                <div className="flex-1"><Label htmlFor="b-paid">Paid on</Label><Input id="b-paid" type="date" max={today()} defaultValue={today()} onChange={(e) => e.target.value && setPaid(e.target.value)} /></div>
                <Button variant="secondary" disabled={!ok} onClick={() => { const d = paid || today(); setPaid(d); save(build({ paid: d, paidAmount: total ?? 0 })); }}><Check className="size-4" />Mark as paid</Button>
              </div>
            )}
            <div className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-sm">
              <span className="flex-1 text-muted">{b.split ? 'Sent to Split as an expense.' : 'Count this in your spending charts.'}</span>
              <Button variant="outline" size="sm" disabled={!ok} onClick={() => toSplit(build())}><Send className="size-4" />{b.split ? 'Send again' : 'Add to Split'}</Button>
            </div>
          </div>
        )}
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        <div className="flex items-center gap-2">
          {exists && (
            <Button variant="ghost" className="text-danger" onClick={async () => {
              if (await sdk().confirm({ title: 'Remove this bill?', description: `${money(b.amount, cur)} for ${monthTitle(b.month)}`, confirmText: 'Remove', destructive: true })) { remove(b); setB(b); onClose(); }
            }}>Remove</Button>
          )}
          <Button type="submit" className="ml-auto" disabled={!ok}>{exists ? 'Save' : 'Save bill'}</Button>
        </div>
      </form>
    </Dialog>
  );
}
