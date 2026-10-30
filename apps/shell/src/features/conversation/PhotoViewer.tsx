import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { setChatUi, useChatUi } from './chatUi';

/** Full-screen photo (chat photos, profile photos). Rendered once, in the Shell. */
export function PhotoViewer() {
  const src = useChatUi((s) => s.viewer);
  return (
    <D.Root open={!!src} onOpenChange={(o) => !o && setChatUi({ viewer: null })}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/90 animate-fade-in" />
        <D.Content className="fixed inset-0 z-50 grid place-items-center p-4 outline-none" onClick={() => setChatUi({ viewer: null })}>
          <D.Title className="sr-only">Photo</D.Title>
          <D.Description className="sr-only">Full-size photo</D.Description>
          {src && <img src={src} alt="" className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />}
          <D.Close className="absolute top-4 right-4 grid size-10 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25" aria-label="Close">
            <X className="size-5" />
          </D.Close>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
