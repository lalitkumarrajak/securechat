// Pick the friends a note is shared with. Each gets a read-only copy in their diary, sealed so only
// they can read it; taking someone off removes their copy.
import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { t } from '@sanga/i18n';
import { Button } from '@sanga/ui/button';
import { Dialog } from '@sanga/ui/dialog';
import { cn } from '@sanga/ui/utils';
import { sdk } from '@sanga/sdk';
import { MAX_SHARES } from '../notes';
import { Avatar } from './Avatar';

export function ShareDialog({ shared, suggest, onDone, onClose }: { shared: string[]; suggest?: string; onDone: (people: string[]) => void; onClose: () => void }) {
  const chats = sdk().useChats();
  const [picked, setPicked] = useState(shared);
  // Friends only (not groups); the one the note is about first, then the ones already on it.
  const friends = useMemo(() => {
    const list = chats.filter((c) => !c.peer.startsWith('g:'));
    for (const u of shared) if (!list.some((c) => c.peer === u)) list.push({ peer: u, name: u });
    const rank = (p: string) => (p === suggest ? 0 : shared.includes(p) ? 1 : 2);
    return list.sort((a, b) => rank(a.peer) - rank(b.peer) || a.name.localeCompare(b.name));
  }, [chats, shared, suggest]);
  const toggle = (u: string) => setPicked((p) => (p.includes(u) ? p.filter((x) => x !== u) : p.length >= MAX_SHARES ? p : [...p, u]));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={t('Share this note')} description={t('They can read it in their diary, but not change it. Only the people you pick can read it.')}>
      {!friends.length ? <p className="py-4 text-center text-sm text-muted">{t('Add friends to share notes with them.')}</p> : (
        <ul className="-mx-2 max-h-[50vh] overflow-y-auto" role="group" aria-label={t('Friends')}>
          {friends.map((f) => {
            const on = picked.includes(f.peer);
            return (
              <li key={f.peer}>
                <button type="button" role="checkbox" aria-checked={on} onClick={() => toggle(f.peer)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-hover">
                  <Avatar u={f.peer} name={f.name} size={36} />
                  <span className="min-w-0 flex-1 truncate font-medium">{f.name}</span>
                  <span className={cn('grid size-6 place-items-center rounded-full border-2 transition', on ? 'border-accent bg-accent text-white' : 'border-line')}>{on && <Check className="size-4" />}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>{t('Cancel')}</Button>
        <Button onClick={() => { onDone(picked); onClose(); }}>{t('Done')}</Button>
      </div>
    </Dialog>
  );
}
