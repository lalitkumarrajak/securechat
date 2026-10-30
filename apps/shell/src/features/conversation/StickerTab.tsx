import { useState } from 'react';
import { NOTO_STICKERS } from '../../lib/emoji';
import type { GifItem } from '../../lib/types';
import { useApp } from '../../state/app';
import { recent } from './expressionPanel';
import { SearchBox } from './SearchBox';
import { KlipyResults } from './KlipyResults';

export function StickerTab({ onPick }: { onPick: (s: string | GifItem) => void }) {
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
