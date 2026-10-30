import type { Group } from '../../lib/types';
import { useApp } from '../../state/app';

/** Display name of a group member (or friend) as I know them. */
export function useMemberName() {
  const friends = useApp((s) => s.friends);
  return (u: string, g?: Group, me?: string) => (u === me ? 'You' : friends[u]?.name || g?.members.find((x) => x.u === u)?.n || u);
}
