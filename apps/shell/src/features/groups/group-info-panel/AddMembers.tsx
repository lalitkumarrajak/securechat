import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { Button, IconButton } from '@sanga/ui/button';
import { addMembers } from '../../../lib/groups';
import { type Group } from '../../../lib/types';
import { FriendPicker } from '../FriendPicker';
import { MAX_GROUP } from '../groupLimits';
import { fail } from './fail';

export function AddMembers({ g, onDone }: { g: Group; onDone: () => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const add = async () => {
    setBusy(true);
    try { await addMembers(g.id, picked); toast.success(`Added ${picked.length} to “${g.name}”`); onDone(); }
    catch (e) { fail(e); setBusy(false); }
  };
  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 bg-panel px-3">
        <IconButton label="Back" onClick={onDone}><ArrowLeft /></IconButton>
        <div><h2 className="text-lg font-semibold">Add members</h2>
          <p className="text-xs text-muted">{picked.length ? `${picked.length} selected` : 'Pick friends to add'}</p></div>
      </header>
      <FriendPicker picked={picked} onChange={setPicked} max={MAX_GROUP - g.members.length} exclude={g.members.map((m) => m.u)} />
      <div className="shrink-0 border-t border-line p-4">
        <Button className="w-full" loading={busy} disabled={!picked.length} onClick={add}>Add {picked.length || ''} to group</Button>
        <p className="mt-2 text-center text-xs text-muted">New members see messages sent from now on, not the chat history.</p>
      </div>
    </>
  );
}
