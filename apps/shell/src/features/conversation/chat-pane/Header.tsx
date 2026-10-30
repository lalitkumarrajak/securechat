import { isGroup } from '../../../lib/types';
import { GroupHeader } from './GroupHeader';
import { PersonHeader } from './PersonHeader';

export function Header({ peer, name }: { peer: string; name: string }) {
  if (isGroup(peer)) return <GroupHeader peer={peer} name={name} />;
  return <PersonHeader peer={peer} name={name} />;
}
