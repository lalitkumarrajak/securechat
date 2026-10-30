import { useEffect, useRef, useState } from 'react';
import { Spinner } from '@sanga/ui/button';
import { searchGifs } from '../../lib/engine';
import type { GifItem } from '../../lib/types';
import { cn } from '@sanga/ui/utils';

/** Trending (empty query) or search results, two columns, loading more as you scroll. */
export function KlipyResults({ kind, q, onPick }: { kind: 'gifs' | 'stickers'; q: string; onPick: (g: GifItem) => void }) {
  const [items, setItems] = useState<GifItem[]>([]);
  const [next, setNext] = useState<number | null>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const sentinel = useRef<HTMLDivElement>(null);
  const query = useRef('');

  useEffect(() => {
    const t = setTimeout(() => { query.current = q.trim(); setItems([]); setNext(1); setError(''); load(1, q.trim()); }, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [q, kind]); // new search when the query changes

  async function load(page: number, term: string) {
    setLoading(true);
    try {
      const r = await searchGifs(kind, term, page);
      if (query.current !== term) return; // a newer search started
      setItems((old) => (page === 1 ? r.items : [...old, ...r.items]));
      setNext(r.next);
    } catch (e) { setError((e as Error).message); setNext(null); }
    setLoading(false);
  }

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && !loading && next && next > 1) load(next, query.current); });
    io.observe(el);
    return () => io.disconnect();
  }, [loading, next]);

  if (error) return <p className="px-4 py-8 text-center text-sm text-muted">{error}</p>;
  const sticker = kind === 'stickers';
  return (
    <>
      <div className={cn('gap-1.5 px-2', sticker ? 'grid grid-cols-4' : 'columns-2')}>
        {items.map((g) => (
          <button key={g.id} onClick={() => onPick(g)} title={g.title}
            className={cn('mb-1.5 block w-full overflow-hidden rounded-lg bg-panel-2 transition active:scale-95', sticker && 'aspect-square bg-transparent')}>
            <img src={g.thumb} alt={g.title || (sticker ? 'Sticker' : 'GIF')} loading="lazy" referrerPolicy="no-referrer"
              className={cn('block w-full', sticker ? 'h-full object-contain' : 'h-auto')}
              style={!sticker && g.w && g.h ? { aspectRatio: `${g.w} / ${g.h}` } : undefined} />
          </button>
        ))}
      </div>
      {!loading && !items.length && <p className="px-4 py-8 text-center text-sm text-muted">{q ? 'Nothing found.' : 'Nothing here yet.'}</p>}
      <div ref={sentinel} className="h-8" />
      {loading && <div className="grid place-items-center pb-4 text-accent"><Spinner className="size-5" /></div>}
      {!sticker && <p className="pb-3 text-center text-[11px] text-muted">Powered by KLIPY</p>}
    </>
  );
}
