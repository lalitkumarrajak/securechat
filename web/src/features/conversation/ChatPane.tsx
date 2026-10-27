import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Archive, ArchiveRestore, ArrowLeft, Bell, BellOff, ChevronDown, ChevronUp, Copy, Forward, Gamepad2, Info, Lock, LogOut,
  MoreVertical, NotebookPen, Pencil, Pin, Reply, Search, ShieldAlert, ShieldCheck, SquareCheck, Trash2, UserMinus, UserX, X,
} from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import { openNotes } from '../notes/NotesPanel';
import { Button, IconButton } from '../../components/ui/button';
import { confirm } from '../../components/ui/confirm';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuSub, MenuSubContent, MenuSubTrigger, MenuTrigger } from '../../components/ui/menu';
import {
  acceptRequest, blockUser, findMessage, messageTexts, closeChat, copyMessages, deleteChatHere, isMuted, mute, preview, removeFriend, sendRequest, setArchived, togglePin, unblockUser,
} from '../../lib/engine';
import { fmtLastSeen } from '../../lib/format';
import { displayName } from '../../lib/types';
import { getApp, setApp, useApp } from '../../state/app';
import { useSettings } from '../../state/settings';
import { Composer } from './Composer';
import { MessageList } from './MessageList';
import { ChatDialogs } from './ChatDialogs';
import { deleteFlow, setChatUi, startEdit, startReply } from './chatUi';
import { openPicker } from '../games/store';
import { useGames } from '../games/store';
import { groupIdOf, isGroup } from '../../lib/types';
import { leaveGroup } from '../../lib/groups';
import { canEdit } from '../../lib/controls';
import type { Msg } from '../../lib/types';
import { PeekButton } from '../sidebar/Sidebar';

export function EmptyPane() {
  const wallpaper = useSettings((s) => s.wallpaper);
  return (
    <div className={`wallpaper wp-${wallpaper} grid h-full place-items-center p-8`}>
      <div className="max-w-sm text-center">
        <img src="/logo-mark.png" alt="" className="mx-auto size-20 rounded-3xl opacity-90" />
        <h2 className="mt-5 text-2xl font-semibold">Chattrix</h2>
        <p className="mt-2 text-sm text-muted">Pick a chat on the left, or add a friend to start a new one.</p>
        <p className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted"><Lock className="size-3.5" /> Your messages are end-to-end encrypted</p>
      </div>
    </div>
  );
}

// Esc closes the top-most thing first (menus and dialogs claim it themselves), then selection,
// search, a reply or edit being written, and finally the chat itself, like WhatsApp.
function useEscapeToClose() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || e.repeat) return;
      if (useGames.getState().open || useGames.getState().picker) return; // a game screen is on top
      const s = getApp();
      if (s.panel) return;
      if (s.selection) setApp({ selection: null });
      else if (s.searchOpen) setApp({ searchOpen: false, searchQuery: '' });
      else if (s.replyTo || s.editing) setApp({ replyTo: null, editing: null });
      else closeChat();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export function ChatPane({ peer }: { peer: string }) {
  useEscapeToClose();
  const friend = useApp((s) => s.friends[peer]);
  const selection = useApp((s) => s.selection);
  const searchOpen = useApp((s) => s.searchOpen);
  const keyChanged = useApp((s) => s.keyChanged[peer]);
  const blocked = useApp((s) => s.blocked.includes(peer));
  const requestOut = useApp((s) => s.outgoing.some((r) => r.u === peer));
  const requestIn = useApp((s) => s.incoming.some((r) => r.u === peer));
  // The unread count when the chat was opened places the "N unread" divider.
  const [unreadAtOpen] = useState(() => useApp.getState().chats.find((c) => c.peer === peer)?.unread || 0);
  const group = useApp((s) => (isGroup(peer) ? s.groups[groupIdOf(peer)] : undefined));
  const groupsLoaded = useApp((s) => s.groupsLoaded);
  const name = isGroup(peer) ? group?.name || 'Group' : displayName(friend, peer);
  const canSend = isGroup(peer) ? !!group && (!group.adminsOnly || group.admin) : !!friend && !blocked && !keyChanged;

  return (
    <div className="flex h-full min-h-0 flex-col bg-chat">
      {selection ? <SelectionBar /> : <Header peer={peer} name={name} />}
      {searchOpen && !selection && <SearchBar />}
      <PinnedBar peer={peer} />
      {keyChanged && !isGroup(peer) && (
        <Banner icon={<ShieldAlert className="size-5 text-danger" />} action={<Button size="sm" variant="outline" onClick={() => setChatUi({ verify: true })}>Review</Button>}>
          {name}’s security code changed. Sending is paused until you verify it.
        </Banner>
      )}
      <MessageList peer={peer} peerName={name} unreadAtOpen={unreadAtOpen} />
      {canSend ? <Composer key={peer} peer={peer} peerName={name} /> : (
        <div className="shrink-0 border-t border-line bg-panel px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-sm">
          {isGroup(peer) ? (
            group ? <span className="text-muted">Only admins can send messages.</span>
              : groupsLoaded ? <>You’re no longer in this group. <Action onClick={() => deleteChatHere(peer)}>Delete chat</Action></>
              : <span className="text-muted">Loading…</span>
          ) : blocked ? (
            <>You blocked {name}. <Action onClick={() => unblockUser(peer)}>Unblock</Action></>
          ) : keyChanged ? (
            <>Verify the new security code to keep chatting.</>
          ) : requestIn ? (
            <>{name} wants to be your friend. <Action onClick={() => acceptRequest(peer)}>Accept</Action></>
          ) : requestOut ? (
            <span className="text-muted">Friend request sent. You can chat once {name} accepts.</span>
          ) : (
            <>You’re not friends with {name}. <Action onClick={() => sendRequest(peer).then(() => toast.success('Friend request sent'))}>Send friend request</Action></>
          )}
        </div>
      )}
      <ChatDialogs peer={peer} name={name} />
    </div>
  );
}

