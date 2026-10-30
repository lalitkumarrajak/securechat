// Group info: photo, name and description, members and admins, invite link, settings, leave.
import { Panel } from '@sanga/ui/dialog';
import { groupIdOf, isGroup } from '../../lib/types';
import { setApp, useApp } from '../../state/app';
import { Info } from './group-info-panel/Info';

export function GroupInfoPanel() {
  const open = useApp((s) => s.panel === 'group');
  const peer = useApp((s) => s.active);
  const group = useApp((s) => (isGroup(peer) ? s.groups[groupIdOf(peer)] : undefined));
  return (
    <Panel open={open && !!group} onOpenChange={(o) => !o && setApp({ panel: null })} title="Group info" side="right">
      {group && <Info key={group.id} g={group} />}
    </Panel>
  );
}
