import { Panel } from '@sanga/ui/dialog';
import { setApp, useApp } from '../../state/app';
import { Contact } from './Contact';

export function ContactPanel() {
  const open = useApp((s) => s.panel === 'contact');
  const peer = useApp((s) => s.active);
  return (
    <Panel open={open && !!peer} onOpenChange={(o) => !o && setApp({ panel: null })} title="Contact info" side="right">
      {peer && <Contact peer={peer} />}
    </Panel>
  );
}
