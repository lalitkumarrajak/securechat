import { useState } from 'react';
import { UserMinus, UserPlus } from 'lucide-react';
import { sdk } from '@sanga/sdk';
import { Button } from '@sanga/ui/button';
import { balances } from './model';
import { useLedger, useMe, useNames } from './hooks';
import { removeFriend, save, type GroupData } from './store';
import { AddPeopleDialog } from './AddPeopleDialog';
import { PersonDot } from './PersonDot';

/** Who is in the group; the creator can add and remove people. */
export function PeopleTab({ g }: { g: GroupData }) {
  const me = useMe();
  const name = useNames();
  const { meta, expenses, settles, people } = useLedger(g);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const owner = g.members.find((m) => m.owner)?.u;
  const net = balances(expenses, settles);
  const involved = (id: string) => expenses.some((e) => e.paidBy === id || e.owed[id] !== undefined) || settles.some((s) => s.from === id || s.to === id);

  const remove = async (id: string, u?: string) => {
    if (!meta) return;
    if (!(await sdk().confirm({ title: `Remove ${name({ id, name: people.find((p) => p.id === id)?.name ?? id, u })}?`, description: u ? 'They lose access to the group. What they owe or are owed stays on the books.' : 'Their name goes from the group.', confirmText: 'Remove', destructive: true }))) return;
    setError('');
    try {
      if (u) await removeFriend(g.gid, u);
      else save(g.gid, { ...meta, people: meta.people.filter((p) => p.id !== id) });
    } catch (e) { setError(e instanceof Error ? e.message : 'Couldn’t remove them'); }
  };

  return (
    <div className="space-y-3 px-4 pb-6">
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
        {people.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-4 py-3">
            <PersonDot p={p} name={name(p)} size={40} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{name(p)}</span>
              <span className="block text-xs text-muted">{p.gone ? 'Left the group' : p.u ? (p.u === owner ? 'Made the group' : 'On Sanga') : 'Not on Sanga'}</span>
            </span>
            {me === owner && !p.gone && p.id !== me && (p.u || !involved(p.id) || net[p.id] === 0) && (
              <button type="button" aria-label={`Remove ${name(p)}`} onClick={() => void remove(p.id, p.u)} className="rounded-full p-2 text-muted hover:bg-hover hover:text-danger"><UserMinus className="size-4" /></button>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      <Button variant="outline" className="w-full" onClick={() => setAdding(true)}><UserPlus className="size-4" />Add people</Button>
      <AddPeopleDialog g={g} open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}
