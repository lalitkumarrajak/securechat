import { useEffect, useMemo, useState } from 'react';
import { Archive, ArrowLeft, Clock, Loader2, Lock, Search, WifiOff, X } from 'lucide-react';
import { IconButton } from '@sanga/ui/button';
import { cn } from '@sanga/ui/utils';
import { setApp, useApp } from '../../state/app';
import { GamesStrip } from '../games/GamesStrip';
import { StoriesBar } from '../stories/StoriesBar';
import { ChatListSkeleton } from '../../components/skeleton/ChatListSkeleton';
import { useSettings } from '../../state/settings';
import { lockNow } from '../../lib/applock';
import { AppTabs } from '../nav/AppTabs';
import { ChatRow } from './ChatRow';
import { EmptyList } from './EmptyList';
import { PeekButton } from './PeekButton';
import { t } from '@sanga/i18n';

export function Sidebar() {
  const me = useApp((s) => s.me)!;
  const conn = useApp((s) => s.conn);
  const chats = useApp((s) => s.chats);
  const friends = useApp((s) => s.friends);
  const panel = useApp((s) => s.panel);
  const syncing = useApp((s) => s.syncing);
  const [waited, setWaited] = useState(false); // stop showing placeholders if the server is slow to answer
  useEffect(() => { const timer = setTimeout(() => setWaited(true), 10_000); return () => clearTimeout(timer); }, []);
  // Opening the app: the connection usually comes up within a second. Until it has been trying for a
  // while, a quiet "Updating…" by the title says so, not a yellow banner that flashes on every open.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (conn !== 'connecting') { setSlow(false); return; }
    const timer = setTimeout(() => setSlow(true), 3000);
    return () => clearTimeout(timer);
  }, [conn]);
  const banner = conn === 'offline' || (conn === 'connecting' && slow);
  // What this device had shows at once; what came in meanwhile is still on its way.
  const updating = !banner && (conn === 'connecting' || syncing);
  const privacyScreen = useSettings((s) => !!s.privacyScreen);
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
      {archivedView ? (
        <header className="flex h-14 shrink-0 items-center gap-2 px-3 md:h-16">
          <IconButton label={t('Back')} onClick={() => setApp({ panel: null })}><ArrowLeft /></IconButton>
          <h1 className="flex-1 text-lg font-semibold">{t('Archived')}</h1>
        </header>
      ) : (
        // No top bar: your name, friends and settings are in the Account tab. The heading is for screen
        // readers; the lock, the privacy screen's eye and "Updating…" get a slim row only when there's one to show.
        <header className={cn('flex shrink-0 items-center gap-2 px-3', updating || appLock || privacyScreen ? 'h-11 pt-1' : 'h-2')}>
          <h1 className="sr-only">{me.u}</h1>
          <div className="flex min-w-0 flex-1 items-center pl-2">
            {updating && (
              <span data-testid="chats-updating" role="status" className="flex shrink-0 animate-fade-in items-center gap-1 text-xs text-muted">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />{t('Updating…')}
              </span>
            )}
          </div>
          <div className="flex items-center">
            <PeekButton />
            {appLock && <IconButton label={t('Lock Sanga')} onClick={lockNow}><Lock /></IconButton>}
          </div>
        </header>
      )}

      {banner && (
        <div className="mx-3 mb-2 flex items-center gap-2 rounded-xl bg-warn px-3 py-2 text-sm" role="status">
          {conn === 'offline' ? <WifiOff className="size-4" /> : <Clock className="size-4 animate-pulse" />}
          {conn === 'offline' ? t('You’re offline. Messages will send when you reconnect.') : t('Connecting…')}
        </div>
      )}

      {/* Only the header stays put: stories, search and games scroll away with the chats, so on a
          phone the list gets nearly the whole screen. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!archivedView && <StoriesBar />}
        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('Search chats')}
              className="h-10 w-full rounded-xl bg-panel-2 pr-8 pl-9 text-sm outline-none placeholder:text-muted focus:ring-2 focus:ring-accent/30" />
            {query && (
              <button onClick={() => setQuery('')} aria-label={t('Clear search')} className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-full p-1 text-muted hover:text-ink">
                <X className="size-4" />
              </button>
            )}
          </div>
          {!archivedView && (
            <div className="mt-2 flex gap-2">
              {(['all', 'unread'] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
                  className={cn('h-8 shrink-0 rounded-full px-3.5 text-sm font-medium transition', filter === f ? 'bg-accent/15 text-accent-ink' : 'bg-panel-2 text-muted hover:text-ink')}>
                  {f === 'all' ? t('All') : t('Unread')}
                </button>
              ))}
            </div>
          )}
        </div>
        {!archivedView && archivedCount > 0 && !query && (
          <button onClick={() => setApp({ panel: 'archived' })} className="flex w-full items-center gap-4 px-5 py-3 text-left hover:bg-hover">
            <Archive className="size-5 text-accent-ink" />
            <span className="flex-1 font-medium">{t('Archived')}</span>
            <span className="text-sm text-muted">{archivedCount}</span>
          </button>
        )}
        {!archivedView && !query && <GamesStrip />}
        <ul>{visible.map((c) => <ChatRow key={c.peer} chat={c} />)}</ul>
        {!visible.length && syncing && !waited && conn !== 'offline' && !query && !archivedView ? <ChatListSkeleton rows={6} />
          : !visible.length && <EmptyList archived={archivedView} searching={!!query || filter !== 'all'} />}
      </div>
      {!archivedView && <AppTabs />}
    </>
  );
}
