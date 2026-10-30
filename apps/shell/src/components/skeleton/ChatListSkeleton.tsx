import { ChatRowSkeleton } from './ChatRowSkeleton';

export function ChatListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <ul role="status" aria-label="Loading chats">
      {Array.from({ length: rows }, (_, i) => <ChatRowSkeleton key={i} i={i} />)}
    </ul>
  );
}
