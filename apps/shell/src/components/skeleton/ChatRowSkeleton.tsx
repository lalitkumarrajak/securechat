// Grey placeholders shown while the app or the chat list is loading, shaped like what's coming.
import { cn } from '@sanga/ui/utils';
import { bar } from './skeletonBar';

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
