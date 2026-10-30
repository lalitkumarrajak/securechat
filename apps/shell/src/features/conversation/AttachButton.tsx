import { useRef } from 'react';
import * as M from '@radix-ui/react-dropdown-menu';
import { Camera, FileText, Image as ImageIcon, MapPin, Paperclip } from 'lucide-react';
import { IconButton } from '@sanga/ui/button';

const ITEM = 'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm outline-none data-[highlighted]:bg-hover';

export function AttachButton({ onPhotos, onDocuments, onLocation }: {
  onPhotos: (f: File[]) => void; onDocuments: (f: File[]) => void; onLocation: () => void;
}) {
  const gallery = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const doc = useRef<HTMLInputElement>(null);
  const pick = (el: HTMLInputElement | null) => el?.click();
  const icon = (bg: string, node: React.ReactNode) => <span className={`grid size-9 place-items-center rounded-full text-white ${bg}`}>{node}</span>;
  return (
    <>
      <M.Root modal={false}>
        <M.Trigger asChild><IconButton label="Attach" className="shrink-0"><Paperclip /></IconButton></M.Trigger>
        <M.Portal>
          <M.Content side="top" align="end" sideOffset={8} className="z-50 w-52 rounded-xl border border-line bg-panel p-1 shadow-xl animate-fade-in">
            <M.Item onSelect={() => pick(doc.current)} className={ITEM}>{icon('bg-indigo-500', <FileText className="size-4" />)} Document</M.Item>
            <M.Item onSelect={() => pick(gallery.current)} className={ITEM}>{icon('bg-violet-500', <ImageIcon className="size-4" />)} Photos</M.Item>
            <M.Item onSelect={() => pick(camera.current)} className={ITEM}>{icon('bg-pink-500', <Camera className="size-4" />)} Camera</M.Item>
            <M.Item onSelect={onLocation} className={ITEM}>{icon('bg-emerald-500', <MapPin className="size-4" />)} Location</M.Item>
          </M.Content>
        </M.Portal>
      </M.Root>
      <input ref={gallery} type="file" data-kind="gallery" accept="image/*" multiple hidden onChange={(e) => { onPhotos([...(e.target.files || [])]); e.target.value = ''; }} />
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { onPhotos([...(e.target.files || [])]); e.target.value = ''; }} />
      <input ref={doc} type="file" data-kind="document" multiple hidden onChange={(e) => { onDocuments([...(e.target.files || [])]); e.target.value = ''; }} />
    </>
  );
}
