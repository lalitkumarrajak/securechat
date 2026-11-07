import { t, tn, tx } from '@sanga/i18n';
import { Plus } from 'lucide-react';
import { Button } from '@sanga/ui/button';
import { Dialog } from '@sanga/ui/dialog';
import { kindOf, money } from './model';
import { useSplit } from './store';
import { dayLabel, type Draft } from './draft';

/** A bill sent from the Calendar: pick the group to record it in (one in the same currency). It's yours alone until you change the split. */
export function DraftDialog({ draft, onPick, onNew, onClose }: { draft: Draft | null; onPick: (gid: string) => void; onNew: () => void; onClose: () => void }) {
  const groups = useSplit((s) => s.groups);
  const loaded = useSplit((s) => s.loaded);
  // Groups whose details haven't arrived yet (just added to one) have no currency to match, and are left out.
  const all = draft ? Object.values(groups).filter((g) => g.meta && g.meta.currency === draft.cur) : [];
  // A card bill goes in a Credit card bills group (kept out of spending): those come first.
  const card = draft?.cat === 'cards';
  const same = card ? [...all].sort((a, b) => Number(kindOf(b.meta) === 'cards') - Number(kindOf(a.meta) === 'cards')) : all;
  const hasCardGroup = all.some((g) => kindOf(g.meta) === 'cards');
  const people = (g: (typeof same)[number]) => g.meta!.people.filter((p) => !p.gone).length;
  return (
    <Dialog open={!!draft} onOpenChange={(o) => { if (!o) onClose(); }} title={t('Add this bill to Split')}
      description={draft ? `${draft.desc} · ${money(draft.amount, draft.cur)} · ${dayLabel(draft.date)}` : undefined}>
      <div className="space-y-3">
        <p className="text-sm text-muted">{card
          ? t('Card bill payments go in a Credit card bills group, so they aren’t counted as spending: what you bought with the card already is.')
          : tx('Pick where to record it. It starts as your own expense, so it counts in {link}; you can still change who shares it.', { link: <b>{t('My spending')}</b> })}</p>
        {!loaded ? null : same.length === 0 ? (
          <p className="rounded-xl bg-panel-2 p-3 text-sm">{t('You have no {cur} group yet. A group of just yourself works well for personal spending.', { cur: draft?.cur ?? '' })}</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
            {same.map((g) => (
              <li key={g.gid}>
                <button type="button" onClick={() => onPick(g.gid)} className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-hover">
                  <span className="text-2xl" aria-hidden>{g.meta!.emoji}</span><span className="min-w-0 flex-1 truncate font-medium">{g.meta!.name}</span>
                  <span className="text-xs text-muted">{card && kindOf(g.meta) === 'cards' ? t('Card bills') : tn(people(g), '{n} person', '{n} people')}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <Button variant={card && !hasCardGroup ? 'primary' : 'outline'} className="w-full" onClick={onNew}><Plus className="size-4" />{card && !hasCardGroup ? t('Make a Credit card bills group') : t('New group')}</Button>
      </div>
    </Dialog>
  );
}
