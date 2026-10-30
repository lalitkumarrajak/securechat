import { hasPendingLink } from '../../games/store';
import { pendingGroupInvite, pendingInviter } from '../../../lib/invite';

export function InviteBanner() {
  const text = hasPendingLink() ? '🎲 You’ve been invited to a game. Sign in, or create a free account, to join.'
    : pendingGroupInvite() ? '👥 You’ve been invited to a group. Sign in, or create a free account, to join.'
    : pendingInviter() ? `👋 @${pendingInviter()} invited you to Sanga. Create a free account, or sign in, to chat.` : '';
  return text ? <p className="mb-6 rounded-2xl bg-accent/12 px-4 py-3 text-sm font-medium text-accent-ink" role="status">{text}</p> : null;
}
