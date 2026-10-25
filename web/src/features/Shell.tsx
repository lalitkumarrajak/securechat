import { lazy, Suspense, useEffect } from 'react';
import { cn } from '../lib/utils';
import { useApp } from '../state/app';
import { Sidebar } from './sidebar/Sidebar';
import { ChatPane, EmptyPane } from './conversation/ChatPane';
import { FriendsPanel } from './friends/FriendsPanel';
import { SettingsPanel } from './settings/SettingsPanel';
import { ContactPanel } from './conversation/ContactPanel';
import { NewGameDialog } from './games/NewGameDialog';
import { useGames } from './games/store';

// Loaded when a game is opened, so the app starts faster.
const GameScreen = lazy(() => import('./games/GameScreen').then((m) => ({ default: m.GameScreen })));
const GroupInfoPanel = lazy(() => import('./groups/GroupInfoPanel').then((m) => ({ default: m.GroupInfoPanel })));
const NewGroupPanel = lazy(() => import('./groups/NewGroupPanel').then((m) => ({ default: m.NewGroupPanel })));
import { handleInvite } from '../lib/invite';

/** Two panes on desktop; on phones, the chat list or the open chat. */
export function Shell() {
  const active = useApp((s) => s.active);
  const gameOpen = useGames((s) => !!s.open);
  const panel = useApp((s) => s.panel);
  useEffect(() => { handleInvite(); }, []); // opened from someone's invite link
  return (
    <div className="mx-auto flex h-dvh max-w-[1600px] overflow-hidden bg-panel md:border-x md:border-line">
      <aside className={cn('flex w-full flex-col border-line bg-panel md:w-[360px] md:shrink-0 md:border-r lg:w-[400px]', active && 'hidden md:flex')}>
        <Sidebar />
      </aside>
      <main className={cn('min-w-0 flex-1 flex-col', active ? 'flex' : 'hidden md:flex')}>
        {active ? <ChatPane key={active} peer={active} /> : <EmptyPane />}
      </main>
      <FriendsPanel />
      <SettingsPanel />
      <ContactPanel />
      <Suspense fallback={null}>
        {panel === 'group' && <GroupInfoPanel />}
        {panel === 'newgroup' && <NewGroupPanel />}
      </Suspense>
      <NewGameDialog />
      {gameOpen && <Suspense fallback={null}><GameScreen /></Suspense>}
    </div>
  );
}
