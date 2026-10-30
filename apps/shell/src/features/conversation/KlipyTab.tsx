import { useState } from 'react';
import type { GifItem } from '../../lib/types';
import { SearchBox } from './SearchBox';
import { KlipyResults } from './KlipyResults';

export function KlipyTab({ kind, onPick }: { kind: 'gifs' | 'stickers'; onPick: (g: GifItem) => void }) {
  const [q, setQ] = useState('');
  return (
    <div className="py-2">
      <div className="px-3 pb-2"><SearchBox value={q} onChange={setQ} /></div>
      <KlipyResults kind={kind} q={q} onPick={onPick} />
    </div>
  );
}
