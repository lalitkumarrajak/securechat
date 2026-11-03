import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@sanga/ui/button';
import { acceptRequest, closeChat, deleteChatHere, sendRequest, unblockUser } from '../../lib/engine';
import { displayName, groupIdOf, isGroup } from '../../lib/types';
import { getApp, setApp, useApp } from '../../state/app';
import { useGames } from '../games/store';
import { setChatUi } from './chatUi';
import { Composer } from './Composer';
import { MessageList } from './MessageList';
import { ChatDialogs } from './ChatDialogs';
import { ChatTabDialog } from './ChatTabDialog';
import { ChatTabs } from './ChatTabs';
import { Action } from './chat-pane/Action';
import { Banner } from './chat-pane/Banner';
import { Header } from './chat-pane/Header';
import { SelectionBar } from './chat-pane/SelectionBar';
import { SearchBar } from './chat-pane/SearchBar';
import { PinnedBar } from './chat-pane/PinnedBar';
import { t } from '@sanga/i18n';

// Esc closes the top-most thing first (menus and dialogs claim it themselves), then selection,
// search, a reply or edit being written, and finally the chat itself, like WhatsApp.
function useEscapeToClose() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || e.repeat) return;
      if (useGames.getState().open || useGames.getState().picker) return; // a game screen is on top
      const s = getApp();
      if (s.panel) return;
      if (s.selection) setApp({ selection: null });
      else if (s.searchOpen) setApp({ searchOpen: false, searchQuery: '' });
      else if (s.replyTo || s.editing) setApp({ replyTo: null, editing: null });
      else closeChat();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export function ChatPane({ peer }: { peer: string }) {
  useEscapeToClose();
  const friend = useApp((s) => s.friends[peer]);
  const selection = useApp((s) => s.selection);
  const searchOpen = useApp((s) => s.searchOpen);
  const topic = useApp((s) => s.topic);
  const keyChanged = useApp((s) => s.keyChanged[peer]);
  const blocked = useApp((s) => s.blocked.includes(peer));
  const requestOut = useApp((s) => s.outgoing.some((r) => r.u === peer));
  const requestIn = useApp((s) => s.incoming.some((r) => r.u === peer));
  // The unread count when the chat was opened places the "N unread" divider.
  // With tabs, only the main chat's own unread count (each tab keeps its own).
  const [unreadAtOpen] = useState(() => {
    const c = useApp.getState().chats.find((x) => x.peer === peer);
    return (c?.topics?.length ? c.tunread?.[''] : c?.unread) || 0;
  });
  const group = useApp((s) => (isGroup(peer) ? s.groups[groupIdOf(peer)] : undefined));
  const groupsLoaded = useApp((s) => s.groupsLoaded);
  const name = isGroup(peer) ? group?.name || t('Group') : displayName(friend, peer);
  const canSend = isGroup(peer) ? !!group && (!group.adminsOnly || group.admin) : !!friend && !blocked && !keyChanged;

  return (
    <div className="flex h-full min-h-0 flex-col bg-chat">
      {selection ? <SelectionBar /> : <Header peer={peer} name={name} />}
      <ChatTabs peer={peer} />
      {searchOpen && !selection && <SearchBar />}
      <PinnedBar peer={peer} />
      {keyChanged && !isGroup(peer) && (
        <Banner icon={<ShieldAlert className="size-5 text-danger" />} action={<Button size="sm" variant="outline" onClick={() => setChatUi({ verify: true })}>{t('Review')}</Button>}>
          {t('{name}’s security code changed. Sending is paused until you verify it.', { name })}
        </Banner>
      )}
      <MessageList key={topic} peer={peer} peerName={name} unreadAtOpen={topic ? 0 : unreadAtOpen} />
      {canSend ? <Composer key={peer} peer={peer} peerName={name} /> : (
        <div className="shrink-0 border-t border-line bg-panel px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-sm">
          {isGroup(peer) ? (
            group ? <span className="text-muted">{t('Only admins can send messages.')}</span> // i18n-ok
              : groupsLoaded ? <>{t('You’re no longer in this group.')} <Action onClick={() => deleteChatHere(peer)}>{t('Delete chat')}</Action></>
              : <span className="text-muted">{t('Loading…')}</span>
          ) : blocked ? (
            <>{t('You blocked {name}.', { name })} <Action onClick={() => unblockUser(peer)}>{t('Unblock')}</Action></>
          ) : keyChanged ? (
            <>{t('Verify the new security code to keep chatting.')}</>
          ) : requestIn ? (
            <>{t('{name} wants to be your friend.', { name })} <Action onClick={() => acceptRequest(peer)}>{t('Accept')}</Action></>
          ) : requestOut ? (
            <span className="text-muted">{t('Friend request sent. You can chat once {name} accepts.', { name })}</span>
          ) : (
            <>{t('You’re not friends with {name}.', { name })} <Action onClick={() => sendRequest(peer).then(() => toast.success(t('Friend request sent')))}>{t('Send friend request')}</Action></>
          )}
        </div>
      )}
      <ChatDialogs peer={peer} name={name} />
      <ChatTabDialog peer={peer} />
    </div>
  );
}
