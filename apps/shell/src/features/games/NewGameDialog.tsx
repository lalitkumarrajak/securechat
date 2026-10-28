// Start a game: pick the game, then tick friends to invite, or invite nobody and share a link.
import { useMemo, useState } from 'react';
import { Check, Link2, Search } from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import { Button } from '@sanga/ui/button';
import { Dialog } from '@sanga/ui/dialog';
import { displayName } from '../../lib/types';
import { cn } from '@sanga/ui/utils';
import { useApp } from '../../state/app';
import { GAME_UI } from './registry';
import { ChatRowSkeleton } from '../../components/Skeleton';
import { closePicker, createGame, useGames } from './store';

export function NewGameDialog() {
  const picker = useGames((s) => s.picker);
  return picker ? <PickerDialog initial={picker.pre} pool={picker.pool} start={picker.type} /> : null;
}

function PickerDialog({ initial, pool, start }: { initial: string[]; pool?: { u: string; name?: string }[]; start?: string }) {
  const friends = useApp((s) => s.friends);
  const loaded = useApp((s) => s.friendsLoaded);
  const games = Object.values(GAME_UI);
  const [type, setType] = useState(start && GAME_UI[start] ? start : games[0].type);
  const [picked, setPicked] = useState<string[]>(() => initial.slice(0, GAME_UI[type].max - 1));
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const ui = GAME_UI[type];
  const max = ui.max - 1;

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (pool || Object.values(friends))
      .filter((f) => !s || f.u.includes(s) || (f.name || '').toLowerCase().includes(s))
      .sort((a, b) => displayName(a, a.u).localeCompare(displayName(b, b.u)));
  }, [friends, pool, q]);

  const toggle = (u: string) => setPicked((p) => (p.includes(u) ? p.filter((x) => x !== u) : p.length >= max ? p : [...p, u]));
  const go = () => { setBusy(true); createGame(type, picked); setTimeout(() => setBusy(false), 4000); };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) closePicker(); }} title="Play a game" description="Invite friends, or share a link with anyone.">
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {games.map((x) => (
          <button key={x.type} type="button" onClick={() => { setType(x.type); setPicked((p) => (p.length ? p : initial).slice(0, x.max - 1)); }} aria-pressed={x.type === type}
            className={cn('flex min-w-36 items-center gap-3 rounded-2xl border-2 p-3 text-left', x.type === type ? 'border-accent bg-accent/10' : 'border-line')}>
            <span className="text-3xl" aria-hidden>{x.emoji}</span>
            <span><span className="block font-semibold">{x.name}</span><span className="block text-xs text-muted">{x.blurb}</span></span>
          </button>
        ))}
      </div>

      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium">Invite friends</span>
        <span className="text-muted">{picked.length}/{max}</span>
      </div>
      <label className="mb-2 flex h-10 items-center gap-2 rounded-full bg-hover px-3">
        <Search className="size-4 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search friends" aria-label="Search friends"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
      </label>
      <ul className="max-h-[34dvh] overflow-y-auto">
        {list.length === 0 && !loaded && !q && Array.from({ length: 3 }, (_, i) => <ChatRowSkeleton key={i} i={i} />)}
        {list.length === 0 && (loaded || q) && <li className="py-6 text-center text-sm text-muted">{q ? 'No friends match.' : 'No friends yet. You can still share a link.'}</li>}
        {list.map((f) => {
          const on = picked.includes(f.u);
          return (
            <li key={f.u}>
              <button type="button" onClick={() => toggle(f.u)} aria-pressed={on} disabled={!on && picked.length >= max}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-hover disabled:opacity-50">
                <Avatar u={f.u} name={f.name} size={40} />
                <span className="min-w-0 flex-1 truncate">{displayName(f, f.u)}</span>
                <span className={cn('grid size-6 place-items-center rounded-full border-2', on ? 'border-accent bg-accent text-white' : 'border-muted')}>
                  {on && <Check className="size-3.5" strokeWidth={3} />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <Button className="mt-4 w-full gap-2" loading={busy} onClick={go}>
        {picked.length ? `Invite ${picked.length} friend${picked.length > 1 ? 's' : ''}` : <><Link2 className="size-4" /> Create game and share link</>}
      </Button>
      <p className="mt-2 text-center text-xs text-muted">You can also share a link from the waiting room, so people who aren’t your friends can join.</p>
    </Dialog>
  );
}
