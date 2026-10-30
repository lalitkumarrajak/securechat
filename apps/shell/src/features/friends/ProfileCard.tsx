// Tap someone's photo (chat list, friends): their photo, name and about, with quick actions, like WhatsApp.
import * as D from '@radix-ui/react-dialog';
import { setChatUi, useChatUi } from '../conversation/chatUi';
import { Card } from './Card';

export const showProfile = (u: string) => setChatUi({ profile: u });

export function ProfileCard() {
  const u = useChatUi((s) => s.profile);
  const close = () => setChatUi({ profile: null });
  return (
    <D.Root open={!!u} onOpenChange={(o) => !o && close()}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-overlay animate-fade-in" />
        <D.Content className="fixed top-1/2 left-1/2 z-50 w-[min(320px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl bg-panel text-ink shadow-2xl outline-none animate-fade-in">
          {u && <Card u={u} close={close} />}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
