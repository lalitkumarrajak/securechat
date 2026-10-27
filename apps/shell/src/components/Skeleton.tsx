// Grey placeholders shown while the app or the chat list is loading, shaped like what's coming.
import { cn } from '@sanga/ui/utils';

const bar = 'rounded-full bg-line/70 animate-pulse';

export function ChatRowSkeleton({ i = 0 }: { i?: number }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3" aria-hidden>
      <span className="size-12 shrink-0 rounded-full bg-line/70 animate-pulse" />
      <span className="min-w-0 flex-1 space-y-2">
        <span className={cn(bar, 'block h-3.5')} style={{ width: `${45 + ((i * 17) % 35)}%` }} />
        <span className={cn(bar, 'block h-3')} style={{ width: `${60 + ((i * 23) % 30)}%` }} />
      </span>
      <span className={cn(bar, 'h-2.5 w-9 self-start mt-1')} />
    </li>
  );
}

export function ChatListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <ul role="status" aria-label="Loading chats">
      {Array.from({ length: rows }, (_, i) => <ChatRowSkeleton key={i} i={i} />)}
    </ul>
  );
}

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
