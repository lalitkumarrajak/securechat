import { ChatRowSkeleton } from './ChatRowSkeleton';
import { t } from '@sanga/i18n';

export function ChatListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <ul role="status" aria-label={t('Loading chats')}>
      {Array.from({ length: rows }, (_, i) => <ChatRowSkeleton key={i} i={i} />)}
    </ul>
  );
}
