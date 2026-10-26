// Review photos before sending, like WhatsApp: a big preview, thumbnails to switch between,
// remove or add more, and a caption for each photo.
import { useEffect, useRef, useState } from 'react';
import * as D from '@radix-ui/react-dialog';
import { Plus, SendHorizontal, X } from 'lucide-react';
import { Spinner } from '../../components/ui/button';
import { readablePhoto } from '../../lib/image';
import { cn } from '../../lib/utils';

export const MAX_PHOTOS = 30;

export interface PhotoItem { id: number; file: File; caption: string }
let nextId = 1;
export const toItems = (files: File[]): PhotoItem[] => files.map((file) => ({ id: nextId++, file, caption: '' }));

export function SendPhotos({ items, to, onChange, onSend, onClose }: {
  items: PhotoItem[]; to: string;
  onChange: (items: PhotoItem[]) => void; onSend: (items: PhotoItem[]) => void; onClose: () => void;
}) {
  const [current, setCurrent] = useState(0);
  const more = useRef<HTMLInputElement>(null);
  const i = Math.min(current, items.length - 1);
  const cur = items[i];
  const urls = usePreviews(items);

  const remove = (id: number) => {
    const rest = items.filter((x) => x.id !== id);
    if (!rest.length) return onClose();
    onChange(rest);
  };
  const caption = (v: string) => onChange(items.map((x) => (x.id === cur.id ? { ...x, caption: v } : x)));

  return (
    <D.Root open onOpenChange={(o) => !o && onClose()}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black animate-fade-in" />
        <D.Content className="fixed inset-0 z-50 flex flex-col bg-black text-white outline-none">
          <header className="flex h-14 shrink-0 items-center gap-2 px-2">
            <D.Close className="grid size-10 place-items-center rounded-full hover:bg-white/15" aria-label="Cancel"><X className="size-5" /></D.Close>
            <D.Title className="min-w-0 flex-1 truncate font-semibold">{items.length > 1 ? `${items.length} photos` : 'Photo'} to {to}</D.Title>
            <D.Description className="sr-only">Check your photos, add captions, then send</D.Description>
            {items.length > 1 && (
              <button onClick={() => remove(cur.id)} className="rounded-full px-3 py-1.5 text-sm hover:bg-white/15">Remove</button>
            )}
          </header>

          <div className="grid min-h-0 flex-1 place-items-center p-2">
            {urls[cur.id] ? <img src={urls[cur.id]} alt={`Photo ${i + 1} of ${items.length}`} className="max-h-full max-w-full object-contain" />
              : <Spinner className="size-8" />}
          </div>

          <div className="shrink-0 space-y-3 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Photos">
              {items.map((x, n) => (
                <div key={x.id} className="relative shrink-0">
                  <button onClick={() => setCurrent(n)} aria-label={`Photo ${n + 1}`} aria-current={n === i}
                    className={cn('block size-14 overflow-hidden rounded-lg border-2 bg-white/10', n === i ? 'border-[var(--accent)]' : 'border-transparent opacity-70')}>
                    {urls[x.id] && <img src={urls[x.id]} alt="" className="size-full object-cover" />}
                  </button>
                  <button onClick={() => remove(x.id)} aria-label={`Remove photo ${n + 1}`}
                    className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-black/80 ring-1 ring-white/40"><X className="size-3" /></button>
                </div>
              ))}
              {items.length < MAX_PHOTOS && (
                <button onClick={() => more.current?.click()} aria-label="Add more photos"
                  className="grid size-14 shrink-0 place-items-center rounded-lg border-2 border-dashed border-white/40 hover:bg-white/10"><Plus className="size-6" /></button>
              )}
              <input ref={more} type="file" accept="image/*" multiple hidden onChange={(e) => {
                const files = [...(e.target.files || [])]; e.target.value = '';
                if (files.length) { onChange([...items, ...toItems(files)].slice(0, MAX_PHOTOS)); setCurrent(items.length); }
              }} />
            </div>
            <div className="flex items-end gap-2">
              <input value={cur.caption} onChange={(e) => caption(e.target.value)} maxLength={2000} placeholder="Add a caption…" aria-label="Caption"
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); onSend(items); } }}
                className="h-11 min-w-0 flex-1 rounded-full bg-white/12 px-4 text-[0.95rem] outline-none placeholder:text-white/55 focus:ring-2 focus:ring-white/30" />
              <button onClick={() => onSend(items)} aria-label={items.length > 1 ? `Send ${items.length} photos` : 'Send photo'}
                className="relative grid size-11 shrink-0 place-items-center rounded-full bg-accent text-white shadow-sm active:scale-95">
                <SendHorizontal className="size-5" />
                {items.length > 1 && <span className="absolute -top-1.5 -right-1 grid min-w-5 place-items-center rounded-full bg-white px-1 text-xs leading-5 font-bold text-black">{items.length}</span>}
              </button>
            </div>
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/** Object URLs for the thumbnails; HEIC photos are converted first so they show. */
function usePreviews(items: PhotoItem[]) {
  const [urls, setUrls] = useState<Record<number, string>>({});
  const made = useRef(new Map<number, string>());
  const mounted = useRef(true);
  useEffect(() => {
    (async () => {
      for (const x of items) {
        if (made.current.has(x.id)) continue;
        made.current.set(x.id, '');
        let url = '';
        try { url = URL.createObjectURL(await readablePhoto(x.file)); } catch { continue; }
        made.current.set(x.id, url);
        if (mounted.current) setUrls((u) => ({ ...u, [x.id]: url }));
      }
    })();
  }, [items]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      for (const u of made.current.values()) if (u) URL.revokeObjectURL(u);
      made.current.clear();
    };
  }, []);
  return urls;
}