function Action({ onClick, children }: { onClick: () => Promise<unknown>; children: React.ReactNode }) {
  return <button className="font-semibold text-accent-ink hover:underline" onClick={() => onClick().catch((e) => toast.error(e.message))}>{children}</button>;
}

function Banner({ icon, children, action }: { icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-line bg-warn px-4 py-2.5 text-sm">
      {icon}<span className="flex-1">{children}</span>{action}
    </div>
  );
}

function Header({ peer, name }: { peer: string; name: string }) {
  if (isGroup(peer)) return <GroupHeader peer={peer} name={name} />;
  return <PersonHeader peer={peer} name={name} />;
}

const MuteItems = ({ peer }: { peer: string }) => {
  useApp((s) => s.me?.mutes);
  const doMute = (until: number, label: string) => mute(peer, until).then(() => toast(label)).catch((e) => toast.error(e.message));
  return isMuted(peer) ? (
    <MenuItem icon={<Bell />} onSelect={() => doMute(0, 'Notifications on')}>Unmute</MenuItem>
  ) : (
    <MenuSub>
      <MenuSubTrigger icon={<BellOff />}>Mute notifications</MenuSubTrigger>
      <MenuSubContent>
        <MenuItem onSelect={() => doMute(Date.now() + 8 * 3600e3, 'Muted for 8 hours')}>8 hours</MenuItem>
        <MenuItem onSelect={() => doMute(Date.now() + 7 * 864e5, 'Muted for 1 week')}>1 week</MenuItem>
        <MenuItem onSelect={() => doMute(-1, 'Muted')}>Always</MenuItem>
      </MenuSubContent>
    </MenuSub>
  );
};

