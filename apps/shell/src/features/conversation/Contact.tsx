import { toast } from 'sonner';
import { Archive, ArchiveRestore, ArrowLeft, Bell, BellOff, Lock, Search, ShieldCheck, UserMinus, UserX } from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import { IconButton } from '@sanga/ui/button';
import { confirm } from '@sanga/ui/confirm';
import { blockUser, isMuted, mute, removeFriend, setArchived, unblockUser } from '../../lib/engine';
import { fmtLastSeen } from '@sanga/ui/format';
import { displayName } from '../../lib/types';
import { setApp, useApp } from '../../state/app';
import { setChatUi } from './chatUi';
import { Quick } from './Quick';
import { Row } from './Row';
import { locale, t, tn } from '@sanga/i18n';

export function Contact({ peer }: { peer: string }) {
  const friend = useApp((s) => s.friends[peer]);
  const presence = useApp((s) => s.presence[peer]);
  const photo = useApp((s) => s.avatars[peer]);
  const blocked = useApp((s) => s.blocked.includes(peer));
  const archived = useApp((s) => s.chats.find((c) => c.peer === peer)?.archived);
  const pins = useApp((s) => s.chats.find((c) => c.peer === peer)?.pins?.length || 0);
  useApp((s) => s.me?.mutes);
  const muted = isMuted(peer);
  const name = displayName(friend, peer);
  const close = () => setApp({ panel: null });

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 bg-panel px-3">
        <IconButton label={t('Close')} onClick={close}><ArrowLeft /></IconButton>
        <h2 className="text-lg font-semibold">{t('Contact info')}</h2>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <section className="bg-panel px-6 pt-4 pb-6 text-center">
          <button onClick={() => photo && setChatUi({ viewer: photo })} className="mx-auto block rounded-full" aria-label={t('View photo')}>
            <Avatar u={peer} name={name} size={128} />
          </button>
          <h3 className="mt-4 text-2xl font-semibold">{name}</h3>
          <p className="text-muted">@{peer}</p>
          <p className="mt-1 text-sm text-accent-ink">{presence?.on ? t('online') : presence?.ls ? fmtLastSeen(presence.ls) : ''}</p>
          <div className="mt-5 flex justify-center gap-3">
            <Quick icon={<Search />} label={t('Search')} onClick={() => { close(); setApp({ searchOpen: true }); }} />
            <Quick icon={muted ? <Bell /> : <BellOff />} label={muted ? t('Unmute') : t('Mute')} onClick={() =>
              mute(peer, muted ? 0 : -1).then(() => toast(muted ? t('Notifications on') : t('Muted'))).catch((e) => toast.error(e.message))} />
            <Quick icon={archived ? <ArchiveRestore /> : <Archive />} label={archived ? t('Unarchive') : t('Archive')} onClick={() => setArchived(peer, !archived)} />
          </div>
        </section>

        {friend?.about && (
          <section className="mt-2 bg-panel px-6 py-4">
            <h4 className="text-xs font-semibold tracking-wide text-muted uppercase">{t('About')}</h4>
            <p className="mt-1 whitespace-pre-wrap">{friend.about}</p>
          </section>
        )}

        <section className="mt-2 bg-panel py-2">
          {pins > 0 && <Row icon={<span className="text-base">📌</span>} label={tn(pins, '{n} pinned message', '{n} pinned messages')} onClick={close} />}
          <Row icon={<Lock />} label={t('Encryption')} sub={t('Messages are end-to-end encrypted. Tap to verify the security code.')}
            onClick={() => { close(); setChatUi({ verify: true }); }} />
          <Row icon={<ShieldCheck />} label={t('Friends since')} sub={friend ? new Date(friend.since).toLocaleDateString(locale()) : t('Not friends')} />
        </section>

        <section className="mt-2 mb-6 bg-panel py-2">
          <Row icon={<UserX />} danger label={blocked ? t('Unblock {name}', { name }) : t('Block {name}', { name })} onClick={async () => {
            if (blocked) return unblockUser(peer).then(() => toast(t('{name} unblocked', { name })));
            if (await confirm({ title: t('Block {name}?', { name }), description: t('They won’t be able to message you, see your online status, or find you in search.'), confirmText: t('Block'), destructive: true })) {
              blockUser(peer).then(() => toast(t('{name} blocked', { name }))).catch((e) => toast.error(e.message));
            }
          }} />
          {friend && (
            <Row icon={<UserMinus />} danger label={t('Remove friend')} onClick={async () => {
              if (await confirm({ title: t('Remove {name} from friends?', { name }), description: t('You won’t be able to message each other until one of you sends a new request.'), confirmText: t('Remove'), destructive: true })) {
                removeFriend(peer).then(() => toast(t('{name} removed from friends', { name }))).catch((e) => toast.error(e.message));
              }
            }} />
          )}
        </section>
      </div>
    </>
  );
}
