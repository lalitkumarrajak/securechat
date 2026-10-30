import { useEffect, useMemo, useState } from 'react';
import { Archive, ArrowLeft, CirclePlus, Clock, Lock, LogOut, MessageSquarePlus, MoreVertical, Search, Settings, UserPlus, Users, WifiOff, X } from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import { IconButton } from '@sanga/ui/button';
import { confirm } from '@sanga/ui/confirm';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@sanga/ui/menu';
import { logout } from '../../lib/engine';
import { cn } from '@sanga/ui/utils';
import { setApp, useApp } from '../../state/app';
import { GamesStrip } from '../games/GamesStrip';
import { StoriesList } from '../stories/StoriesList';
import { openComposer } from '../../lib/stories';
import { ChatListSkeleton } from '../../components/skeleton/ChatListSkeleton';
import { useSettings } from '../../state/settings';
import { lockNow } from '../../lib/applock';
import { AppTabs } from '../nav/AppTabs';
import { ChatRow } from './ChatRow';
import { EmptyList } from './EmptyList';
import { PeekButton } from './PeekButton';

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
  const storiesTab = useApp((s) => s.section === 'stories') && !archivedView;

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
      {/* Stories has no top bar: "My story" is the first thing on it. */}
      {!storiesTab && (archivedView ? (
        <header className="flex h-14 shrink-0 items-center gap-2 px-3 md:h-16">
          <IconButton label="Back" onClick={() => setApp({ panel: null })}><ArrowLeft /></IconButton>
          <h1 className="flex-1 text-lg font-semibold">Archived</h1>
        </header>
      ) : (
        <header className="flex h-14 shrink-0 items-center gap-2 px-3 md:h-16">
          <button onClick={() => setApp({ panel: 'settings' })} aria-label="Profile and settings" className="rounded-full">
            <Avatar u={me.u} name={me.name} size={40} />
          </button>
          <h1 className="min-w-0 flex-1 truncate pl-1 text-xl font-bold tracking-tight">{headerTitle.trim() || me.u}</h1>
          <div className="flex items-center">
            <PeekButton />
            {appLock && <IconButton label="Lock Sanga" onClick={lockNow}><Lock /></IconButton>}
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
                <MenuItem icon={<CirclePlus />} onSelect={() => openComposer()}>New story</MenuItem>
                <MenuItem icon={<UserPlus />} onSelect={() => setApp({ panel: 'friends', friendsTab: 'add' })}>Add friend</MenuItem>
                <MenuItem icon={<Archive />} onSelect={() => setApp({ panel: 'archived' })}>Archived chats</MenuItem>
                <MenuItem icon={<Settings />} onSelect={() => setApp({ panel: 'settings' })}>Settings</MenuItem>
                <MenuSeparator />
                <MenuItem icon={<LogOut />} danger onSelect={async () => {
                  if (await confirm({ title: 'Sign out?', description: 'Messages stored on this device will be removed. You can sign in again any time.', confirmText: 'Sign out', destructive: true })) logout();
                }}>Sign out</MenuItem>
              </MenuContent>
            </Menu>
          </div>
        </header>
      ))}

      {conn !== 'online' && (
        <div className="mx-3 mb-2 flex items-center gap-2 rounded-xl bg-warn px-3 py-2 text-sm" role="status">
          {conn === 'offline' ? <WifiOff className="size-4" /> : <Clock className="size-4 animate-pulse" />}
          {conn === 'offline' ? 'You’re offline. Messages will send when you reconnect.' : 'Connecting…'}
        </div>
      )}

      {/* Only the header stays put: search and games scroll away with the chats, so on a
          phone the list gets nearly the whole screen. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {storiesTab ? <StoriesList /> : <>
        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search chats"
              className="h-10 w-full rounded-xl bg-panel-2 pr-8 pl-9 text-sm outline-none placeholder:text-muted focus:ring-2 focus:ring-accent/30" />
            {query && (
              <button onClick={() => setQuery('')} aria-label="Clear search" className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-full p-1 text-muted hover:text-ink">
                <X className="size-4" />
              </button>
            )}
          </div>
          {!archivedView && (
            <div className="mt-2 flex gap-2">
              {(['all', 'unread'] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
                  className={cn('h-8 shrink-0 rounded-full px-3.5 text-sm font-medium transition', filter === f ? 'bg-accent/15 text-accent-ink' : 'bg-panel-2 text-muted hover:text-ink')}>
                  {f === 'all' ? 'All' : 'Unread'}
                </button>
              ))}
            </div>
          )}
        </div>
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
        </>}
      </div>
      {!archivedView && <AppTabs />}
    </>
  );
}
