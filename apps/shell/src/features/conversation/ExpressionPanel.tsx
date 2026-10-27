// The panel under the message box (where the keyboard is), like WhatsApp: Emoji | GIFs | Stickers.
import { useEffect, useRef, useState } from 'react';
import { Delete, Search, Smile, Sticker } from 'lucide-react';
import { Spinner } from '@sanga/ui/button';
import { EMOJI_PICKER, NOTO_STICKERS } from '../../lib/emoji';
import { searchGifs } from '../../lib/engine';
import type { GifItem } from '../../lib/types';
import { cn } from '@sanga/ui/utils';
import { useApp } from '../../state/app';

export type PanelTab = 'emoji' | 'gifs' | 'stickers';

// Recently used emoji and stickers, kept on this device.
function recent(key: string): string[] {
  try { return JSON.parse(localStorage.getItem('chattrix-recent-' + key) || '[]'); } catch { return []; }
}
function remember(key: string, v: string) {
  try { localStorage.setItem('chattrix-recent-' + key, JSON.stringify([v, ...recent(key).filter((x) => x !== v)].slice(0, 24))); } catch { /* storage unavailable */ }
}

export function ExpressionPanel({ tab, setTab, onEmoji, onBackspace, onGif, onSticker }: {
  tab: PanelTab; setTab: (t: PanelTab) => void;
  onEmoji: (e: string) => void; onBackspace: () => void;
  onGif: (g: GifItem) => void; onSticker: (s: string | GifItem) => void;
}) {
  const gifs = useApp((s) => s.gifsEnabled);
  return (
    <div className="flex h-[300px] shrink-0 flex-col border-t border-line bg-panel" role="dialog" aria-label="Emoji, GIFs and stickers">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'emoji' && <EmojiTab onPick={(e) => { remember('emoji', e); onEmoji(e); }} />}
        {tab === 'gifs' && <KlipyTab kind="gifs" onPick={onGif} />}
        {tab === 'stickers' && <StickerTab onPick={(s) => { if (typeof s === 'string') remember('sticker', s); onSticker(s); }} />}
      </div>
      <div className="flex items-center gap-1 border-t border-line px-2 py-1">
        <TabButton active={tab === 'emoji'} onClick={() => setTab('emoji')} label="Emoji"><Smile className="size-5" /></TabButton>
        {gifs && <TabButton active={tab === 'gifs'} onClick={() => setTab('gifs')} label="GIFs"><span className="text-xs font-bold">GIF</span></TabButton>}
        <TabButton active={tab === 'stickers'} onClick={() => setTab('stickers')} label="Stickers"><Sticker className="size-5" /></TabButton>
        <span className="flex-1" />
        {tab === 'emoji' && (
          <button onClick={onBackspace} aria-label="Delete" className="grid size-10 place-items-center rounded-full text-muted hover:bg-hover"><Delete className="size-5" /></button>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} aria-pressed={active}
      className={cn('grid h-9 min-w-12 place-items-center rounded-full px-3 transition', active ? 'bg-accent/15 text-accent-ink' : 'text-muted hover:bg-hover')}>
      {children}
    </button>
  );
}

function EmojiTab({ onPick }: { onPick: (e: string) => void }) {
  const rec = recent('emoji');
  const grid = (list: string[]) => (
    <div className="grid grid-cols-8 gap-0.5 px-2 sm:grid-cols-10">
      {list.map((e, i) => (
        <button key={i + e} onClick={() => onPick(e)} className="grid aspect-square place-items-center rounded-lg text-[1.65rem] hover:bg-hover active:scale-90">{e}</button>
      ))}
    </div>
  );
  return (
    <div className="py-2">
      {rec.length > 0 && <><h3 className="px-4 pb-1 text-xs font-semibold text-muted">Recent</h3>{grid(rec)}</>}
      <h3 className="px-4 pt-2 pb-1 text-xs font-semibold text-muted">Smileys & more</h3>
      {grid(EMOJI_PICKER)}
    </div>
  );
}

function StickerTab({ onPick }: { onPick: (s: string | GifItem) => void }) {
  const gifs = useApp((s) => s.gifsEnabled);
  const rec = recent('sticker');
  const [q, setQ] = useState('');
  const grid = (list: string[]) => (
    <div className="grid grid-cols-5 gap-1 px-2 sm:grid-cols-7">
      {list.map((e, i) => (
        <button key={i + e} onClick={() => onPick(e)} aria-label={'Sticker ' + e}
          className="grid aspect-square place-items-center rounded-xl text-[2.6rem] hover:bg-hover active:scale-90">{e}</button>
      ))}
    </div>
  );
  return (
    <div className="py-2">
      {gifs && <div className="px-3 pb-2"><SearchBox value={q} onChange={setQ} /></div>}
      {q.trim() ? <KlipyResults kind="stickers" q={q} onPick={onPick} /> : (
        <>
          {rec.length > 0 && <><h3 className="px-4 pb-1 text-xs font-semibold text-muted">Recent</h3>{grid(rec)}</>}
          <h3 className="px-4 pt-2 pb-1 text-xs font-semibold text-muted">Animated</h3>
          {grid(NOTO_STICKERS)}
          {gifs && <><h3 className="px-4 pt-3 pb-1 text-xs font-semibold text-muted">Trending</h3><KlipyResults kind="stickers" q="" onPick={onPick} /></>}
        </>
      )}
    </div>
  );
}

function KlipyTab({ kind, onPick }: { kind: 'gifs' | 'stickers'; onPick: (g: GifItem) => void }) {
  const [q, setQ] = useState('');
  return (
    <div className="py-2">
      <div className="px-3 pb-2"><SearchBox value={q} onChange={setQ} /></div>
      <KlipyResults kind={kind} q={q} onPick={onPick} />
    </div>
  );
}

// KLIPY's terms require "Search KLIPY" as the search box placeholder.
function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Search KLIPY"
        className="h-9 w-full rounded-full bg-panel-2 pr-3 pl-9 text-sm outline-none placeholder:text-muted focus:ring-2 focus:ring-accent/30" />
    </div>
  );
}

/** Trending (empty query) or search results, two columns, loading more as you scroll. */
function KlipyResults({ kind, q, onPick }: { kind: 'gifs' | 'stickers'; q: string; onPick: (g: GifItem) => void }) {
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
