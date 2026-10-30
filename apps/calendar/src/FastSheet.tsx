import { useState } from 'react';
import { Button } from '@sanga/ui/button';
import { Dialog } from '@sanga/ui/dialog';
import { Input, Label, Textarea } from '@sanga/ui/input';
import { sdk } from '@sanga/sdk';
import { cn } from '@sanga/ui/utils';
import { remove, save, useCal, type FastLog, type FastStatus, type FastType } from './model';
import { FAST_TYPES, STATUS } from './fasts';

/** Log a fast, or change how one went. */
export function FastSheet({ fast, onClose }: { fast: FastLog | null; onClose: () => void }) {
  const [f, setF] = useState<FastLog | null>(fast);
  if (fast && (!f || f.id !== fast.id)) setF(fast);
  if (!fast || !f) return null;
  const set = (p: Partial<FastLog>) => setF({ ...f, ...p });
  const exists = !!useCal.getState().fasts[f.id];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={exists ? 'Your fast' : 'Track a fast'}>
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); save(f); onClose(); }}>
        <div><Label htmlFor="f-name">Fast</Label><Input id="f-name" value={f.name} maxLength={120} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Monday fast, Navratri day 3" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="f-day">Day</Label><Input id="f-day" type="date" value={f.day} required onChange={(e) => e.target.value && set({ day: e.target.value })} /></div>
          <div><Label htmlFor="f-broke">Broke it at</Label><Input id="f-broke" type="time" value={f.brokeAt || ''} onChange={(e) => set({ brokeAt: e.target.value || undefined })} /></div>
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">How did it go?</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="How did it go?">
            {(Object.keys(STATUS) as FastStatus[]).map((s) => (
              <button key={s} type="button" role="radio" aria-checked={f.status === s} onClick={() => set({ status: s })}
                className={cn('rounded-full border px-3 py-1.5 text-sm font-medium', f.status === s ? 'border-accent bg-accent/12 text-accent-ink' : 'border-line hover:bg-hover')}>
                {STATUS[s].emoji} {STATUS[s].label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Kind of fast</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Kind of fast">
            {(Object.keys(FAST_TYPES) as FastType[]).map((t) => (
              <button key={t} type="button" role="radio" aria-checked={f.fastType === t} onClick={() => set({ fastType: t })}
                className={cn('rounded-full border px-3 py-1.5 text-sm', f.fastType === t ? 'border-amber-500 bg-amber-500/12 font-medium' : 'border-line hover:bg-hover')}>
                {FAST_TYPES[t]}
              </button>
            ))}
          </div>
        </fieldset>
        <div><Label htmlFor="f-notes">Notes</Label><Textarea id="f-notes" rows={3} value={f.notes} maxLength={4000} onChange={(e) => set({ notes: e.target.value })} placeholder="What you ate, how you felt…" /></div>
        <div className="flex items-center gap-2">
          {exists && (
            <Button variant="ghost" className="text-danger" onClick={async () => {
              if (await sdk().confirm({ title: 'Remove this fast from your log?', confirmText: 'Remove', destructive: true })) { remove(f); onClose(); }
            }}>Remove</Button>
          )}
          <Button type="submit" className="ml-auto">Save</Button>
        </div>
      </form>
    </Dialog>
  );
}
