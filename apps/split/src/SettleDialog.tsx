import { t, tx } from '@sanga/i18n';
import { useState } from 'react';
import { Button } from '@sanga/ui/button';
import { Dialog } from '@sanga/ui/dialog';
import { Input, Label } from '@sanga/ui/input';
import { money, needsConfirm, parseAmount, today, toInput, validDay, type Transfer } from './model';
import { useLedger, useMe, useNames } from './hooks';
import { newId, save, type GroupData } from './store';
import { applyPaidFrom, PaidFromField, refOf, usePaidFrom } from './PaidFrom';

/** Record that one person paid another back (cash, UPI…): it's counted against what they owe. */
export function SettleDialog({ g, transfer, onClose }: { g: GroupData; transfer: Transfer | null; onClose: () => void }) {
  return (
    <Dialog open={!!transfer} onOpenChange={(o) => { if (!o) onClose(); }} title={t('Record a payment')} description={t('Marks money as paid back outside the app.')}>
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
  const to = person(transfer.to);
  const bold = (s: string) => <b>{s}</b>;
  const confirm = needsConfirm(g.meta?.people.find((p) => p.id === transfer.to) ?? to, me);
  // My side of it: out of one of my accounts when I pay, into one when I'm paid.
  const [id] = useState(newId);
  const mine = g.meta?.people.find((p) => p.u === me || p.id === me)?.id;
  const dir = transfer.from === mine ? 'out' : transfer.to === mine ? 'in' : null;
  const acct = usePaidFrom(refOf(g.gid, id), currency);
  return (
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault();
      if (!ok || !amount) return;
      if (dir) void applyPaidFrom(refOf(g.gid, id), acct.choice, { kind: dir, amount, date, desc: note.trim() || t('Paid back in {group}', { group: g.meta?.name ?? '' }) });
      save(g.gid, { type: 'settle', id, from: transfer.from, to: transfer.to, amount, date, ...(note.trim() && { note: note.trim() }), ...(confirm && { pending: true as const }), by: me, edited: 0 });
      onClose();
    }}>
      <p className="rounded-xl bg-panel-2 p-3 text-center text-sm">
        {tx('{from} paid {to}', { from: bold(name(person(transfer.from))), to: bold(name(person(transfer.to))) })}
        <span className="mt-1 block text-2xl font-bold tabular-nums">{money(amount ?? 0, currency)}</span>
      </p>
      <div><Label htmlFor="sa">{t('Amount ({currency})', { currency })}</Label><Input id="sa" inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label htmlFor="sd">{t('Date')}</Label><Input id="sd" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} /></div>
        <div><Label htmlFor="sn" hint={t('optional')}>{t('Note')}</Label><Input id="sn" maxLength={100} placeholder={t('UPI, cash…')} value={note} onChange={(e) => setNote(e.target.value)} /></div>
      </div>
      {dir && acct.ready && <PaidFromField id="settle-acct" label={dir === 'out' ? t('Paid from') : t('Received into')} value={acct.choice} onChange={acct.setChoice} options={acct.options} last={acct.last} />}
      {confirm && <p className="rounded-xl bg-warn-bg p-3 text-sm">{t('{name} will be asked to confirm they got it. It counts once they do.', { name: name(to) })}</p>}
      <Button type="submit" className="w-full" disabled={!ok}>{confirm ? t('Send for confirmation') : t('Save payment')}</Button>
    </form>
  );
}
