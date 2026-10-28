// Fasts: what's coming (one tap to plan one), this year's record for each kind you follow (kept,
// partly, broken), your Ekadashi streak, and the log of every fast with how it went.
import { useMemo, useState } from 'react';
import { Flame } from 'lucide-react';
import { Button } from '@sanga/ui/button';
import { Dialog } from '@sanga/ui/dialog';
import { Input, Label, Textarea } from '@sanga/ui/input';
import { sdk } from '@sanga/sdk';
import { cn } from '@sanga/ui/utils';
import { addDays, GROUPS, observances, type Group, type Observance } from './panchang';
import { newFast, remove, save, today, useCal, type FastLog, type FastStatus, type FastType } from './model';
import { inWords, daysUntil, shortDay, useObservances } from './util';

export const STATUS: Record<FastStatus, { label: string; emoji: string; tone: string }> = {
  planned: { label: 'Planned', emoji: '🗓️', tone: 'bg-sky-500/12 text-sky-700 dark:text-sky-300' },
  kept: { label: 'Kept', emoji: '✅', tone: 'bg-green-500/12 text-green-700 dark:text-green-300' },
  partial: { label: 'Partly kept', emoji: '🌓', tone: 'bg-amber-500/12 text-amber-800 dark:text-amber-300' },
  broken: { label: 'Broken', emoji: '❌', tone: 'bg-rose-500/12 text-rose-700 dark:text-rose-300' },
};
export const FAST_TYPES: Record<FastType, string> = {
  nirjala: 'Nirjala (no water)', phalahar: 'Phalahar (fruit, milk)', 'one-meal': 'One meal', water: 'Water only', custom: 'My own way',
};

export function FastTracker({ onOpen }: { onOpen: (f: FastLog) => void }) {
  const fasts = useCal((s) => s.fasts);
  const place = useCal((s) => s.settings.place);
  const show = useCal((s) => s.settings.show);
  const now = today();
  const year = Number(now.slice(0, 4));
  const coming = useObservances(now, addDays(now, 30));
  const logs = useMemo(() => Object.values(fasts).filter((f) => !f.deleted).sort((a, b) => b.day.localeCompare(a.day)), [fasts]);
  const byRef = useMemo(() => new Map(logs.filter((f) => f.ref).map((f) => [f.ref!, f])), [logs]);

  // This year so far, per kind of fast you follow.
  const stats = useMemo(() => {
    const past = observances(year, place).filter((o) => o.fast && o.day <= now && show.includes(o.group));
    const groups = [...new Set(past.map((o) => o.group))];
    return groups.map((g) => {
      const list = past.filter((o) => o.group === g);
      const kept = list.filter((o) => byRef.get(o.id)?.status === 'kept').length;
      const partial = list.filter((o) => byRef.get(o.id)?.status === 'partial').length;
      return { g, total: list.length, kept, partial };
    }).filter((x) => x.total > 0);
  }, [year, place, now, show, byRef]);

  // Ekadashis kept in a row, latest first.
  const streak = useMemo(() => {
    const ek = [...observances(year - 1, place), ...observances(year, place)].filter((o) => o.group === 'ekadashi' && o.day <= now).reverse();
    let n = 0;
    for (const o of ek) { if (byRef.get(o.id)?.status === 'kept') n++; else if (o.day !== now) break; }
    return n;
  }, [year, place, now, byRef]);

  const upcoming = [...coming.values()].flat().filter((o) => o.fast);

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="col-span-2 flex items-center gap-4 rounded-3xl p-4 text-white shadow-md sm:col-span-1" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706 60%, #b45309)' }}>
          <Flame className="size-9 shrink-0" />
          <div><p className="text-3xl font-bold tabular-nums">{streak}</p><p className="text-sm text-white/85">Ekadashi{streak === 1 ? '' : 's'} kept in a row</p></div>
        </div>
        {stats.slice(0, 5).map((s) => (
          <div key={s.g} className="rounded-3xl border border-line/70 bg-panel p-4 shadow-sm">
            <p className="text-sm text-muted">{GROUPS.find((x) => x.id === s.g)?.label ?? s.g} · {year}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{s.kept}<span className="text-base font-medium text-muted"> of {s.total}</span></p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel-2" aria-hidden>
              <div className="h-full rounded-full bg-green-500" style={{ width: `${(s.kept / s.total) * 100}%` }} />
            </div>
            {s.partial > 0 && <p className="mt-1 text-xs text-muted">and {s.partial} partly</p>}
          </div>
        ))}
      </section>

      <section>
        <h3 className="mb-2 px-1 font-semibold">Coming up</h3>
        {!upcoming.length ? <p className="px-1 text-sm text-muted">No fasts in the next 30 days among the kinds you follow (Settings).</p> : (
          <ul className="space-y-2">
            {upcoming.map((o) => {
              const log = byRef.get(o.id);
              return (
                <li key={o.id} className="flex items-center gap-3 rounded-2xl border border-line/70 bg-panel p-3 shadow-sm">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-500/12 text-xl" aria-hidden>{o.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{o.name}</span>
                    <span className="text-sm text-muted">{shortDay(o.day)} · {inWords(daysUntil(o.day, now))}</span>
                  </span>
                  {log ? <button onClick={() => onOpen(log)} className={cn('rounded-full px-3 py-1 text-sm font-medium', STATUS[log.status].tone)}>{STATUS[log.status].label}</button>
                    : <Button size="sm" variant="outline" onClick={() => save(newFast(o.day, o.name, o.id))}>Plan it</Button>}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center px-1">
          <h3 className="flex-1 font-semibold">Your fasts</h3>
          <Button size="sm" variant="ghost" onClick={() => onOpen(newFast(now, ''))}>+ Log a fast</Button>
        </div>
        {!logs.length ? <p className="px-1 text-sm text-muted">Fasts you track show here, with how each one went.</p> : (
          <ul className="space-y-2">
            {logs.map((f) => (
              <li key={f.id}>
                <button onClick={() => onOpen(f)} className="flex w-full items-center gap-3 rounded-2xl border border-line/70 bg-panel p-3 text-left shadow-sm hover:bg-hover">
                  <span className="text-xl" aria-hidden>{STATUS[f.status].emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{f.name || 'Fast'}</span>
                    <span className="block truncate text-sm text-muted">{shortDay(f.day)} · {FAST_TYPES[f.fastType]}{f.brokeAt ? ` · broke at ${f.brokeAt}` : ''}{f.notes ? ` · ${f.notes}` : ''}</span>
                  </span>
                  <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold', STATUS[f.status].tone)}>{STATUS[f.status].label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

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

export type { Group, Observance };
