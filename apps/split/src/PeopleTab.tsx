import { t } from '@sanga/i18n';
import { useState } from 'react';
import { Archive, ArchiveRestore, Pencil, UserMinus, UserPlus } from 'lucide-react';
import { sdk } from '@sanga/sdk';
import { Button } from '@sanga/ui/button';
import { balances } from './model';
import { useLedger, useMe, useNames } from './hooks';
import { archivePerson, removeFriend, save, type GroupData } from './store';
import { AddPeopleDialog } from './AddPeopleDialog';
import { GuestDialog } from './GuestDialog';
import type { Person } from './model';
import { PersonDot } from './PersonDot';

/** Who is in the group; the creator can add and remove people. */
export function PeopleTab({ g }: { g: GroupData }) {
  const me = useMe();
  const name = useNames();
  const { meta, expenses, settles, people } = useLedger(g);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Person | null>(null);
  const owner = g.members.find((m) => m.owner)?.u;
  const net = balances(expenses, settles);
  const involved = (id: string) => expenses.some((e) => e.paidBy === id || e.owed[id] !== undefined) || settles.some((s) => s.from === id || s.to === id);

  const remove = async (id: string, u?: string) => {
    if (!meta) return;
    if (!(await sdk().confirm({ title: t('Remove {name}?', { name: name({ id, name: people.find((p) => p.id === id)?.name ?? id, u }) }), description: u ? t('They lose access to the group. What they owe or are owed stays on the books.') : t('Their name goes from the group.'), confirmText: t('Remove'), destructive: true }))) return;
    setError('');
    try {
      if (u) await removeFriend(g.gid, u);
      else save(g.gid, { ...meta, people: meta.people.filter((p) => p.id !== id) });
    } catch (e) { setError(e instanceof Error ? e.message : t('Couldn’t remove them')); }
  };

  return (
    <div className="space-y-3 px-4 pb-6">
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
        {people.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-4 py-3">
            <PersonDot p={p} name={name(p)} size={40} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{name(p)}</span>
              <span className="block text-xs text-muted">{p.gone ? (p.u ? t('Left the group') : t('Archived')) : p.u ? (p.u === owner ? t('Made the group') : t('On Sanga')) : t('Not on Sanga')}</span>
            </span>
            {me === owner && !p.u && (<>
              <button type="button" aria-label={t('Edit {name}', { name: name(p) })} onClick={() => setEditing(p)} className="rounded-full p-2 text-muted hover:bg-hover"><Pencil className="size-4" /></button>
              <button type="button" aria-label={p.gone ? t('Restore {name}', { name: name(p) }) : t('Archive {name}', { name: name(p) })} onClick={() => archivePerson(g.gid, p.id, !p.gone)} className="rounded-full p-2 text-muted hover:bg-hover">
                {p.gone ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
              </button>
            </>)}
            {me === owner && p.id !== me && !p.gone && (p.u || !involved(p.id) || net[p.id] === 0) && (
              <button type="button" aria-label={t('Remove {name}', { name: name(p) })} onClick={() => void remove(p.id, p.u)} className="rounded-full p-2 text-muted hover:bg-hover hover:text-danger"><UserMinus className="size-4" /></button>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      <Button variant="outline" className="w-full" onClick={() => setAdding(true)}><UserPlus className="size-4" />{t('Add people')}</Button>
      <AddPeopleDialog g={g} open={adding} onClose={() => setAdding(false)} />
      <GuestDialog g={g} p={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
