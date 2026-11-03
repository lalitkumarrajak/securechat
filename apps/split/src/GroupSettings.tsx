import { t } from '@sanga/i18n';
import { useState } from 'react';
import { Download, LogOut, Plus, X } from 'lucide-react';
import { sdk } from '@sanga/sdk';
import { Button } from '@sanga/ui/button';
import { Dialog } from '@sanga/ui/dialog';
import { Input, Label } from '@sanga/ui/input';
import { balances, CAT_COLORS, CURRENCIES, type Category } from './model';
import { useLedger, useMe, useNames } from './hooks';
import { leaveGroup, newId, save, type GroupData } from './store';
import { download, expensesCsv } from './exportCsv';
import { GROUP_EMOJIS } from './emojis';

/** Rename the group, add your own categories, export the expenses, or leave. */
export function GroupSettings({ g, open, onClose, onLeft }: { g: GroupData; open: boolean; onClose: () => void; onLeft: () => void }) {
  const me = useMe();
  const name = useNames();
  const { meta, expenses, settles, person } = useLedger(g);
  const [catName, setCatName] = useState('');
  const [catEmoji, setCatEmoji] = useState('🏷️');
  const [catColor, setCatColor] = useState(CAT_COLORS[0]);
  const [error, setError] = useState('');
  if (!meta) return null;
  const set = (patch: Partial<typeof meta>) => save(g.gid, { ...meta, ...patch });

  const addCat = () => {
    const n = catName.trim();
    if (!n) return;
    const c: Category = { id: 'c' + newId(), name: n, emoji: catEmoji.trim().slice(0, 4) || '🏷️', color: catColor };
    set({ cats: [...meta.cats, c] });
    setCatName('');
  };

  const leave = async () => {
    const mine = balances(expenses, settles)[me] ?? 0;
    const description = mine !== 0 ? t('You won’t see this group any more. You still have an unsettled balance here; it stays on the books for the others.') : t('You won’t see this group any more.');
    if (!(await sdk().confirm({ title: t('Leave “{name}”?', { name: meta.name }), description, confirmText: t('Leave'), destructive: true }))) return;
    try { await leaveGroup(g.gid); onClose(); onLeft(); }
    catch (e) { setError(e instanceof Error ? e.message : t('Couldn’t leave right now')); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }} title={t('Group settings')} className="md:max-w-lg">
      <div className="space-y-5">
        <div>
          <Label htmlFor="gn">{t('Name')}</Label>
          <Input id="gn" key={meta.name} defaultValue={meta.name} maxLength={60} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== meta.name) set({ name: v }); }} />
        </div>
        <div>
          <Label>{t('Icon')}</Label>
          <div className="flex flex-wrap gap-1.5">
            {GROUP_EMOJIS.map((e) => (
              <button key={e} type="button" aria-pressed={meta.emoji === e} onClick={() => set({ emoji: e })}
                className={`grid size-10 place-items-center rounded-xl text-xl ${meta.emoji === e ? 'bg-accent/20 ring-2 ring-accent' : 'bg-panel-2 hover:bg-hover'}`}>{e}</button>
            ))}
          </div>
        </div>
        <div>
          <Label htmlFor="gc" hint={expenses.length ? t('fixed once there are expenses') : undefined}>{t('Currency')}</Label>
          <select id="gc" value={meta.currency} disabled={expenses.length > 0 || settles.length > 0} onChange={(e) => set({ currency: e.target.value })}
            className="h-11 w-full rounded-xl border border-line bg-panel-2 px-3 disabled:opacity-60">{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
        </div>

        <div>
          <Label hint={t('besides the ready-made ones')}>{t('Your own categories')}</Label>
          {meta.cats.length > 0 && (
            <ul className="mb-2 flex flex-wrap gap-1.5">
              {meta.cats.map((c) => (
                <li key={c.id} className="inline-flex items-center gap-1.5 rounded-full py-1 pr-1 pl-3 text-sm" style={{ background: c.color + '26' }}>
                  <span aria-hidden>{c.emoji}</span>{c.name}
                  <button type="button" aria-label={t('Remove {name}', { name: c.name })} onClick={() => set({ cats: meta.cats.filter((x) => x.id !== c.id) })} className="rounded-full p-1 hover:bg-hover"><X className="size-3.5" /></button>
                </li>
              ))}
            </ul>
          )}
          <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); addCat(); }}>
            <div className="flex gap-2">
              <Input aria-label={t('Category emoji')} value={catEmoji} onChange={(e) => setCatEmoji(e.target.value)} maxLength={4} className="w-16 text-center text-xl" />
              <Input aria-label={t('Category name')} placeholder={t('e.g. Cricket, Tuition, Pooja')} value={catName} onChange={(e) => setCatName(e.target.value)} maxLength={30} />
              <Button type="submit" variant="secondary" disabled={!catName.trim()} aria-label={t('Add category')}><Plus className="size-4" /></Button>
            </div>
            <div className="flex gap-1.5" role="radiogroup" aria-label={t('Category colour')}>
              {CAT_COLORS.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={catColor === c} aria-label={c} onClick={() => setCatColor(c)}
                  className={`size-7 rounded-full ${catColor === c ? 'ring-2 ring-ink ring-offset-2 ring-offset-panel' : ''}`} style={{ background: c }} />
              ))}
            </div>
          </form>
        </div>

        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <Button variant="outline" disabled={!expenses.length} onClick={() => download(`${meta.name.replace(/[^\w\- ]+/g, '').trim() || 'split'}.csv`, expensesCsv(meta, expenses, (id) => name(person(id))))}>
            <Download className="size-4" />{t('Export expenses (CSV)')}
          </Button>
          <Button variant="outline" className="text-danger" onClick={() => void leave()}><LogOut className="size-4" />{t('Leave group')}</Button>
          {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        </div>
      </div>
    </Dialog>
  );
}
