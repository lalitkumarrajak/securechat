import { hasPendingLink } from '../../games/store';
import { pendingGroupInvite, pendingInviter } from '../../../lib/invite';
import { t } from '@sanga/i18n';

export function InviteBanner() {
  const text = hasPendingLink() ? t('🎲 You’ve been invited to a game. Sign in, or create a free account, to join.')
    : pendingGroupInvite() ? t('👥 You’ve been invited to a group. Sign in, or create a free account, to join.')
    : pendingInviter() ? t('👋 @{u} invited you to Sanga. Create a free account, or sign in, to chat.', { u: pendingInviter()! }) : '';
  return text ? <p className="mb-6 rounded-2xl bg-accent/12 px-4 py-3 text-sm font-medium text-accent-ink" role="status">{text}</p> : null;
}
