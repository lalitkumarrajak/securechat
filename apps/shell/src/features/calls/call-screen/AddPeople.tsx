import { useMemo, useState } from 'react';
import { Phone, Search, X } from 'lucide-react';
import { Avatar } from '../../../components/Avatar';
import { addToCall, MAX_PEOPLE, type Call } from '../../../lib/calls';
import { displayName } from '../../../lib/types';
import { useApp } from '../../../state/app';

/** Ring more friends into the call. Everyone on a call must be friends with everyone else on it:
 *  the server says so if one isn't. */
export function AddPeople({ call, onClose }: { call: Call; onClose: () => void }) {
  const friends = useApp((s) => s.friends);
  const [q, setQ] = useState('');
  const on = new Set(call.members.map((m) => m.u));
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return Object.values(friends)
      .filter((f) => !t || f.u.includes(t) || (f.name || '').toLowerCase().includes(t))
      .sort((a, b) => displayName(a, a.u).localeCompare(displayName(b, b.u)));
  }, [friends, q]);
  const left = MAX_PEOPLE - call.members.length - 1;
  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/50 md:items-center" onClick={onClose}>
      <div role="dialog" aria-label="Add people" onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80%] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-panel text-ink shadow-2xl md:rounded-3xl">
        <header className="flex items-center gap-2 px-4 pt-4 pb-2">
          <h3 className="flex-1 text-lg font-semibold">Add people</h3>
          <button onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full hover:bg-hover"><X className="size-5" /></button>
        </header>
        <p className="px-4 text-sm text-muted">Up to {MAX_PEOPLE} people on a call. {left > 0 ? `${left} more can join.` : 'The call is full.'}</p>
        <div className="relative mx-4 mt-3 mb-2">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search friends" aria-label="Search friends"
            className="h-10 w-full rounded-xl bg-panel-2 pr-3 pl-9 text-sm outline-none placeholder:text-muted focus:ring-2 focus:ring-accent/30" />
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto pb-4">
          {shown.map((f) => {
            const already = on.has(f.u);
            return (
              <li key={f.u}>
                <button disabled={already || left <= 0} onClick={() => { void addToCall(f.u); onClose(); }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-hover disabled:opacity-50 disabled:hover:bg-transparent">
                  <Avatar u={f.u} name={f.name} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{displayName(f, f.u)}</span>
                    <span className="block truncate text-sm text-muted">{already ? 'On the call' : '@' + f.u}</span>
                  </span>
                  {!already && <Phone className="size-5 text-accent-ink" />}
                </button>
              </li>
            );
          })}
          {!shown.length && <li className="px-4 py-6 text-center text-sm text-muted">No friends found.</li>}
        </ul>
      </div>
    </div>
  );
}
