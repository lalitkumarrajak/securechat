import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { sdk } from '@sanga/sdk';
import { Button } from '@sanga/ui/button';
import { Dialog } from '@sanga/ui/dialog';
import { Input, Label } from '@sanga/ui/input';
import { useLedger } from './hooks';
import { addFriend, addPerson, type GroupData } from './store';
import { PersonDot } from './PersonDot';

/** Add people: Sanga friends (they get the group, encrypted for them) or just a name (someone not on Sanga). */
export function AddPeopleDialog({ g, open, onClose }: { g: GroupData; open: boolean; onClose: () => void }) {
  const chats = sdk().useChats();
  const online = sdk().useOnline();
  const { people } = useLedger(g);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const inGroup = new Set(g.members.map((m) => m.u));
  const friends = chats.filter((c) => !c.peer.startsWith('g:') && !inGroup.has(c.peer));

  const add = async (u: string, n: string) => {
    setBusy(u); setError('');
    try { await addFriend(g.gid, u, n); }
    catch (e) { setError(e instanceof Error ? e.message : 'Couldn’t add them'); }
    finally { setBusy(null); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }} title="Add people" description="Friends on Sanga see the group right away. Everything stays end-to-end encrypted.">
      <div className="space-y-5">
        <section>
          <h3 className="mb-2 text-sm font-semibold">Your friends</h3>
          {!online && <p className="mb-2 rounded-xl bg-warn-bg p-3 text-sm">You’re offline. Connect to add friends.</p>}
          {friends.length === 0 ? <p className="text-sm text-muted">{chats.some((c) => !c.peer.startsWith('g:')) ? 'All your friends are already in this group.' : 'Add friends in Sanga first, then add them here.'}</p> : (
            <ul className="max-h-56 divide-y divide-line overflow-y-auto rounded-xl border border-line">
              {friends.map((f) => (
                <li key={f.peer} className="flex items-center gap-3 px-3 py-2">
                  <PersonDot p={{ id: f.peer, name: f.name, u: f.peer }} name={f.name} size={32} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{f.name}</span>
                  <Button size="sm" variant="outline" loading={busy === f.peer} disabled={!online || busy !== null} onClick={() => void add(f.peer, f.name)}>Add</Button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h3 className="mb-2 text-sm font-semibold">Someone not on Sanga</h3>
          <form className="flex gap-2" onSubmit={(e) => {
            e.preventDefault();
            const n = name.trim();
            if (!n || people.some((p) => p.name.toLowerCase() === n.toLowerCase() && !p.u)) return;
            addPerson(g.gid, n); setName('');
          }}>
            <div className="flex-1"><Label htmlFor="pn">Name</Label><Input id="pn" maxLength={40} placeholder="e.g. Rohan" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <Button type="submit" variant="secondary" className="mt-[1.65rem]" disabled={!name.trim()}><UserPlus className="size-4" />Add</Button>
          </form>
          <p className="mt-1.5 text-xs text-muted">They can be in expenses and balances, but they can’t open the group themselves.</p>
        </section>
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      </div>
    </Dialog>
  );
}
