import * as D from '@radix-ui/react-dialog';
import { Gamepad2, Info, MessageCircle } from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import { openChat } from '../../lib/engine';
import { fmtLastSeen } from '@sanga/ui/format';
import { displayName, groupIdOf, isGroup } from '../../lib/types';
import { setApp, useApp } from '../../state/app';
import { setChatUi } from '../conversation/chatUi';
import { openPicker } from '../games/store';
import { CardButton } from './CardButton';

export function Card({ u, close }: { u: string; close: () => void }) {
  const friend = useApp((s) => s.friends[u]);
  const group = useApp((s) => (isGroup(u) ? s.groups[groupIdOf(u)] : undefined));
  const photo = useApp((s) => s.avatars[u]);
  const presence = useApp((s) => s.presence[u]);
  const name = group ? group.name : displayName(friend, u);
  const status = group ? `Group · ${group.members.length} members` : presence?.on ? 'online' : presence?.ls ? fmtLastSeen(presence.ls) : '';
  const about = group ? group.about : friend?.about;

  const message = () => { close(); openChat(u); };
  const info = () => { close(); openChat(u); setApp({ panel: group ? 'group' : 'contact' }); };

  return (
    <>
      <button onClick={() => photo && setChatUi({ viewer: photo })} aria-label={photo ? `View ${name}’s photo` : name}
        className="relative block aspect-square w-full bg-panel-2">
        {photo ? <img src={photo} alt="" className="size-full object-cover" />
          : <span className="grid size-full place-items-center"><Avatar u={u} name={name} size={160} /></span>}
        <span className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/55 to-transparent px-4 pt-3 pb-8 text-left text-white">
          <D.Title className="truncate text-lg font-semibold">{name}</D.Title>
          <D.Description className="truncate text-sm text-white/85">{group ? status : '@' + u}</D.Description>
        </span>
      </button>
      {(about || (!group && status)) && (
        <div className="border-b border-line px-4 py-3 text-sm">
          {!group && status && <p className="text-accent-ink">{status}</p>}
          {about && <p className="line-clamp-3 whitespace-pre-wrap text-muted">{about}</p>}
        </div>
      )}
      <div className="flex justify-around py-1.5 text-accent-ink [&_svg]:size-5">
        <CardButton label="Message" onClick={message}><MessageCircle /></CardButton>
        {!group && friend && <CardButton label="Play" onClick={() => { close(); openPicker([u]); }}><Gamepad2 /></CardButton>}
        <CardButton label="Info" onClick={info}><Info /></CardButton>
      </div>
    </>
  );
}
