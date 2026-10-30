import { Pencil, Reply, X } from 'lucide-react';
import { IconButton } from '@sanga/ui/button';
import { senderOf } from '../../lib/controls';
import { me, preview } from '../../lib/engine';
import { groupIdOf, isGroup, type Msg } from '../../lib/types';
import { useApp } from '../../state/app';
import { useMemberName } from './useMemberName';

export function ContextBar({ m, editing, peerName, onClose }: { m: Msg; editing: boolean; peerName: string; onClose: () => void }) {
  const group = useApp((s) => (isGroup(m.peer) ? s.groups[groupIdOf(m.peer)] : undefined));
  const memberName = useMemberName();
  const who = senderOf(m) === me() ? 'You' : group ? memberName(senderOf(m), group) : peerName;
  return (
    <div className="flex items-center gap-2 px-3 pt-2">
      <div className="priv-scope min-w-0 flex-1 rounded-xl border-l-4 border-accent bg-panel-2 px-3 py-1.5">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-accent-ink">
          {editing ? <><Pencil className="size-3" /> Editing message</> : <><Reply className="size-3" /> Replying to {who}</>}
        </span>
        <span className="priv block truncate text-sm text-muted">{preview(m)}</span>
      </div>
      <IconButton label={editing ? 'Cancel edit' : 'Cancel reply'} size="icon-sm" onClick={onClose}><X /></IconButton>
    </div>
  );
}
