import { t } from '@sanga/i18n';
import { useState } from 'react';
import { Button } from '@sanga/ui/button';
import { Dialog } from '@sanga/ui/dialog';
import { Input, Label } from '@sanga/ui/input';
import { sdk } from '@sanga/sdk';
import { CURRENCIES, GROUP_KINDS, type GroupKind } from './model';
import { KindPicker } from './KindPicker';
import { createGroup } from './store';
import { GROUP_EMOJIS } from './emojis';

const LAST = 'split:currency';
const lastCurrency = () => { try { const c = localStorage.getItem(LAST); return c && CURRENCIES.includes(c) ? c : 'INR'; } catch { return 'INR'; } };
const rememberCurrency = (c: string) => { try { localStorage.setItem(LAST, c); } catch { /* storage blocked: rupees next time */ } };

/** Start a group: what it's for, a name, an icon and a currency. People are added next. */
export function NewGroupDialog({ open, currency: start, kind: startKind = 'spending', onClose, onCreated }: { open: boolean; currency?: string; kind?: GroupKind; onClose: () => void; onCreated: (gid: string) => void }) {
  const online = sdk().useOnline();
  const [kind, setKind] = useState<GroupKind>(startKind);
  const [name, setName] = useState(() => (startKind === 'cards' ? t('Credit card bills') : ''));
  const [emoji, setEmoji] = useState(() => (startKind === 'spending' ? '👥' : GROUP_KINDS.find((k) => k.id === startKind)!.emoji));
  // Picking a kind fills in its icon and (for card bills) a name, unless you've chosen your own.
  const pickKind = (k: GroupKind) => {
    const was = GROUP_KINDS.find((x) => x.id === kind)!, now = GROUP_KINDS.find((x) => x.id === k)!;
    if (emoji === '👥' || emoji === was.emoji) setEmoji(k === 'spending' ? '👥' : now.emoji);
    const suggested = [t('Credit card bills'), t('Lending & borrowing')];
    if (!name.trim() || suggested.includes(name.trim())) setName(k === 'cards' ? t('Credit card bills') : k === 'lending' ? t('Lending & borrowing') : '');
    setKind(k);
  };
  // Rupees unless you picked another currency for your last group.
  const [currency, setCurrency] = useState(() => start ?? lastCurrency());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true); setError('');
    try { const gid = await createGroup(name.trim(), emoji, currency, kind); rememberCurrency(currency); setName(''); setKind('spending'); setEmoji('👥'); onCreated(gid); }
    catch (e) { setError(e instanceof Error ? e.message : t('Couldn’t make the group')); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }} title={t('New group')} description={t('For a trip, a flat, the gym, office lunches, or just yourself. End-to-end encrypted.')}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <div><p id="ng-kind" className="mb-1.5 text-sm font-medium text-ink">{t('What’s this group for?')}</p><KindPicker id="ng-kind" value={kind} onChange={pickKind} /></div>
        <div><Label htmlFor="ng">{t('Name')}</Label><Input id="ng" maxLength={60} placeholder={t('e.g. Goa trip, Flat 4B, Gym buddies')} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div>
          <Label>{t('Icon')}</Label>
          <div className="flex flex-wrap gap-1.5">
            {GROUP_EMOJIS.map((e) => (
              <button key={e} type="button" aria-pressed={emoji === e} onClick={() => setEmoji(e)}
                className={`grid size-10 place-items-center rounded-xl text-xl ${emoji === e ? 'bg-accent/20 ring-2 ring-accent' : 'bg-panel-2 hover:bg-hover'}`}>{e}</button>
            ))}
          </div>
        </div>
        <div>
          <Label htmlFor="cur">{t('Currency')}</Label>
          <select id="cur" value={currency} onChange={(e) => setCurrency(e.target.value)} className="h-11 w-full rounded-xl border border-line bg-panel-2 px-3">{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
        </div>
        {!online && <p className="rounded-xl bg-warn-bg p-3 text-sm">{t('You’re offline. Connect to make a group.')}</p>}
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        <Button type="submit" className="w-full" loading={busy} disabled={!name.trim() || !online}>{t('Create group')}</Button>
      </form>
    </Dialog>
  );
}
