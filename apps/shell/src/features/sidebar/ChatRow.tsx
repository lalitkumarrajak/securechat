import { BellOff } from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import { Ticks } from '../../components/Ticks';
import { isMuted, openChat } from '../../lib/engine';
import { fmtListTime } from '@sanga/ui/format';
import { displayName, type Chat } from '../../lib/types';
import { cn } from '@sanga/ui/utils';
import { useApp } from '../../state/app';
import { groupIdOf, isGroup } from '../../lib/types';
import { showProfile } from '../friends/ProfileCard';

export function ChatRow({ chat }: { chat: Chat }) {
  const friend = useApp((s) => s.friends[chat.peer]);
  const active = useApp((s) => s.active === chat.peer);
  const online = useApp((s) => s.presence[chat.peer]?.on);
  const typing = useApp((s) => s.typing[chat.peer]);
  const group = useApp((s) => (isGroup(chat.peer) ? s.groups[groupIdOf(chat.peer)] : undefined));
  const typingWho = useApp((s) => s.typingWho[chat.peer]);
  const friendsMap = useApp((s) => s.friends);
  useApp((s) => s.me?.mutes); // re-render when mutes change
  const muted = isMuted(chat.peer);
  const name = isGroup(chat.peer) ? group?.name || 'Group' : displayName(friend, chat.peer);
  const whoName = typingWho && (friendsMap[typingWho]?.name || group?.members.find((m) => m.u === typingWho)?.n || typingWho);

  let line: React.ReactNode = chat.last;
  if (typing) line = <span className="text-accent-ink">{whoName && isGroup(chat.peer) ? `${whoName} is ` : ''}{typing === 'recording' ? 'recording audio…' : 'typing…'}</span>;
  else if (chat.draft && !active) line = <><span className="text-danger">Draft: </span>{chat.draft}</>;
  else if (chat.lastOut && chat.last) line = <><Ticks s={chat.lastS ?? 0} className="mr-0.5 inline align-[-3px]" />{chat.last}</>;

  return (
    <li className={cn('priv-scope relative flex items-center transition hover:bg-hover', active && 'bg-hover')}>
      {/* the photo opens their profile card; the rest of the row opens the chat */}
      <button onClick={() => showProfile(chat.peer)} aria-label={`${name}’s profile`} className="absolute top-1/2 left-3 z-10 -translate-y-1/2 rounded-full">
        <Avatar u={chat.peer} name={name} size={50} online={online} className="priv" />
      </button>
      <button onClick={() => openChat(chat.peer)} className="flex w-full items-center gap-3 py-2.5 pr-3 pl-[74px] text-left">
        <span className="priv min-w-0 flex-1 border-b border-line/0 py-0.5">
          <span className="flex items-center gap-2">
            <span className="flex-1 truncate font-medium">{name}</span>
            <span className={cn('shrink-0 text-xs', chat.unread && !muted ? 'font-semibold text-accent-ink' : 'text-muted')}>
              {chat.ts ? fmtListTime(chat.ts) : ''}
            </span>
          </span>
          <span className="mt-0.5 flex items-center gap-2">
            <span className="flex-1 truncate text-sm text-muted">{line}</span>
            {muted && <BellOff className="size-4 shrink-0 text-muted" aria-label="Muted" />}
            {chat.unread > 0 && (
              <span className={cn('grid min-w-5 place-items-center rounded-full px-1.5 text-xs leading-5 font-semibold text-white', muted ? 'bg-muted' : 'bg-accent')}>
                {chat.unread}
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}
