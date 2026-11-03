import { Panel } from '@sanga/ui/dialog';
import { setApp, useApp } from '../../state/app';
import { Contact } from './Contact';
import { t } from '@sanga/i18n';

export function ContactPanel() {
  const open = useApp((s) => s.panel === 'contact');
  const peer = useApp((s) => s.active);
  return (
    <Panel open={open && !!peer} onOpenChange={(o) => !o && setApp({ panel: null })} title={t('Contact info')} side="right">
      {peer && <Contact peer={peer} />}
    </Panel>
  );
}
