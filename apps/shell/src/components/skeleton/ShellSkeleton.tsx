import { cn } from '@sanga/ui/utils';
import { ChatListSkeleton } from './ChatListSkeleton';
import { bar } from './skeletonBar';

/** The whole app while it starts: the chat list on the left, an empty pane on wide screens. */
export function ShellSkeleton() {
  return (
    <div className="mx-auto flex h-dvh max-w-[1600px] overflow-hidden bg-panel md:border-x md:border-line" role="status" aria-label="Loading Sanga">
      <aside className="flex w-full flex-col md:w-[360px] md:shrink-0 md:border-r md:border-line lg:w-[400px]">
        <div className="flex h-16 shrink-0 items-center gap-3 px-3">
          <span className="size-10 rounded-full bg-line/70 animate-pulse" />
          <span className={cn(bar, 'h-5 w-32')} />
          <span className="ml-auto flex gap-3">
            {[0, 1, 2].map((k) => <span key={k} className="size-6 rounded-full bg-line/70 animate-pulse" />)}
          </span>
        </div>
        <div className="px-3 pb-2"><span className="block h-10 rounded-xl bg-line/50 animate-pulse" /></div>
        <ChatListSkeleton />
      </aside>
      <main className="hidden flex-1 bg-panel-2 md:block" />
    </div>
  );
}
