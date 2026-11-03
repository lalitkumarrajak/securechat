import { toast } from 'sonner';
import { Archive, ArchiveRestore, ArrowLeft, Bell, BellOff, FolderPlus, Gamepad2, Info, MoreVertical, NotebookPen, Phone, Search, ShieldCheck, SquareCheck, UserMinus, UserX, Video } from 'lucide-react';
import { Avatar } from '../../../components/Avatar';
import { openNotes } from '../../../lib/notes';
import { startCall } from '../../../lib/calls';
import { IconButton } from '@sanga/ui/button';
import { confirm } from '@sanga/ui/confirm';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuSub, MenuSubContent, MenuSubTrigger, MenuTrigger } from '@sanga/ui/menu';
import { blockUser, closeChat, isMuted, mute, removeFriend, setArchived, unblockUser } from '../../../lib/engine';
import { fmtLastSeen } from '@sanga/ui/format';
import { setApp, useApp } from '../../../state/app';
import { openPicker } from '../../games/store';
import { PeekButton } from '../../sidebar/PeekButton';
import { addChatTab } from '../chatTabs';
import { setChatUi } from '../chatUi';
import { t } from '@sanga/i18n';

export function PersonHeader({ peer, name }: { peer: string; name: string }) {
  const presence = useApp((s) => s.presence[peer]);
  const typing = useApp((s) => s.typing[peer]);
  const friend = useApp((s) => s.friends[peer]);
  const archived = useApp((s) => s.chats.find((c) => c.peer === peer)?.archived);
  const blocked = useApp((s) => s.blocked.includes(peer));
  useApp((s) => s.me?.mutes);
  const muted = isMuted(peer);

  const status = typing ? (typing === 'recording' ? t('recording audio…') : t('typing…'))
    : !friend ? '' : presence?.on ? t('online') : presence?.ls ? fmtLastSeen(presence.ls) : friend?.about || '@' + peer;

  const doMute = (until: number, label: string) => mute(peer, until).then(() => toast(label)).catch((e) => toast.error(e.message));

  return (
    <header className="flex h-16 shrink-0 items-center gap-1 border-b border-line bg-panel px-2">
      <IconButton label={t('Back')} className="md:hidden" onClick={closeChat}><ArrowLeft /></IconButton>
      <button onClick={() => setApp({ panel: 'contact' })} className="priv-scope flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1.5 py-1 text-left hover:bg-hover">
        <Avatar u={peer} name={name} size={40} className="priv" />
        <span className="priv min-w-0">
          <span className="flex items-center gap-1.5 truncate font-semibold">{name}{muted && <BellOff className="size-3.5 text-muted" />}</span>
          <span className={`block truncate text-xs ${typing || presence?.on ? 'text-accent-ink' : 'text-muted'}`}>{status}</span>
        </span>
      </button>
      {friend && !blocked && (
        <>
          <IconButton label={t('Video call')} onClick={() => void startCall(peer, true)}><Video /></IconButton>
          <IconButton label={t('Voice call')} onClick={() => void startCall(peer, false)}><Phone /></IconButton>
        </>
      )}
      <IconButton label={t('Play a game')} className="hidden md:inline-flex" onClick={() => openPicker([peer])}><Gamepad2 /></IconButton>
      <PeekButton />
      <IconButton label={t('Search in chat')} className="hidden md:inline-flex" onClick={() => setApp({ searchOpen: true })}><Search /></IconButton>
      <Menu>
        <MenuTrigger asChild><IconButton label={t('Chat options')}><MoreVertical /></IconButton></MenuTrigger>
        <MenuContent>
          <MenuItem icon={<Info />} onSelect={() => setApp({ panel: 'contact' })}>{t('Contact info')}</MenuItem>
          <MenuItem icon={<Search />} onSelect={() => setApp({ searchOpen: true })}>{t('Search')}</MenuItem>
          <MenuItem icon={<SquareCheck />} onSelect={() => setApp({ selection: [] })}>{t('Select messages')}</MenuItem>
          <MenuItem icon={<Gamepad2 />} onSelect={() => openPicker([peer])}>{t('Play a game')}</MenuItem>
          <MenuItem icon={<NotebookPen />} onSelect={() => openNotes(peer)}>{t('Notes about this chat')}</MenuItem>
          {friend && !blocked && <MenuItem icon={<FolderPlus />} onSelect={addChatTab}>{t('Add a tab')}</MenuItem>}
          {muted ? (
            <MenuItem icon={<Bell />} onSelect={() => doMute(0, t('Notifications on'))}>{t('Unmute')}</MenuItem>
          ) : (
            <MenuSub>
              <MenuSubTrigger icon={<BellOff />}>{t('Mute notifications')}</MenuSubTrigger>
              <MenuSubContent>
                <MenuItem onSelect={() => doMute(Date.now() + 8 * 3600e3, t('Muted for 8 hours'))}>{t('8 hours')}</MenuItem>
                <MenuItem onSelect={() => doMute(Date.now() + 7 * 864e5, t('Muted for 1 week'))}>{t('1 week')}</MenuItem>
                <MenuItem onSelect={() => doMute(-1, t('Muted'))}>{t('Always')}</MenuItem>
              </MenuSubContent>
            </MenuSub>
          )}
          <MenuItem icon={<ShieldCheck />} onSelect={() => setChatUi({ verify: true })}>{t('Verify security code')}</MenuItem>
          <MenuItem icon={archived ? <ArchiveRestore /> : <Archive />} onSelect={() => setArchived(peer, !archived)}>{archived ? t('Unarchive') : t('Archive')}</MenuItem>
          <MenuSeparator />
          {friend && (
            <MenuItem icon={<UserMinus />} danger onSelect={async () => {
              if (await confirm({ title: t('Remove {name} from friends?', { name }), description: t('You won’t be able to message each other until one of you sends a new friend request. Your chat history stays on this device.'), confirmText: t('Remove'), destructive: true })) {
                removeFriend(peer).then(() => toast(t('{name} removed from friends', { name }))).catch((e) => toast.error(e.message));
              }
            }}>{t('Remove friend')}</MenuItem>
          )}
          <MenuItem icon={<UserX />} danger onSelect={async () => {
            if (blocked) return unblockUser(peer).then(() => toast(t('{name} unblocked', { name })));
            if (await confirm({ title: t('Block {name}?', { name }), description: t('They won’t be able to message you, see your online status, or find you in search. They won’t be notified.'), confirmText: t('Block'), destructive: true })) {
              blockUser(peer).then(() => toast(t('{name} blocked', { name }))).catch((e) => toast.error(e.message));
            }
          }}>{blocked ? t('Unblock') : t('Block')}</MenuItem>
        </MenuContent>
      </Menu>
    </header>
  );
}
