import { useState } from 'react';
import { Button } from '@sanga/ui/button';
import { Dialog } from '@sanga/ui/dialog';
import { Input, Label } from '@sanga/ui/input';
import { sdk } from '@sanga/sdk';
import { CURRENCIES } from './model';
import { createGroup } from './store';
import { GROUP_EMOJIS } from './emojis';

/** Start a group: a name, an icon and a currency. People are added next. */
export function NewGroupDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (gid: string) => void }) {
  const online = sdk().useOnline();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('👥');
  const [currency, setCurrency] = useState(() => (/^en-IN|hi|-IN$/.test(navigator.language) ? 'INR' : 'USD'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true); setError('');
    try { const gid = await createGroup(name.trim(), emoji, currency); setName(''); onCreated(gid); }
    catch (e) { setError(e instanceof Error ? e.message : 'Couldn’t make the group'); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }} title="New group" description="For a trip, a flat, the gym, office lunches, or just yourself. End-to-end encrypted.">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <div><Label htmlFor="ng">Name</Label><Input id="ng" autoFocus maxLength={60} placeholder="e.g. Goa trip, Flat 4B, Gym buddies" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div>
          <Label>Icon</Label>
          <div className="flex flex-wrap gap-1.5">
            {GROUP_EMOJIS.map((e) => (
              <button key={e} type="button" aria-pressed={emoji === e} onClick={() => setEmoji(e)}
                className={`grid size-10 place-items-center rounded-xl text-xl ${emoji === e ? 'bg-accent/20 ring-2 ring-accent' : 'bg-panel-2 hover:bg-hover'}`}>{e}</button>
            ))}
          </div>
        </div>
        <div>
          <Label htmlFor="cur">Currency</Label>
          <select id="cur" value={currency} onChange={(e) => setCurrency(e.target.value)} className="h-11 w-full rounded-xl border border-line bg-panel-2 px-3">{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
        </div>
        {!online && <p className="rounded-xl bg-warn-bg p-3 text-sm">You’re offline. Connect to make a group.</p>}
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        <Button type="submit" className="w-full" loading={busy} disabled={!name.trim() || !online}>Create group</Button>
      </form>
    </Dialog>
  );
}
