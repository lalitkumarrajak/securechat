// A chat's photos full screen, like WhatsApp: swipe (or ← →) through every photo in the chat,
// newer and older, with who sent it, when, and its caption.
import { useEffect, useState } from 'react';
import * as D from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import { Spinner } from '../../components/ui/button';
import { senderOf } from '../../lib/controls';
import { findMessage, photoKeys } from '../../lib/engine';
import { savePhotos } from '../../lib/files';
import { fmtClock, fmtDay } from '../../lib/format';
import { useSwipe } from '../../lib/swipe';
import { displayName, groupIdOf, isGroup, type Msg } from '../../lib/types';
import { useApp } from '../../state/app';
import { setChatUi, useChatUi } from './chatUi';
import { useMemberName } from './MessageBubble';

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

function Gallery({ peer, start }: { peer: string; start: string }) {
  const [keys, setKeys] = useState<string[]>([start]);
  const [i, setI] = useState(0);
  const [msgs, setMsgs] = useState<Record<string, Msg>>({});
  useEffect(() => {
    photoKeys(peer).then((ks) => {
      const at = ks.indexOf(start);
      if (at >= 0) { setKeys(ks); setI(at); }
    });
  }, [peer, start]);

  // Only this photo and its neighbours are kept in memory.
  useEffect(() => {
    const near = keys.slice(Math.max(0, i - 2), i + 3);
    for (const k of near) if (!msgs[k]) findMessage(k).then((m) => m && setMsgs((x) => ({ ...x, [k]: m })));
    setMsgs((x) => Object.fromEntries(Object.entries(x).filter(([k]) => near.includes(k))));
  }, [i, keys]);

  const prev = i > 0 ? () => setI(i - 1) : null;
  const next = i < keys.length - 1 ? () => setI(i + 1) : null;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev?.();
      if (e.key === 'ArrowRight') next?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const { dx, dragging, handlers } = useSwipe(prev, next);

  const cur = msgs[keys[i]];
  const group = useApp((s) => (isGroup(peer) ? s.groups[groupIdOf(peer)] : undefined));
  const friend = useApp((s) => s.friends[peer]);
  const memberName = useMemberName();
  const who = !cur ? '' : cur.out ? 'You' : group ? memberName(senderOf(cur), group) : displayName(friend, peer);

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-2 px-2">
        <D.Close className="grid size-10 place-items-center rounded-full hover:bg-white/15" aria-label="Close"><X className="size-5" /></D.Close>
        <span className="min-w-0 flex-1">
          <D.Title className="block truncate font-semibold">{who || 'Photo'}</D.Title>
          {cur && <span className="block truncate text-xs text-white/70">{fmtDay(cur.ts)}, {fmtClock(cur.ts)}</span>}
        </span>
        {keys.length > 1 && <span className="px-2 text-sm text-white/80 tabular-nums" aria-live="polite">{i + 1} of {keys.length}</span>}
        {cur?.src && (
          <button onClick={() => savePhotos([{ src: cur.src!, ts: cur.ts }])} aria-label="Save photo" className="grid size-10 place-items-center rounded-full hover:bg-white/15">
            <Download className="size-5" />
          </button>
        )}
      </header>

      <div className="relative min-h-0 flex-1 touch-none overflow-hidden select-none" {...handlers}>
        {/* the previous, current and next photo side by side; the strip follows your finger */}
        <div className={`flex h-full ${dragging ? '' : 'transition-transform duration-200 ease-out'}`}
          style={{ transform: `translateX(calc(${-100 * i}% + ${dx}px))` }}>
          {keys.map((k, n) => (
            <div key={k} className="grid h-full w-full shrink-0 place-items-center p-2" aria-hidden={n !== i}>
              {Math.abs(n - i) <= 2 && (msgs[k]
                ? <img src={msgs[k].src} alt={n === i ? `Photo ${i + 1} of ${keys.length}` : ''} draggable={false} className="max-h-full max-w-full object-contain" />
                : <Spinner className="size-8" />)}
            </div>
          ))}
        </div>
        {prev && (
          <button onClick={prev} aria-label="Previous photo" className="absolute top-1/2 left-3 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 hover:bg-white/25 md:grid">
            <ChevronLeft className="size-6" />
          </button>
        )}
        {next && (
          <button onClick={next} aria-label="Next photo" className="absolute top-1/2 right-3 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 hover:bg-white/25 md:grid">
            <ChevronRight className="size-6" />
          </button>
        )}
      </div>

      <footer className="min-h-12 shrink-0 px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center">
        {cur?.text && <p className="mx-auto line-clamp-4 max-w-xl whitespace-pre-wrap [overflow-wrap:anywhere]">{cur.text}</p>}
      </footer>
    </>
  );
}

