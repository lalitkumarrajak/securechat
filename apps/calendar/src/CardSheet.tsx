import { useState } from 'react';
import { Button } from '@sanga/ui/button';
import { Dialog } from '@sanga/ui/dialog';
import { Input, Label } from '@sanga/ui/input';
import { sdk } from '@sanga/sdk';
import { cn } from '@sanga/ui/utils';
import { COLORS, remove, save, useCal } from './model';
import { CURRENCIES, type CreditCard } from './cards';

const DAYS_BEFORE = [7, 3, 1, 0];

/** Add a credit card, or change one: the name, its statement day, and when to remind you. Never a full card number. */
export function CardSheet({ card, onClose }: { card: CreditCard | null; onClose: () => void }) {
  const [c, setC] = useState<CreditCard | null>(card);
  const [seen, setSeen] = useState<CreditCard | null>(card);
  if (card !== seen) { setSeen(card); setC(card); } // opened again: start from the card as saved, not from edits left unsaved last time
  if (!card || !c) return null;
  const set = (p: Partial<CreditCard>) => setC({ ...c, ...p });
  const exists = !!useCal.getState().cards[c.id];
  const ok = c.name.trim().length > 0 && (!c.last4 || /^\d{4}$/.test(c.last4));
  const toggle = (d: number) => set({ remind: c.remind.includes(d) ? c.remind.filter((x) => x !== d) : [...c.remind, d].sort((a, b) => b - a) });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={exists ? 'Your card' : 'Add a credit card'} description="I’ll ask for your bill on its statement day and remind you before it’s due." className="md:max-w-lg">
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (ok) { save({ ...c, name: c.name.trim() }); onClose(); } }}>
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <div><Label htmlFor="cc-name">Card name</Label><Input id="cc-name" autoFocus={!exists} maxLength={60} value={c.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. HDFC Millennia" /></div>
          <div><Label htmlFor="cc-4" hint="optional">Last 4</Label><Input id="cc-4" inputMode="numeric" maxLength={4} value={c.last4 ?? ''} onChange={(e) => set({ last4: e.target.value.replace(/\D/g, '') || undefined })} placeholder="1234" /></div>
        </div>
        <p className="-mt-2 text-xs text-muted">Only the last four digits, if you like. Never type a full card number or CVV here.</p>
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="cc-day" hint="1–31">Statement day each month</Label>
            <Input id="cc-day" type="number" min={1} max={31} value={c.statementDay} onChange={(e) => set({ statementDay: Math.min(31, Math.max(1, Math.round(Number(e.target.value)) || 1)) })} /></div>
          <div><Label htmlFor="cc-due" hint="days">Due date usually after</Label>
            <Input id="cc-due" type="number" min={0} max={60} value={c.dueAfter} onChange={(e) => set({ dueAfter: Math.min(60, Math.max(0, Math.round(Number(e.target.value)) || 0)) })} /></div>
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Remind me before the due date</legend>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Remind me before the due date">
            {DAYS_BEFORE.map((d) => (
              <button key={d} type="button" aria-pressed={c.remind.includes(d)} onClick={() => toggle(d)}
                className={cn('rounded-full border px-3 py-1.5 text-sm', c.remind.includes(d) ? 'border-accent bg-accent/12 font-medium text-accent-ink' : 'border-line hover:bg-hover')}>
                {d === 0 ? 'On the day' : d === 1 ? '1 day before' : `${d} days before`}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="cc-time">Remind me at</Label><Input id="cc-time" type="time" value={c.time} onChange={(e) => e.target.value && set({ time: e.target.value })} /></div>
          <div><Label htmlFor="cc-cur">Currency</Label>
            <select id="cc-cur" value={c.currency} onChange={(e) => set({ currency: e.target.value })} className="h-11 w-full rounded-xl border border-line bg-panel-2 px-3">{CURRENCIES.map((x) => <option key={x}>{x}</option>)}</select></div>
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Colour</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Colour">
            {Object.entries(COLORS).map(([k, v]) => (
              <button key={k} type="button" role="radio" aria-checked={c.color === k} aria-label={v.label} onClick={() => set({ color: k })}
                className={cn('size-7 rounded-full', v.dot, c.color === k && 'ring-2 ring-ink ring-offset-2 ring-offset-panel')} />
            ))}
          </div>
        </fieldset>
        <div className="flex items-center gap-2">
          {exists && (
            <Button variant="ghost" className="text-danger" onClick={async () => {
              if (await sdk().confirm({ title: `Remove ${c.name || 'this card'}?`, description: 'Its bills and reminders go too.', confirmText: 'Remove', destructive: true })) {
                const { bills } = useCal.getState();
                for (const b of Object.values(bills)) if (b.card === c.id) remove(b);
                remove(c); onClose();
              }
            }}>Remove</Button>
          )}
          <Button type="submit" className="ml-auto" disabled={!ok}>{exists ? 'Save' : 'Add card'}</Button>
        </div>
      </form>
    </Dialog>
  );
}
