// Add an account (bank, credit card, cash, wallet) or change one: its details, and what's in it now.
// Never a full card or account number, and never a CVV.
import { useState } from 'react';
import { Button } from '@sanga/ui/button';
import { Dialog } from '@sanga/ui/dialog';
import { Input, Label, Textarea } from '@sanga/ui/input';
import { sdk } from '@sanga/sdk';
import { cn } from '@sanga/ui/utils';
import { t, tn } from '@sanga/i18n';
import { balances, CARD_BG, COLORS, CURRENCIES, NETWORKS, removeAccount, save, setBalance, useLedger, type Account } from '@sanga/ledger';
import { ACC_TYPES, KINDS, NETWORK_NAMES, parseAmount, parseSigned, SELECT, toInput } from './util';

const DAYS_BEFORE = [7, 3, 1, 0];

export function AccountSheet({ account, onClose }: { account: Account | null; onClose: () => void }) {
  if (!account) return null;
  return <Form key={account.id} a0={account} onClose={onClose} />;
}

function Form({ a0, onClose }: { a0: Account; onClose: () => void }) {
  const [a, setA] = useState(a0);
  const set = (p: Partial<Account>) => setA({ ...a, ...p });
  const exists = !!useLedger.getState().accounts[a.id] && !useLedger.getState().accounts[a.id].deleted;
  const cur = a.currency, credit = a.kind === 'credit';
  const now = exists ? (balances().get(a.id) ?? a.opening) : a.opening;
  // A card shows what you owe (positive); everything else what's in it (can go below zero: an overdraft).
  const [balText, setBalText] = useState(() => (credit ? (now <= 0 ? toInput(-now, cur) : `-${toInput(now, cur)}`) : (now ? toInput(now, cur) : '')));
  const [limitText, setLimitText] = useState(a.limit ? toInput(a.limit, cur) : '');
  const bal = balText.trim() ? parseSigned(balText, cur) : 0;
  const limit = limitText.trim() ? parseAmount(limitText, cur) : undefined;
  const expiryOk = !a.expiry || /^(0[1-9]|1[0-2])\/\d\d$/.test(a.expiry);
  const ok = a.name.trim().length > 0 && bal !== null && limit !== null && expiryOk && (!a.last4 || /^\d{4}$/.test(a.last4)) && (!a.acc4 || /^\d{4}$/.test(a.acc4));
  const toggle = (d: number) => { const r = a.remind ?? []; set({ remind: r.includes(d) ? r.filter((x) => x !== d) : [...r, d].sort((x, y) => y - x) }); };
  const Icon = KINDS[a.kind].icon;

  const submit = async () => {
    if (!ok || bal === null) return;
    const target = credit ? -bal : bal;
    const rec: Account = { ...a, name: a.name.trim(), limit: limit ?? undefined, ifsc: a.ifsc?.toUpperCase() || undefined };
    if (!exists) { await save({ ...rec, opening: target }); }
    else { await save(rec); if (target !== now) await setBalance(rec, target); }
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={exists ? t('Edit {kind}', { kind: t(KINDS[a.kind].one).toLowerCase() }) : t('Add {kind}', { kind: t(KINDS[a.kind].one).toLowerCase() })} className="md:max-w-lg">
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <div className="flex items-center gap-3 rounded-2xl p-4 text-white" style={{ background: CARD_BG[a.color] }}>
          <span className="grid size-10 place-items-center rounded-xl bg-white/20"><Icon className="size-5" /></span>
          <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{a.name || t(KINDS[a.kind].one)}</span>
            <span className="block truncate text-sm text-white/80">{[a.bank, a.last4 && `•• ${a.last4}`, a.acc4 && `•• ${a.acc4}`].filter(Boolean).join(' · ')}</span></span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className={cn(a.kind === 'cash' && 'col-span-2')}><Label htmlFor="a-name">{t('Name')}</Label>
            <Input id="a-name" autoFocus={!exists} maxLength={60} value={a.name} onChange={(e) => set({ name: e.target.value })}
              placeholder={credit ? t('e.g. Millennia') : a.kind === 'bank' ? t('e.g. HDFC Savings') : a.kind === 'wallet' ? t('e.g. Paytm') : t('Cash')} /></div>
          {a.kind !== 'cash' && <div><Label htmlFor="a-bank" hint={t('optional')}>{a.kind === 'wallet' ? t('Provider') : t('Bank')}</Label>
            <Input id="a-bank" maxLength={60} value={a.bank ?? ''} onChange={(e) => set({ bank: e.target.value || undefined })} placeholder={t('e.g. HDFC Bank')} /></div>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="a-bal">{credit ? t('Amount you owe now') : t('Balance now')}</Label>
            <Input id="a-bal" inputMode="decimal" placeholder="0.00" value={balText} onChange={(e) => setBalText(e.target.value)} className="tabular-nums" /></div>
          {credit
            ? <div><Label htmlFor="a-limit">{t('Credit limit')}</Label><Input id="a-limit" inputMode="decimal" placeholder="0.00" value={limitText} onChange={(e) => setLimitText(e.target.value)} className="tabular-nums" /></div>
            : <div><Label htmlFor="a-cur">{t('Currency')}</Label><select id="a-cur" className={SELECT} value={cur} onChange={(e) => set({ currency: e.target.value })}>{CURRENCIES.map((x) => <option key={x}>{x}</option>)}</select></div>}
        </div>
        {bal === null && <p className="-mt-2 text-sm text-danger" role="alert">{t('That isn’t an amount.')}</p>}
        {exists && bal !== null && (credit ? -bal : bal) !== now && <p className="-mt-2 text-xs text-muted">{t('The difference is kept as a correction in its history.')}</p>}

        {a.kind === 'bank' && (
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="a-type">{t('Account type')}</Label>
              <select id="a-type" className={SELECT} value={a.accType ?? 'savings'} onChange={(e) => set({ accType: e.target.value as Account['accType'] })}>
                {Object.entries(ACC_TYPES).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}</select></div>
            <div><Label htmlFor="a-acc4" hint={t('optional')}>{t('Account no. last 4')}</Label>
              <Input id="a-acc4" inputMode="numeric" maxLength={4} value={a.acc4 ?? ''} onChange={(e) => set({ acc4: e.target.value.replace(/\D/g, '') || undefined })} placeholder="1234" /></div>
            <div><Label htmlFor="a-ifsc" hint={t('optional')}>IFSC</Label>{/* i18n-ok */}
              <Input id="a-ifsc" maxLength={11} value={a.ifsc ?? ''} onChange={(e) => set({ ifsc: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') || undefined })} placeholder="HDFC0001234" /></div>
            <div><Label htmlFor="a-holder" hint={t('optional')}>{t('Account holder')}</Label>
              <Input id="a-holder" maxLength={80} value={a.holder ?? ''} onChange={(e) => set({ holder: e.target.value || undefined })} /></div>
          </div>
        )}

        {credit && (<>
          <div className="grid grid-cols-3 gap-3">
            <div><Label htmlFor="a-net">{t('Network')}</Label>
              <select id="a-net" className={SELECT} value={a.network ?? ''} onChange={(e) => set({ network: (e.target.value || undefined) as Account['network'] })}>
                <option value="">—</option>{NETWORKS.map((n) => <option key={n} value={n}>{n === 'other' ? t(NETWORK_NAMES[n]) : NETWORK_NAMES[n]}</option>)}</select></div>
            <div><Label htmlFor="a-4">{t('Last 4')}</Label>
              <Input id="a-4" inputMode="numeric" maxLength={4} value={a.last4 ?? ''} onChange={(e) => set({ last4: e.target.value.replace(/\D/g, '') || undefined })} placeholder="1234" /></div>
            <div><Label htmlFor="a-exp">{t('Expiry')}</Label>
              <Input id="a-exp" inputMode="numeric" maxLength={5} value={a.expiry ?? ''} placeholder={t('MM/YY')}
                onChange={(e) => { const d = e.target.value.replace(/\D/g, '').slice(0, 4); set({ expiry: (d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d) || undefined }); }} /></div>
          </div>
          {!expiryOk && <p className="-mt-2 text-sm text-danger" role="alert">{t('Expiry is month and year, like 08/29.')}</p>}
          <div><Label htmlFor="a-noc" hint={t('optional')}>{t('Name on card')}</Label>
            <Input id="a-noc" maxLength={80} value={a.nameOnCard ?? ''} onChange={(e) => set({ nameOnCard: e.target.value || undefined })} /></div>
          <p className="-mt-2 text-xs text-muted">{t('Only the last four digits. Never type the full card number or the CVV here.')}</p>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="a-day" hint="1–31">{t('Statement day each month')}</Label>
              <Input id="a-day" type="number" min={1} max={31} value={a.statementDay ?? 1} onChange={(e) => set({ statementDay: Math.min(31, Math.max(1, Math.round(Number(e.target.value)) || 1)) })} /></div>
            <div><Label htmlFor="a-due" hint={t('days')}>{t('Due date usually after')}</Label>
              <Input id="a-due" type="number" min={0} max={60} value={a.dueAfter ?? 20} onChange={(e) => set({ dueAfter: Math.min(60, Math.max(0, Math.round(Number(e.target.value)) || 0)) })} /></div>
          </div>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">{t('Remind me before the due date')}</legend>
            <div className="flex flex-wrap gap-2">
              {DAYS_BEFORE.map((d) => (
                <button key={d} type="button" aria-pressed={(a.remind ?? []).includes(d)} onClick={() => toggle(d)}
                  className={cn('rounded-full border px-3 py-1.5 text-sm', (a.remind ?? []).includes(d) ? 'border-accent bg-accent/12 font-medium text-accent-ink' : 'border-line hover:bg-hover')}>
                  {d === 0 ? t('On the day') : tn(d, '{n} day before', '{n} days before')}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="a-time">{t('Remind me at')}</Label><Input id="a-time" type="time" value={a.time ?? '09:00'} onChange={(e) => e.target.value && set({ time: e.target.value })} /></div>
            <div><Label htmlFor="a-cur2">{t('Currency')}</Label><select id="a-cur2" className={SELECT} value={cur} onChange={(e) => set({ currency: e.target.value })}>{CURRENCIES.map((x) => <option key={x}>{x}</option>)}</select></div>
          </div>
        </>)}

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">{t('Colour')}</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('Colour')}>
            {COLORS.map((k) => <button key={k} type="button" role="radio" aria-checked={a.color === k} aria-label={k} onClick={() => set({ color: k })}
              className={cn('size-7 rounded-full', a.color === k && 'ring-2 ring-ink ring-offset-2 ring-offset-panel')} style={{ background: CARD_BG[k] }} />)}
          </div>
        </fieldset>
        <div><Label htmlFor="a-notes" hint={t('optional')}>{t('Notes')}</Label><Textarea id="a-notes" rows={2} maxLength={1000} value={a.notes ?? ''} onChange={(e) => set({ notes: e.target.value || undefined })} /></div>

        <div className="flex flex-wrap items-center gap-2">
          {exists && (<>
            <Button variant="ghost" className="text-danger" onClick={async () => {
              if (await sdk().confirm({ title: t('Remove {name}?', { name: a0.name }), description: t('Its history, cards, bills and statements go too. Transfers stay with the other account.'), confirmText: t('Remove'), destructive: true })) { await removeAccount(a0); onClose(); }
            }}>{t('Remove')}</Button>
            <Button variant="ghost" onClick={async () => { await save({ ...a0, archived: !a0.archived }); onClose(); }}>{a0.archived ? t('Show again') : t('Hide')}</Button>
          </>)}
          <Button type="submit" className="ml-auto" disabled={!ok}>{exists ? t('Save') : t('Add')}</Button>
        </div>
      </form>
    </Dialog>
  );
}
