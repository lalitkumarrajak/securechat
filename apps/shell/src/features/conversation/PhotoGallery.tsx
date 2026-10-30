// A chat's photos full screen, like WhatsApp: swipe (or ← →) through every photo in the chat,
// newer and older, with who sent it, when, and its caption.
import * as D from '@radix-ui/react-dialog';
import { setChatUi, useChatUi } from './chatUi';
import { Gallery } from './Gallery';

export function PhotoGallery() {
  const g = useChatUi((s) => s.gallery);
  return (
    <D.Root open={!!g} onOpenChange={(o) => !o && setChatUi({ gallery: null })}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black animate-fade-in" />
        <D.Content className="fixed inset-0 z-50 flex flex-col bg-black text-white outline-none" aria-describedby={undefined}>
          {g && <Gallery key={g.peer + g.k} peer={g.peer} start={g.k} />}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
