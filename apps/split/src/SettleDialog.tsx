import { useState } from 'react';
import { Button } from '@sanga/ui/button';
import { Dialog } from '@sanga/ui/dialog';
import { Input, Label } from '@sanga/ui/input';
import { money, parseAmount, today, toInput, validDay, type Transfer } from './model';
import { useLedger, useMe, useNames } from './hooks';
import { newId, save, type GroupData } from './store';

/** Record that one person paid another back (cash, UPI…): it's counted against what they owe. */
export function SettleDialog({ g, transfer, onClose }: { g: GroupData; transfer: Transfer | null; onClose: () => void }) {
  return (
    <Dialog open={!!transfer} onOpenChange={(o) => { if (!o) onClose(); }} title="Record a payment" description="Marks money as paid back outside the app.">
      {transfer && <Form g={g} transfer={transfer} onClose={onClose} />}
    </Dialog>
  );
}

function Form({ g, transfer, onClose }: { g: GroupData; transfer: Transfer; onClose: () => void }) {
  const me = useMe();
  const name = useNames();
  const { meta, person } = useLedger(g);
  const currency = meta?.currency ?? 'INR';
  const [amountText, setAmountText] = useState(toInput(transfer.amount, currency));
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const amount = parseAmount(amountText, currency);
  const ok = !!amount && validDay(date);
  return (
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault();
      if (!ok || !amount) return;
      save(g.gid, { type: 'settle', id: newId(), from: transfer.from, to: transfer.to, amount, date, ...(note.trim() && { note: note.trim() }), by: me, edited: 0 });
      onClose();
    }}>
      <p className="rounded-xl bg-panel-2 p-3 text-center text-sm">
        <b>{name(person(transfer.from))}</b> paid <b>{name(person(transfer.to))}</b>
        <span className="mt-1 block text-2xl font-bold tabular-nums">{money(amount ?? 0, currency)}</span>
      </p>
      <div><Label htmlFor="sa">Amount ({currency})</Label><Input id="sa" inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label htmlFor="sd">Date</Label><Input id="sd" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} /></div>
        <div><Label htmlFor="sn" hint="optional">Note</Label><Input id="sn" maxLength={100} placeholder="UPI, cash…" value={note} onChange={(e) => setNote(e.target.value)} /></div>
      </div>
      <Button type="submit" className="w-full" disabled={!ok}>Save payment</Button>
    </form>
  );
}
