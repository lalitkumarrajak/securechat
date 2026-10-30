import { MessageCircle, Shield, ShieldOff, UserMinus } from 'lucide-react';
import { Avatar } from '../../../components/Avatar';
import { confirm } from '@sanga/ui/confirm';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@sanga/ui/menu';
import { openChat } from '../../../lib/engine';
import { removeMember, setAdmin } from '../../../lib/groups';
import { type Group, type GroupMember } from '../../../lib/types';
import { setApp } from '../../../state/app';
import { fail } from './fail';

export function MemberRow({ g, m, name, isMe, friend }: { g: Group; m: GroupMember; name: string; isMe: boolean; friend: boolean }) {
  const row = (
    <span className="flex w-full items-center gap-3 px-6 py-2.5 text-left">
      <Avatar u={m.u} name={m.n} size={42} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{name}</span>
        <span className="block truncate text-sm text-muted">@{m.u}</span>
      </span>
      {m.admin && <span className="rounded-md bg-accent/12 px-2 py-0.5 text-xs font-medium text-accent-ink">Group admin</span>}
    </span>
  );
  if (isMe || (!g.admin && !friend)) return row;
  return (
    <Menu>
      <MenuTrigger asChild><button className="block w-full hover:bg-hover" aria-label={`Options for ${name}`}>{row}</button></MenuTrigger>
      <MenuContent align="end">
        {friend && <MenuItem icon={<MessageCircle />} onSelect={() => { setApp({ panel: null }); openChat(m.u); }}>Message {name}</MenuItem>}
        {g.admin && (m.admin
          ? <MenuItem icon={<ShieldOff />} onSelect={() => setAdmin(g.id, m.u, false).catch(fail)}>Dismiss as admin</MenuItem>
          : <MenuItem icon={<Shield />} onSelect={() => setAdmin(g.id, m.u, true).catch(fail)}>Make group admin</MenuItem>)}
        {g.admin && (
          <MenuItem icon={<UserMinus />} danger onSelect={async () => {
            if (await confirm({ title: `Remove ${name}?`, description: 'They won’t be able to read new messages in this group.', confirmText: 'Remove', destructive: true })) {
              removeMember(g.id, m.u).catch(fail);
            }
          }}>Remove {name}</MenuItem>
        )}
      </MenuContent>
    </Menu>
  );
}
