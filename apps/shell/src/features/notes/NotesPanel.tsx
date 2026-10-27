// The diary is a separate app (apps/notes). The shell only gives it a side panel, and loads its code
// the first time it's opened.
import { Panel } from '@sanga/ui/dialog';
import { setApp, useApp } from '../../state/app';
import { AppFrame } from '../apps/AppFrame';

export function NotesPanel() {
  const chat = useApp((s) => s.notesChat);
  const close = () => setApp({ panel: null });
  return (
    <Panel open onOpenChange={(o) => !o && close()} title="Diary and notes">
      <AppFrame id="notes" name="the diary" onClose={close} params={chat === null ? {} : { chat }} />
    </Panel>
  );
}
