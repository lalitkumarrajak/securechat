import { cn } from '@sanga/ui/utils';
import { useApp } from '../../state/app';
import { Sidebar } from '../sidebar/Sidebar';
import { ChatPane } from '../conversation/ChatPane';
import { EmptyPane } from '../conversation/chat-pane/EmptyPane';

/** Chat: two panes on desktop; on phones, the chat list or the open chat. */
export function Shell() {
  const active = useApp((s) => s.active);
  return (
    <div className="mx-auto flex h-[var(--app-h,100dvh)] max-w-[1600px] overflow-hidden bg-panel md:border-x md:border-line">
      <aside className={cn('flex w-full flex-col border-line bg-panel md:w-[360px] md:shrink-0 md:border-r lg:w-[400px]', active && 'hidden md:flex')}>
        <Sidebar />
      </aside>
      <main className={cn('min-w-0 flex-1 flex-col', active ? 'flex' : 'hidden md:flex')}>
        {active ? <ChatPane key={active} peer={active} /> : <EmptyPane />}
      </main>
    </div>
  );
}
