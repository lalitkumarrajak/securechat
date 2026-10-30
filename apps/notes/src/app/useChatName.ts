import { useMemo } from 'react';
import { sdk } from '@sanga/sdk';

export function useChatName() {
  const chats = sdk().useChats();
  return useMemo(() => {
    const names = new Map(chats.map((c) => [c.peer, c.name]));
    return (peer: string) => (!peer ? 'Personal' : names.get(peer) || (peer.startsWith('g:') ? 'Group' : peer));
  }, [chats]);
}
