import { useMemo } from 'react';
import { toast } from 'sonner';
import { Copy, Forward, Pencil, Pin, Reply, Trash2, X } from 'lucide-react';
import { IconButton } from '@sanga/ui/button';
import { copyMessages, togglePin } from '../../../lib/engine';
import { setApp, useApp } from '../../../state/app';
import { canEdit } from '../../../lib/controls';
import { deleteFlow, setChatUi, startEdit, startReply } from '../chatUi';

export function SelectionBar() {
  const selection = useApp((s) => s.selection)!;
  const messages = useApp((s) => s.messages);
  const picked = useMemo(() => messages.filter((m) => selection.includes(m.k)), [messages, selection]);
  const content = picked.filter((m) => m.type !== 'deleted' && m.type !== 'err');
  const allText = content.length > 0 && content.length === picked.length && picked.every((m) => m.text);
  const single = picked.length === 1 && content.length === 1 && picked[0].id != null ? picked[0] : null;
  const pinned = useApp((s) => single && s.chats.find((c) => c.peer === single.peer)?.pins?.some((p) => p.k === single.k));

  return (
    <header className="flex h-16 shrink-0 items-center gap-1 border-b border-line bg-panel px-2">
      <IconButton label="Cancel selection" onClick={() => setApp({ selection: null })}><X /></IconButton>
      <span className="flex-1 pl-1 font-semibold">{picked.length ? `${picked.length} selected` : 'Select messages'}</span>
      {single && <IconButton label="Reply" onClick={() => { setApp({ selection: null }); startReply(single); }}><Reply /></IconButton>}
      {single && canEdit(single) && <IconButton label="Edit" onClick={() => { setApp({ selection: null }); startEdit(single); }}><Pencil /></IconButton>}
      {allText && <IconButton label="Copy" onClick={() => copyMessages(picked).then(() => { toast.success('Copied'); setApp({ selection: null }); })}><Copy /></IconButton>}
      {single && <IconButton label={pinned ? 'Unpin' : 'Pin'} onClick={() => { togglePin(single); setApp({ selection: null }); }}><Pin /></IconButton>}
      {content.length > 0 && content.length === picked.length && (
        <IconButton label="Forward" onClick={() => setChatUi({ forward: picked })}><Forward /></IconButton>
      )}
      {picked.length > 0 && <IconButton label="Delete" onClick={() => deleteFlow(picked)}><Trash2 /></IconButton>}
    </header>
  );
}
