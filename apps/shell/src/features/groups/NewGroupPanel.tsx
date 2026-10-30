// New group: tick friends, then give it a name (and optionally a photo and description).
import { Panel } from '@sanga/ui/dialog';
import { setApp, useApp } from '../../state/app';
import { NewGroup } from './NewGroup';

export function NewGroupPanel() {
  const open = useApp((s) => s.panel === 'newgroup');
  return (
    <Panel open={open} onOpenChange={(o) => !o && setApp({ panel: null })} title="New group">
      {open && <NewGroup />}
    </Panel>
  );
}