function GroupHeader({ peer, name }: { peer: string; name: string }) {
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

function PersonHeader({ peer, name }: { peer: string; name: string }) {
  const presence = useApp((s) => s.presence[peer]);
  const typing = useApp((s) => s.typing[peer]);
  const friend = useApp((s) => s.friends[peer]);
  const archived = useApp((s) => s.chats.find((c) => c.peer === peer)?.archived);
  const blocked = useApp((s) => s.blocked.includes(peer));
  useApp((s) => s.me?.mutes);
  const muted = isMuted(peer);

  const status = typing ? (typing === 'recording' ? 'recording audio…' : 'typing…')
    : !friend ? '' : presence?.on ? 'online' : presence?.ls ? fmtLastSeen(presence.ls) : friend?.about || '@' + peer;

  const doMute = (until: number, label: string) => mute(peer, until).then(() => toast(label)).catch((e) => toast.error(e.message));

  return (
    <header className="flex h-16 shrink-0 items-center gap-1 border-b border-line bg-panel px-2">
      <IconButton label="Back" className="md:hidden" onClick={closeChat}><ArrowLeft /></IconButton>
      <button onClick={() => setApp({ panel: 'contact' })} className="priv-scope flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1.5 py-1 text-left hover:bg-hover">
        <Avatar u={peer} name={name} size={40} className="priv" />
        <span className="priv min-w-0">
          <span className="flex items-center gap-1.5 truncate font-semibold">{name}{muted && <BellOff className="size-3.5 text-muted" />}</span>
          <span className={`block truncate text-xs ${typing || presence?.on ? 'text-accent-ink' : 'text-muted'}`}>{status}</span>
        </span>
      </button>
      <IconButton label="Play a game" onClick={() => openPicker([peer])}><Gamepad2 /></IconButton>
      <PeekButton />
      <IconButton label="Search in chat" className="hidden md:inline-flex" onClick={() => setApp({ searchOpen: true })}><Search /></IconButton>
      <Menu>
        <MenuTrigger asChild><IconButton label="Chat options"><MoreVertical /></IconButton></MenuTrigger>
        <MenuContent>
          <MenuItem icon={<Info />} onSelect={() => setApp({ panel: 'contact' })}>Contact info</MenuItem>
          <MenuItem icon={<Search />} onSelect={() => setApp({ searchOpen: true })}>Search</MenuItem>
          <MenuItem icon={<SquareCheck />} onSelect={() => setApp({ selection: [] })}>Select messages</MenuItem>
          <MenuItem icon={<Gamepad2 />} onSelect={() => openPicker([peer])}>Play a game</MenuItem>
          <MenuItem icon={<NotebookPen />} onSelect={() => openNotes(peer)}>Notes about this chat</MenuItem>
          {muted ? (
            <MenuItem icon={<Bell />} onSelect={() => doMute(0, 'Notifications on')}>Unmute</MenuItem>
          ) : (
            <MenuSub>
              <MenuSubTrigger icon={<BellOff />}>Mute notifications</MenuSubTrigger>
              <MenuSubContent>
                <MenuItem onSelect={() => doMute(Date.now() + 8 * 3600e3, 'Muted for 8 hours')}>8 hours</MenuItem>
                <MenuItem onSelect={() => doMute(Date.now() + 7 * 864e5, 'Muted for 1 week')}>1 week</MenuItem>
                <MenuItem onSelect={() => doMute(-1, 'Muted')}>Always</MenuItem>
              </MenuSubContent>
            </MenuSub>
          )}
          <MenuItem icon={<ShieldCheck />} onSelect={() => setChatUi({ verify: true })}>Verify security code</MenuItem>
          <MenuItem icon={archived ? <ArchiveRestore /> : <Archive />} onSelect={() => setArchived(peer, !archived)}>{archived ? 'Unarchive' : 'Archive'}</MenuItem>
          <MenuSeparator />
          {friend && (
            <MenuItem icon={<UserMinus />} danger onSelect={async () => {
              if (await confirm({ title: `Remove ${name} from friends?`, description: 'You won’t be able to message each other until one of you sends a new friend request. Your chat history stays on this device.', confirmText: 'Remove', destructive: true })) {
                removeFriend(peer).then(() => toast(`${name} removed from friends`)).catch((e) => toast.error(e.message));
              }
            }}>Remove friend</MenuItem>
          )}
          <MenuItem icon={<UserX />} danger onSelect={async () => {
            if (blocked) return unblockUser(peer).then(() => toast(`${name} unblocked`));
            if (await confirm({ title: `Block ${name}?`, description: 'They won’t be able to message you, see your online status, or find you in search. They won’t be notified.', confirmText: 'Block', destructive: true })) {
              blockUser(peer).then(() => toast(`${name} blocked`)).catch((e) => toast.error(e.message));
            }
          }}>{blocked ? 'Unblock' : 'Block'}</MenuItem>
        </MenuContent>
      </Menu>
    </header>
  );
}

function SelectionBar() {
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

function SearchBar() {
  const messages = useApp((s) => s.messages);
  const peer = useApp((s) => s.active);
  const query = useApp((s) => s.searchQuery);
  const [index, setIndex] = useState(-1); // -1: haven't jumped yet
  // The whole chat on this device, not just what's loaded on screen; the loaded ones are the freshest copies.
  const [stored, setStored] = useState<Pick<Msg, 'k' | 'ts' | 'text' | 'type'>[]>([]);
  useEffect(() => { if (peer) messageTexts(peer).then(setStored); }, [peer]);
  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const byK = new Map<string, Pick<Msg, 'k' | 'ts' | 'text' | 'type'>>(stored.map((m) => [m.k, m]));
    for (const m of messages) byK.set(m.k, m);
    return [...byK.values()].filter((m) => m.type !== 'deleted' && m.text?.toLowerCase().includes(q)).sort((a, b) => b.ts - a.ts); // newest first
  }, [messages, stored, query]);

  const go = (i: number) => {
    if (!hits.length) return;
    const n = (i + hits.length) % hits.length;
    setIndex(n);
    setApp({ highlight: hits[n].k });
  };
  // Typing jumps to the newest match after a moment; Enter and the arrows go through the rest.
  useEffect(() => {
    if (index !== -1 || !hits.length) return;
    const t = setTimeout(() => go(0), 400);
    return () => clearTimeout(t);
  }, [query, hits.length]);

  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-line bg-panel px-2 py-1.5">
      <Search className="ml-2 size-4 text-muted" />
      <input autoFocus value={query} placeholder="Search messages"
        onChange={(e) => { setApp({ searchQuery: e.target.value }); setIndex(-1); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') go(e.shiftKey ? index - 1 : index + 1); // Enter: next older match
          if (e.key === 'Escape') { e.preventDefault(); setApp({ searchOpen: false, searchQuery: '' }); }
        }}
        className="h-9 min-w-0 flex-1 bg-transparent px-2 text-sm outline-none" />
      <span className="text-xs text-muted tabular-nums">{query ? (hits.length ? `${Math.max(index, 0) + 1}/${hits.length}` : '0 results') : ''}</span>
      <IconButton label="Newer match" size="icon-sm" disabled={!hits.length} onClick={() => go(index - 1)}><ChevronDown /></IconButton>
      <IconButton label="Older match" size="icon-sm" disabled={!hits.length} onClick={() => go(index + 1)}><ChevronUp /></IconButton>
      <IconButton label="Close search" size="icon-sm" onClick={() => setApp({ searchOpen: false, searchQuery: '' })}><X /></IconButton>
    </div>
  );
}

