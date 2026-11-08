// A debit card on a bank account: its name, network, last four digits and expiry. Spending with it
// comes out of that account. Never the full number or the CVV.
import { useState } from 'react';
import { Button } from '@sanga/ui/button';
import { Dialog } from '@sanga/ui/dialog';
import { Input, Label, Textarea } from '@sanga/ui/input';
import { t } from '@sanga/i18n';
import { NETWORKS, remove, save, useLedger, type DebitCard } from '@sanga/ledger';
import { NETWORK_NAMES, SELECT } from './util';

export function DebitSheet({ card, onClose }: { card: DebitCard | null; onClose: () => void }) {
  if (!card) return null;
  return <Form key={card.id} d0={card} onClose={onClose} />;
}

function Form({ d0, onClose }: { d0: DebitCard; onClose: () => void }) {
  const [d, setD] = useState(d0);
  const set = (p: Partial<DebitCard>) => setD({ ...d, ...p });
  const exists = !!useLedger.getState().debits[d.id] && !useLedger.getState().debits[d.id].deleted;
  const expiryOk = !d.expiry || /^(0[1-9]|1[0-2])\/\d\d$/.test(d.expiry);
  const ok = d.name.trim().length > 0 && expiryOk && (!d.last4 || /^\d{4}$/.test(d.last4));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={exists ? t('Debit card') : t('Add a debit card')} description={t('What you pay with it comes out of this account.')}>
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (ok) { void save({ ...d, name: d.name.trim() }); onClose(); } }}>
        <div><Label htmlFor="d-name">{t('Name')}</Label><Input id="d-name" autoFocus={!exists} maxLength={60} value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder={t('e.g. HDFC Debit')} /></div>
        <div className="grid grid-cols-3 gap-3">
          <div><Label htmlFor="d-net">{t('Network')}</Label>
            <select id="d-net" className={SELECT} value={d.network ?? ''} onChange={(e) => set({ network: (e.target.value || undefined) as DebitCard['network'] })}>
              <option value="">—</option>{NETWORKS.map((n) => <option key={n} value={n}>{n === 'other' ? t(NETWORK_NAMES[n]) : NETWORK_NAMES[n]}</option>)}</select></div>
          <div><Label htmlFor="d-4">{t('Last 4')}</Label><Input id="d-4" inputMode="numeric" maxLength={4} value={d.last4 ?? ''} onChange={(e) => set({ last4: e.target.value.replace(/\D/g, '') || undefined })} placeholder="1234" /></div>
          <div><Label htmlFor="d-exp">{t('Expiry')}</Label><Input id="d-exp" inputMode="numeric" maxLength={5} value={d.expiry ?? ''} placeholder={t('MM/YY')}
            onChange={(e) => { const x = e.target.value.replace(/\D/g, '').slice(0, 4); set({ expiry: (x.length > 2 ? `${x.slice(0, 2)}/${x.slice(2)}` : x) || undefined }); }} /></div>
        </div>
        {!expiryOk && <p className="-mt-2 text-sm text-danger" role="alert">{t('Expiry is month and year, like 08/29.')}</p>}
        <div><Label htmlFor="d-noc" hint={t('optional')}>{t('Name on card')}</Label><Input id="d-noc" maxLength={80} value={d.nameOnCard ?? ''} onChange={(e) => set({ nameOnCard: e.target.value || undefined })} /></div>
        <p className="-mt-2 text-xs text-muted">{t('Only the last four digits. Never type the full card number or the CVV here.')}</p>
        <div><Label htmlFor="d-notes" hint={t('optional')}>{t('Notes')}</Label><Textarea id="d-notes" rows={2} maxLength={1000} value={d.notes ?? ''} onChange={(e) => set({ notes: e.target.value || undefined })} /></div>
        <div className="flex items-center gap-2">
          {exists && <Button variant="ghost" className="text-danger" onClick={async () => { await remove(d0); onClose(); }}>{t('Remove')}</Button>}
          <Button type="submit" className="ml-auto" disabled={!ok}>{exists ? t('Save') : t('Add card')}</Button>
        </div>
      </form>
    </Dialog>
  );
}
