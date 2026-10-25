import { cn } from '../lib/utils';
import { useApp } from '../state/app';
import { Sidebar } from './sidebar/Sidebar';
import { ChatPane, EmptyPane } from './conversation/ChatPane';
import { FriendsPanel } from './friends/FriendsPanel';
import { SettingsPanel } from './settings/SettingsPanel';
import { ContactPanel } from './conversation/ContactPanel';

/** Two panes on desktop; on phones, the chat list or the open chat. */
export function Shell() {
  const active = useApp((s) => s.active);
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
    </div>
  );
}