function PinnedBar({ peer }: { peer: string }) {
  const pins = useApp((s) => s.chats.find((c) => c.peer === peer)?.pins);
  const messages = useApp((s) => s.messages);
  const [i, setI] = useState(0);
  // Pinned messages further up than what's loaded come from this device's storage.
  const [far, setFar] = useState<Record<string, Msg>>({});
  useEffect(() => {
    for (const p of pins || []) if (!messages.some((m) => m.k === p.k) && !far[p.k]) findMessage(p.k).then((m) => m?.peer === peer && setFar((f) => ({ ...f, [m.k]: m }))); // only this chat's messages
  }, [pins, messages]);
  const list = useMemo(() => (pins || []).map((p) => messages.find((m) => m.k === p.k) || far[p.k]).filter((m) => !!m && m.type !== 'deleted'), [pins, messages, far]);
  if (!list.length) return null;
  const cur = list[i % list.length]!;
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-line bg-panel px-3 py-1.5">
      <div className="flex flex-col gap-0.5 self-stretch py-1" aria-hidden>
        {list.map((_, j) => <span key={j} className={`w-0.5 flex-1 rounded-full ${j === i % list.length ? 'bg-accent' : 'bg-line'}`} />)}
      </div>
      <button className="priv-scope min-w-0 flex-1 text-left" onClick={() => { setApp({ highlight: cur.k }); setI((n) => n + 1); }}>
        <span className="flex items-center gap-1 text-xs font-semibold text-accent-ink"><Pin className="size-3" /> Pinned message{list.length > 1 ? ` ${(i % list.length) + 1} of ${list.length}` : ''}</span>
        <span className="priv block truncate text-sm text-muted">{preview(cur)}</span>
      </button>
      <IconButton label="Unpin" size="icon-sm" onClick={() => togglePin(cur)}><X /></IconButton>
    </div>
  );
}
