// Choose which part of a photo becomes the round profile photo: drag to move it,
// pinch, scroll or use the slider to zoom.
import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { Crop } from '../lib/image';
import { Stage } from './Stage';

export function PhotoCropper({ file, title = 'Move and zoom', onCancel, onDone }: {
  file: File | null; title?: string; onCancel: () => void; onDone: (crop: Crop) => void;
}) {
  return (
    <D.Root open={!!file} onOpenChange={(o) => !o && onCancel()}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/90 animate-fade-in" />
        <D.Content className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 p-4 text-white outline-none">
          <D.Title className="text-lg font-semibold">{title}</D.Title>
          <D.Description className="-mt-4 text-sm text-white/70">Drag to move · pinch or scroll to zoom</D.Description>
          {file && <Stage key={file.name + file.lastModified} file={file} onCancel={onCancel} onDone={onDone} />}
          <D.Close className="absolute top-4 right-4 grid size-10 place-items-center rounded-full bg-white/15 hover:bg-white/25" aria-label="Cancel">
            <X className="size-5" />
          </D.Close>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
