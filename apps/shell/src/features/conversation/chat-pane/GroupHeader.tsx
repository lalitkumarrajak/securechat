import { toast } from 'sonner';
import { Archive, ArchiveRestore, ArrowLeft, BellOff, FolderPlus, Gamepad2, Info, LogOut, MoreVertical, NotebookPen, Search, SquareCheck, Trash2 } from 'lucide-react';
import { Avatar } from '../../../components/Avatar';
import { openNotes } from '../../../lib/notes';
import { IconButton } from '@sanga/ui/button';
import { confirm } from '@sanga/ui/confirm';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@sanga/ui/menu';
import { closeChat, deleteChatHere, isMuted, setArchived } from '../../../lib/engine';
import { groupIdOf } from '../../../lib/types';
import { setApp, useApp } from '../../../state/app';
import { openPicker } from '../../games/store';
import { leaveGroup } from '../../../lib/groups';
import { PeekButton } from '../../sidebar/PeekButton';
import { addChatTab } from '../chatTabs';
import { MuteItems } from './MuteItems';

export function GroupHeader({ peer, name }: { peer: string; name: string }) {
  const group = useApp((s) => s.groups[groupIdOf(peer)]);
  const typing = useApp((s) => s.typing[peer]);
  const who = useApp((s) => s.typingWho[peer]);
  const friends = useApp((s) => s.friends);
  const me = useApp((s) => s.me!.u);
  const archived = useApp((s) => s.chats.find((c) => c.peer === peer)?.archived);
  useApp((s) => s.me?.mutes);
  const muted = isMuted(peer);
  const memberName = (u: string) => (u === me ? 'You' : friends[u]?.name || group?.members.find((m) => m.u === u)?.n || u);
  const status = typing && who ? `${memberName(who)} is ${typing === 'recording' ? 'recording audio' : 'typing'}…`
    : group ? group.members.map((m) => memberName(m.u)).sort((a, b) => Number(a === 'You') - Number(b === 'You')).join(', ') : '';
  const others = (group?.members || []).filter((m) => m.u !== me).map((m) => ({ u: m.u, name: memberName(m.u) }));
  const play = () => openPicker(others.map((m) => m.u), others);
  const leave = async () => {
    if (!group) return;
    if (await confirm({ title: `Leave “${group.name}”?`, description: 'You’ll stop getting its messages. Your chat history stays on this device.', confirmText: 'Leave group', destructive: true })) {
      leaveGroup(group.id).then(() => toast(`You left “${group.name}”`)).catch((e) => toast.error(e.message));
    }
  };

  return (
    <header className="flex h-16 shrink-0 items-center gap-1 border-b border-line bg-panel px-2">
      <IconButton label="Back" className="md:hidden" onClick={closeChat}><ArrowLeft /></IconButton>
      <button onClick={() => group && setApp({ panel: 'group' })} className="priv-scope flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1.5 py-1 text-left hover:bg-hover">
        <Avatar u={peer} name={name} size={40} className="priv" />
        <span className="priv min-w-0">
          <span className="flex items-center gap-1.5 truncate font-semibold">{name}{muted && <BellOff className="size-3.5 text-muted" />}</span>
          <span className={`block truncate text-xs ${typing ? 'text-accent-ink' : 'text-muted'}`}>{status || 'Tap for group info'}</span>
        </span>
      </button>
      {group && others.length > 0 && <IconButton label="Play a game" onClick={play}><Gamepad2 /></IconButton>}
      <PeekButton />
      <IconButton label="Search in chat" className="hidden md:inline-flex" onClick={() => setApp({ searchOpen: true })}><Search /></IconButton>
      <Menu>
        <MenuTrigger asChild><IconButton label="Chat options"><MoreVertical /></IconButton></MenuTrigger>
        <MenuContent>
          {group && <MenuItem icon={<Info />} onSelect={() => setApp({ panel: 'group' })}>Group info</MenuItem>}
          <MenuItem icon={<Search />} onSelect={() => setApp({ searchOpen: true })}>Search</MenuItem>
          <MenuItem icon={<SquareCheck />} onSelect={() => setApp({ selection: [] })}>Select messages</MenuItem>
          <MenuItem icon={<NotebookPen />} onSelect={() => openNotes(peer)}>Notes about this group</MenuItem>
          {group && <MenuItem icon={<FolderPlus />} onSelect={addChatTab}>Add a tab</MenuItem>}
          {group && others.length > 0 && <MenuItem icon={<Gamepad2 />} onSelect={play}>Play a game with the group</MenuItem>}
          <MuteItems peer={peer} />
          <MenuItem icon={archived ? <ArchiveRestore /> : <Archive />} onSelect={() => setArchived(peer, !archived)}>{archived ? 'Unarchive' : 'Archive'}</MenuItem>
          <MenuSeparator />
          {group ? <MenuItem icon={<LogOut />} danger onSelect={leave}>Leave group</MenuItem>
            : <MenuItem icon={<Trash2 />} danger onSelect={() => deleteChatHere(peer)}>Delete chat</MenuItem>}
        </MenuContent>
      </Menu>
    </header>
  );
}
