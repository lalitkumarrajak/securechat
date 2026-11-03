import { useMemo } from 'react';
import { sdk } from '@sanga/sdk';
import { t } from '@sanga/i18n';

export function useChatName() {
  const chats = sdk().useChats();
  return useMemo(() => {
    const names = new Map(chats.map((c) => [c.peer, c.name]));
    return (peer: string) => (!peer ? t('Personal') : names.get(peer) || (peer.startsWith('g:') ? t('Group') : peer));
  }, [chats]);
}
