// New group: tick friends, then give it a name (and optionally a photo and description).
import { Panel } from '@sanga/ui/dialog';
import { setApp, useApp } from '../../state/app';
import { NewGroup } from './NewGroup';
import { t } from '@sanga/i18n';

export function NewGroupPanel() {
  const open = useApp((s) => s.panel === 'newgroup');
  return (
    <Panel open={open} onOpenChange={(o) => !o && setApp({ panel: null })} title={t('New group')}>
      {open && <NewGroup />}
    </Panel>
  );
}
