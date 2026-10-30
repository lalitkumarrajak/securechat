import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Check, Search } from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import { Button } from '@sanga/ui/button';
import { Dialog } from '@sanga/ui/dialog';
import { forward } from '../../lib/engine';
import { displayName } from '../../lib/types';
import { cn } from '@sanga/ui/utils';
import { setApp, useApp } from '../../state/app';
import { ChatRowSkeleton } from '../../components/skeleton/ChatRowSkeleton';
import { setChatUi, useChatUi } from './chatUi';

export function ForwardDialog() {
  const msgs = useChatUi((s) => s.forward);
  const friends = useApp((s) => s.friends);
  const groups = useApp((s) => s.groups);
  const friendsLoaded = useApp((s) => s.friendsLoaded);
  const [picked, setPicked] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (msgs) { setPicked([]); setQ(''); } }, [msgs]);
  // Friends and groups I can send to.
  const list = useMemo(() => [
    ...Object.values(friends).map((f) => ({ u: f.u, name: displayName(f, f.u) })),
    ...Object.values(groups).filter((g) => !g.adminsOnly || g.admin).map((g) => ({ u: 'g:' + g.id, name: g.name })),
  ].filter((f) => !q || f.u.includes(q.toLowerCase()) || f.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name)), [friends, groups, q]);

  const toggle = (u: string) => setPicked((p) => (p.includes(u) ? p.filter((x) => x !== u) : p.length >= 5 ? p : [...p, u]));
  const send = async () => {
    if (!msgs) return;
    setBusy(true);
    try {
      await forward(msgs, picked);
      toast.success(`Forwarded to ${picked.length} chat${picked.length > 1 ? 's' : ''}`);
      setChatUi({ forward: null });
      setApp({ selection: null });
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };

  return (
    <Dialog open={!!msgs} onOpenChange={(o) => !o && setChatUi({ forward: null })} title="Forward to…" description="Choose up to 5 chats.">
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search friends and groups"
          className="h-10 w-full rounded-xl bg-panel-2 pr-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-accent/30" />
      </div>
      <ul className="-mx-2 max-h-72 overflow-y-auto">
        {list.map((f) => {
          const on = picked.includes(f.u);
          return (
            <li key={f.u}>
              <button onClick={() => toggle(f.u)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-hover" aria-pressed={on}>
                <Avatar u={f.u} name={f.name} size={40} />
                <span className="min-w-0 flex-1 truncate font-medium">{f.name}</span>
                <span className={cn('grid size-6 place-items-center rounded-full border-2', on ? 'border-accent bg-accent text-white' : 'border-line')}>
                  {on && <Check className="size-4" strokeWidth={3} />}
                </span>
              </button>
            </li>
          );
        })}
        {!list.length && !friendsLoaded && <ChatRowSkeleton />}
        {!list.length && friendsLoaded && <li className="py-6 text-center text-sm text-muted">No friends to forward to.</li>}
      </ul>
      <Button className="mt-4 w-full" disabled={!picked.length} loading={busy} onClick={send}>
        Send{picked.length ? ` to ${picked.length}` : ''}
      </Button>
    </Dialog>
  );
}
