// Tick friends from a searchable list (for new groups and adding members).
import { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import { ChatRowSkeleton } from '../../components/Skeleton';
import { displayName } from '../../lib/types';
import { cn } from '@sanga/ui/utils';
import { useApp } from '../../state/app';

export function FriendPicker({ picked, onChange, max, exclude = [] }: {
  picked: string[]; onChange: (p: string[]) => void; max: number; exclude?: string[];
}) {
  const friends = useApp((s) => s.friends);
  const loaded = useApp((s) => s.friendsLoaded);
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return Object.values(friends)
      .filter((f) => !exclude.includes(f.u) && (!s || f.u.includes(s) || (f.name || '').toLowerCase().includes(s)))
      .sort((a, b) => displayName(a, a.u).localeCompare(displayName(b, b.u)));
  }, [friends, q, exclude]);
  const toggle = (u: string) => onChange(picked.includes(u) ? picked.filter((x) => x !== u) : picked.length >= max ? picked : [...picked, u]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {picked.length > 0 && (
        <div className="flex gap-3 overflow-x-auto px-4 pt-1 pb-3">
          {picked.map((u) => (
            <button key={u} type="button" onClick={() => toggle(u)} className="flex w-14 shrink-0 flex-col items-center gap-1 text-xs" aria-label={`Remove ${u}`}>
              <Avatar u={u} name={friends[u]?.name} size={44} />
              <span className="w-full truncate">{displayName(friends[u], u)}</span>
            </button>
          ))}
        </div>
      )}
      <label className="mx-4 mb-2 flex h-10 shrink-0 items-center gap-2 rounded-xl bg-panel-2 px-3">
        <Search className="size-4 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search friends" aria-label="Search friends"
          autoCapitalize="none" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
      </label>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {!loaded && !list.length && Array.from({ length: 4 }, (_, i) => <ChatRowSkeleton key={i} i={i} />)}
        {loaded && !list.length && <li className="px-6 py-8 text-center text-sm text-muted">{q ? 'No friends match.' : 'No friends to add.'}</li>}
        {list.map((f) => {
          const on = picked.includes(f.u);
          return (
            <li key={f.u}>
              <button type="button" onClick={() => toggle(f.u)} aria-pressed={on} disabled={!on && picked.length >= max}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-hover disabled:opacity-50">
                <Avatar u={f.u} name={f.name} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{displayName(f, f.u)}</span>
                  <span className="block truncate text-sm text-muted">@{f.u}</span>
                </span>
                <span className={cn('grid size-6 place-items-center rounded-full border-2', on ? 'border-accent bg-accent text-white' : 'border-muted')}>
                  {on && <Check className="size-3.5" strokeWidth={3} />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
