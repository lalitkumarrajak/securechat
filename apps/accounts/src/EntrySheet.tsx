// Money moving: into an account (salary, a refund, cashback), out of it (a purchase, a bill), or from one account
// to another (an ATM withdrawal is bank → cash; paying a card's bill is bank → card). Cashback into a card
// lowers what you owe; cashback paid into a bank account or wallet can name the card that earned it.
import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from 'lucide-react';
import { Button } from '@sanga/ui/button';
import { Dialog } from '@sanga/ui/dialog';
import { Input, Label } from '@sanga/ui/input';
import { cn } from '@sanga/ui/utils';
import { t } from '@sanga/i18n';
import { live, liveAccounts, remove, save, todayKey, useLedger, type Entry } from '@sanga/ledger';
import { label, parseAmount, SELECT, toInput } from './util';

type Kind = 'in' | 'out' | 'transfer';

export function EntrySheet({ entry, onClose }: { entry: Entry | null; onClose: () => void }) {
  if (!entry) return null;
  return <Form key={entry.id} e0={entry} onClose={onClose} />;
}

function Form({ e0, onClose }: { e0: Entry; onClose: () => void }) {
  const accountsMap = useLedger((s) => s.accounts), debitsMap = useLedger((s) => s.debits);
  const accounts = useMemo(() => liveAccounts({ ...useLedger.getState(), accounts: accountsMap }), [accountsMap]);
  const exists = !!useLedger.getState().entries[e0.id] && !useLedger.getState().entries[e0.id].deleted;
  const fromSplit = e0.ref?.startsWith('split:');
  const [kind, setKind] = useState<Kind>(e0.kind === 'adjust' ? 'in' : e0.kind);
  const [account, setAccount] = useState(e0.account || accounts[0]?.id || '');
  const [to, setTo] = useState(e0.to ?? accounts.find((a) => a.id !== (e0.account || accounts[0]?.id))?.id ?? '');
  const cur = accountsMap[account]?.currency ?? 'INR';
  const [amountText, setAmountText] = useState(e0.amount ? toInput(Math.abs(e0.amount), cur) : '');
  const [date, setDate] = useState(e0.date || todayKey());
  const [desc, setDesc] = useState(e0.desc);
  const [via, setVia] = useState(e0.via ?? '');
  const [cashback, setCashback] = useState(e0.cat === 'cashback');
  const [card, setCard] = useState(e0.card ?? '');
  const cards = useMemo(() => accounts.filter((a) => a.kind === 'credit'), [accounts]);
  const isCashback = kind === 'in' && cashback;
  const onCard = accountsMap[account]?.kind === 'credit';
  const debits = useMemo(() => live(Object.values(debitsMap)).filter((d) => d.account === account), [debitsMap, account]);
  const amount = parseAmount(amountText, cur);
  const ok = !!amount && !!account && !!date && (kind !== 'transfer' || (!!to && to !== account && accountsMap[to]?.currency === cur));

  const submit = async () => {
    if (!ok || !amount) return;
    const cat = isCashback ? 'cashback' : e0.cat === 'cashback' ? undefined : e0.cat;
    await save({ ...e0, kind, account, to: kind === 'transfer' ? to : undefined, amount, date, desc: desc.trim(), via: kind === 'out' && via ? via : undefined,
      cat, card: isCashback && !onCard && card ? card : undefined });
    onClose();
  };
  const KINDS: [Kind, string, typeof ArrowUpRight][] = [['out', t('Money out'), ArrowUpRight], ['in', t('Money in'), ArrowDownLeft], ['transfer', t('Transfer'), ArrowLeftRight]];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={exists ? t('Edit entry') : isCashback ? t('Add cashback') : kind === 'transfer' ? t('Transfer money') : t('Add an entry')}>
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        {fromSplit && <p className="rounded-xl bg-panel-2 p-3 text-sm">{t('This came from Split. Change the amount there; here you can change the account.')}</p>}
        {!fromSplit && (
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-panel-2 p-1" role="radiogroup" aria-label={t('Kind')}>
            {KINDS.map(([k, name, Icon]) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
                className={cn('flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium', kind === k ? 'bg-panel shadow-sm' : 'text-muted')}><Icon className="size-4" />{name}</button>
            ))}
          </div>
        )}
        <div><Label htmlFor="e-amt">{t('Amount ({currency})', { currency: cur })}</Label>
          <Input id="e-amt" autoFocus={!exists} disabled={fromSplit} inputMode="decimal" placeholder="0.00" value={amountText} onChange={(e) => setAmountText(e.target.value)} className="h-14 text-2xl font-semibold tabular-nums" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className={cn(kind !== 'transfer' && 'col-span-2')}><Label htmlFor="e-acc">{kind === 'transfer' ? t('From') : kind === 'in' ? t('Into') : t('From')}</Label>
            <select id="e-acc" className={SELECT} value={account} onChange={(e) => { setAccount(e.target.value); setVia(''); }}>{accounts.map((a) => <option key={a.id} value={a.id}>{label(a)}</option>)}</select></div>
          {kind === 'transfer' && <div><Label htmlFor="e-to">{t('To')}</Label>
            <select id="e-to" className={SELECT} value={to} onChange={(e) => setTo(e.target.value)}>
              <option value="" disabled>—</option>
              {accounts.filter((a) => a.id !== account).map((a) => <option key={a.id} value={a.id}>{label(a)}</option>)}</select></div>}
        </div>
        {kind === 'transfer' && to && accountsMap[to] && accountsMap[to].currency !== cur && <p className="-mt-2 text-sm text-danger">{t('Both accounts need the same currency.')}</p>}
        {kind === 'in' && !fromSplit && (
          <label className="flex items-start gap-2 rounded-xl bg-panel-2 p-3 text-sm">
            <input type="checkbox" className="mt-1" checked={cashback} onChange={(e) => setCashback(e.target.checked)} />
            <span>{t('This is cashback')}
              <span className="block text-xs text-muted">{onCard ? t('It lowers what you owe on this card, and counts as cashback the card earned.') : t('Counted as cashback, not income.')}</span></span>
          </label>
        )}
        {isCashback && !onCard && cards.length > 0 && (
          <div><Label htmlFor="e-card" hint={t('optional')}>{t('Earned on card')}</Label>
            <select id="e-card" className={SELECT} value={card} onChange={(e) => setCard(e.target.value)}>
              <option value="">—</option>
              {cards.map((a) => <option key={a.id} value={a.id}>{label(a)}</option>)}</select></div>
        )}
        {kind === 'out' && debits.length > 0 && (
          <div><Label htmlFor="e-via" hint={t('optional')}>{t('Paid with')}</Label>
            <select id="e-via" className={SELECT} value={via} onChange={(e) => setVia(e.target.value)}>
              <option value="">{t('UPI, net banking, cheque…')}</option>
              {debits.map((d) => <option key={d.id} value={d.id}>{t('Debit card {name}', { name: `${d.name}${d.last4 ? ` ••${d.last4}` : ''}` })}</option>)}</select></div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="e-date">{t('Date')}</Label><Input id="e-date" type="date" value={date} max={todayKey()} onChange={(e) => e.target.value && setDate(e.target.value)} /></div>
          <div><Label htmlFor="e-desc" hint={t('optional')}>{t('What for')}</Label>
            <Input id="e-desc" maxLength={120} disabled={fromSplit} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={isCashback ? t('e.g. Amazon cashback') : kind === 'in' ? t('e.g. Salary') : kind === 'transfer' ? t('e.g. ATM') : t('e.g. Groceries')} /></div>
        </div>
        <div className="flex items-center gap-2">
          {exists && <Button variant="ghost" className="text-danger" onClick={async () => { await remove(e0); onClose(); }}>{t('Delete')}</Button>}
          <Button type="submit" className="ml-auto" disabled={!ok}>{exists ? t('Save') : kind === 'transfer' ? t('Transfer') : t('Add')}</Button>
        </div>
      </form>
    </Dialog>
  );
}
