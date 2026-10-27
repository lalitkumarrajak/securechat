import { useEffect, useMemo, useState } from 'react';
import { Archive, ArrowLeft, BellOff, Clock, Eye, EyeOff, Gamepad2, Lock, LogOut, MessageSquarePlus, MoreVertical, NotebookPen, Search, Settings, UserPlus, Users, WifiOff, X } from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import { Ticks } from '../../components/Ticks';
import { IconButton } from '../../components/ui/button';
import { confirm } from '../../components/ui/confirm';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '../../components/ui/menu';
import { isMuted, logout, openChat } from '../../lib/engine';
import { fmtListTime } from '../../lib/format';
import { displayName, type Chat } from '../../lib/types';
import { cn } from '../../lib/utils';
import { setApp, useApp } from '../../state/app';
import { GamesStrip } from '../games/GamesStrip';
import { ChatListSkeleton } from '../../components/Skeleton';
import { useSettings } from '../../state/settings';
import { lockNow } from '../../lib/applock';
import { togglePeek, usePeek } from '../../lib/privacy';
import { groupIdOf, isGroup } from '../../lib/types';
import { openPicker } from '../games/store';
import { showProfile } from '../friends/ProfileCard';
import { openNotes } from '../notes/NotesPanel';

export function Sidebar() {
  const me = useApp((s) => s.me)!;
  const conn = useApp((s) => s.conn);
  const chats = useApp((s) => s.chats);
  const friends = useApp((s) => s.friends);
  const incoming = useApp((s) => s.incoming.length);
  const panel = useApp((s) => s.panel);
  const syncing = useApp((s) => s.syncing);
  const [waited, setWaited] = useState(false); // stop showing placeholders if the server is slow to answer
  useEffect(() => { const t = setTimeout(() => setWaited(true), 10_000); return () => clearTimeout(t); }, []);
  const headerTitle = useSettings((s) => s.headerTitle);
  const appLock = useSettings((s) => !!s.appLock);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const archivedView = panel === 'archived';

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return chats.filter((c) => {
      if (!c.ts && !c.draft) return false; // opened but never used
      if (!!c.archived !== archivedView) return false;
      if (filter === 'unread' && !c.unread) return false;
      if (q) {
        const f = friends[c.peer];
        return c.peer.includes(q) || (f?.name || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [chats, friends, query, filter, archivedView]);
  const archivedCount = chats.filter((c) => c.archived && c.ts).length;

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 px-3">
        {archivedView ? (
          <>
            <IconButton label="Back" onClick={() => setApp({ panel: null })}><ArrowLeft /></IconButton>
            <h1 className="flex-1 text-lg font-semibold">Archived</h1>
          </>
        ) : (
          <>
            <button onClick={() => setApp({ panel: 'settings' })} aria-label="Profile and settings" className="rounded-full">
              <Avatar u={me.u} name={me.name} size={40} />
            </button>
            <h1 className="min-w-0 flex-1 truncate pl-1 text-xl font-bold tracking-tight">{headerTitle.trim() || me.u}</h1>
            <PeekButton />
            {appLock && <IconButton label="Lock Chattrix" onClick={lockNow}><Lock /></IconButton>}
            <IconButton label="Diary" onClick={() => openNotes()}><NotebookPen /></IconButton>
            <IconButton label="Play games" onClick={() => openPicker()}><Gamepad2 /></IconButton>
            <div className="relative">
              <IconButton label="Friends" onClick={() => setApp({ panel: 'friends', friendsTab: incoming ? 'requests' : 'friends' })}>
                <UserPlus />
              </IconButton>
              {incoming > 0 && (
                <span className="pointer-events-none absolute top-0.5 right-0.5 grid min-w-[18px] place-items-center rounded-full bg-danger px-1 text-[11px] font-bold leading-[18px] text-white">{incoming}</span>
              )}
            </div>
            <Menu>
              <MenuTrigger asChild><IconButton label="Menu"><MoreVertical /></IconButton></MenuTrigger>
              <MenuContent>
                <MenuItem icon={<MessageSquarePlus />} onSelect={() => setApp({ panel: 'friends', friendsTab: 'friends' })}>New chat</MenuItem>
                <MenuItem icon={<Users />} onSelect={() => setApp({ panel: 'newgroup' })}>New group</MenuItem>
                <MenuItem icon={<UserPlus />} onSelect={() => setApp({ panel: 'friends', friendsTab: 'add' })}>Add friend</MenuItem>
                <MenuItem icon={<Gamepad2 />} onSelect={() => openPicker()}>Play games</MenuItem>
                <MenuItem icon={<NotebookPen />} onSelect={() => openNotes()}>Diary and notes</MenuItem>
                <MenuItem icon={<Archive />} onSelect={() => setApp({ panel: 'archived' })}>Archived chats</MenuItem>
                <MenuItem icon={<Settings />} onSelect={() => setApp({ panel: 'settings' })}>Settings</MenuItem>
                <MenuSeparator />
                <MenuItem icon={<LogOut />} danger onSelect={async () => {
                  if (await confirm({ title: 'Sign out?', description: 'Messages stored on this device will be removed. You can sign in again any time.', confirmText: 'Sign out', destructive: true })) logout();
                }}>Sign out</MenuItem>
              </MenuContent>
            </Menu>
          </>
        )}
      </header>

      {conn !== 'online' && (
        <div className="mx-3 mb-2 flex items-center gap-2 rounded-xl bg-warn px-3 py-2 text-sm" role="status">
          {conn === 'offline' ? <WifiOff className="size-4" /> : <Clock className="size-4 animate-pulse" />}
          {conn === 'offline' ? 'You’re offline. Messages will send when you reconnect.' : 'Connecting…'}
        </div>
      )}

      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search chats"
            className="h-10 w-full rounded-xl bg-panel-2 pr-9 pl-9 text-sm outline-none placeholder:text-muted focus:ring-2 focus:ring-accent/30" />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Clear search" className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1 text-muted hover:text-ink">
              <X className="size-4" />
            </button>
          )}
        </div>
        {!archivedView && (
          <div className="mt-2 flex gap-2">
            {(['all', 'unread'] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={cn('rounded-full px-3 py-1 text-sm font-medium transition', filter === f ? 'bg-accent/15 text-accent-ink' : 'bg-panel-2 text-muted hover:text-ink')}>
                {f === 'all' ? 'All' : 'Unread'}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!archivedView && archivedCount > 0 && !query && (
          <button onClick={() => setApp({ panel: 'archived' })} className="flex w-full items-center gap-4 px-5 py-3 text-left hover:bg-hover">
            <Archive className="size-5 text-accent-ink" />
            <span className="flex-1 font-medium">Archived</span>
            <span className="text-sm text-muted">{archivedCount}</span>
          </button>
        )}
        {!archivedView && !query && <GamesStrip />}
        <ul>{visible.map((c) => <ChatRow key={c.peer} chat={c} />)}</ul>
        {!visible.length && syncing && !waited && conn !== 'offline' && !query && !archivedView ? <ChatListSkeleton rows={6} />
          : !visible.length && <EmptyList archived={archivedView} searching={!!query || filter !== 'all'} />}
      </div>
    </>
  );
}

/** With the privacy screen on: show everything for a moment, or blur it again. */
export function PeekButton() {
  const on = useSettings((s) => s.privacyScreen);
  const peek = usePeek();
  if (!on) return null;
  return <IconButton label={peek ? 'Blur chats' : 'Show chats for 30 seconds'} onClick={() => togglePeek()}>{peek ? <EyeOff /> : <Eye />}</IconButton>;
}

function EmptyList({ archived, searching }: { archived: boolean; searching: boolean }) {
  const friends = useApp((s) => s.friends);
  const loaded = useApp((s) => s.friendsLoaded);
  if (searching) return <p className="px-6 py-10 text-center text-sm text-muted">No chats found.</p>;
  if (archived) return <p className="px-6 py-10 text-center text-sm text-muted">No archived chats.</p>;
  const list = Object.values(friends).sort((a, b) => displayName(a, a.u).localeCompare(displayName(b, b.u)));
  if (!list.length && !loaded) return <ChatListSkeleton rows={4} />;
  if (list.length) {
    return (
      <div className="py-4">
        <p className="px-5 pb-2 text-sm text-muted">No chats yet. Say hi to {list.length === 1 ? 'your friend' : `your ${list.length} friends`}:</p>
        <ul>
          {list.slice(0, 8).map((f) => (
            <li key={f.u}>
              <button onClick={() => openChat(f.u)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-hover">
                <Avatar u={f.u} name={f.name} size={48} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{displayName(f, f.u)}</span>
                  <span className="block truncate text-sm text-muted">@{f.u}</span>
                </span>
                <MessageSquarePlus className="size-5 text-accent-ink" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div className="px-8 py-12 text-center">
      <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-accent/12 text-accent-ink"><MessageSquarePlus className="size-8" /></div>
      <h2 className="mt-4 font-semibold">No chats yet</h2>
      <p className="mt-1 text-sm text-muted">Add friends by their username. Once they accept, you can start chatting.</p>
      <button onClick={() => setApp({ panel: 'friends', friendsTab: 'add' })}
        className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-medium text-white hover:brightness-110">
        <UserPlus className="size-4" /> Add a friend
      </button>
    </div>
  );
}

function ChatRow({ chat }: { chat: Chat }) {
  const friend = useApp((s) => s.friends[chat.peer]);
  const active = useApp((s) => s.active === chat.peer);
  const online = useApp((s) => s.presence[chat.peer]?.on);
  const typing = useApp((s) => s.typing[chat.peer]);
  const group = useApp((s) => (isGroup(chat.peer) ? s.groups[groupIdOf(chat.peer)] : undefined));
  const typingWho = useApp((s) => s.typingWho[chat.peer]);
  const friendsMap = useApp((s) => s.friends);
  useApp((s) => s.me?.mutes); // re-render when mutes change
  const muted = isMuted(chat.peer);
  const name = isGroup(chat.peer) ? group?.name || 'Group' : displayName(friend, chat.peer);
  const whoName = typingWho && (friendsMap[typingWho]?.name || group?.members.find((m) => m.u === typingWho)?.n || typingWho);

  let line: React.ReactNode = chat.last;
  if (typing) line = <span className="text-accent-ink">{whoName && isGroup(chat.peer) ? `${whoName} is ` : ''}{typing === 'recording' ? 'recording audio…' : 'typing…'}</span>;
  else if (chat.draft && !active) line = <><span className="text-danger">Draft: </span>{chat.draft}</>;
  else if (chat.lastOut && chat.last) line = <><Ticks s={chat.lastS ?? 0} className="mr-0.5 inline align-[-3px]" />{chat.last}</>;

  return (
    <li className={cn('priv-scope relative flex items-center transition hover:bg-hover', active && 'bg-hover')}>
      {/* the photo opens their profile card; the rest of the row opens the chat */}
      <button onClick={() => showProfile(chat.peer)} aria-label={`${name}’s profile`} className="absolute top-1/2 left-3 z-10 -translate-y-1/2 rounded-full">
        <Avatar u={chat.peer} name={name} size={50} online={online} className="priv" />
      </button>
      <button onClick={() => openChat(chat.peer)} className="flex w-full items-center gap-3 py-2.5 pr-3 pl-[74px] text-left">
        <span className="priv min-w-0 flex-1 border-b border-line/0 py-0.5">
          <span className="flex items-center gap-2">
            <span className="flex-1 truncate font-medium">{name}</span>
            <span className={cn('shrink-0 text-xs', chat.unread && !muted ? 'font-semibold text-accent-ink' : 'text-muted')}>
              {chat.ts ? fmtListTime(chat.ts) : ''}
            </span>
          </span>
          <span className="mt-0.5 flex items-center gap-2">
            <span className="flex-1 truncate text-sm text-muted">{line}</span>
            {muted && <BellOff className="size-4 shrink-0 text-muted" aria-label="Muted" />}
            {chat.unread > 0 && (
              <span className={cn('grid min-w-5 place-items-center rounded-full px-1.5 text-xs leading-5 font-semibold text-white', muted ? 'bg-muted' : 'bg-accent')}>
                {chat.unread}
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}
