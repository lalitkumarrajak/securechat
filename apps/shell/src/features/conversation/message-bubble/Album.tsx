import { type Msg } from '../../../lib/types';
import { cn } from '@sanga/ui/utils';
import { openGallery } from '../chatUi';
import { Marked } from './Marked';

/** Photos sent together: a grid of up to four, the last showing "+N" for the rest, like WhatsApp. */
export function Album({ album }: { album: Msg[] }) {
  const shown = album.slice(0, 4);
  const more = album.length - shown.length;
  const caption = album.findLast((x) => x.text)?.text;
  return (
    <>
      <div className={cn('grid w-[min(280px,68vw)] gap-1', shown.length > 1 && 'grid-cols-2')} role="group" aria-label={`${album.length} photos`}>
        {shown.map((x, n) => (
          <button key={x.k} onClick={(e) => { e.stopPropagation(); openGallery(x); }} aria-label={`View photo ${n + 1} of ${album.length}`}
            className={cn('relative block aspect-square overflow-hidden rounded-xl bg-panel-2', shown.length === 3 && n === 0 && 'col-span-2 aspect-[2/1]')}>
            <img src={x.src} alt="Photo" loading="lazy" className="size-full object-cover" />
            {more > 0 && n === 3 && <span className="absolute inset-0 grid place-items-center bg-black/50 text-2xl font-semibold text-white">+{more}</span>}
          </button>
        ))}
      </div>
      {caption && <p className="px-1.5 pt-1 whitespace-pre-wrap [overflow-wrap:anywhere]"><Marked text={caption} /></p>}
    </>
  );
}
