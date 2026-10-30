import { cn } from '@sanga/ui/utils';
import { card } from '@sanga/game-rules/uno.js';
import { describe } from './helpers';
import { UnoCard } from './UnoCard';

// My cards, fanned; the ones I can play now are lifted.
export function CardsInHand({ cards, playable, drawn, onPlay }: { cards: number[]; playable: (id: number) => boolean; drawn: number | null; onPlay: (id: number) => void }) {
  const sorted = [...cards].sort((a, b) => order(a) - order(b));
  const overlap = sorted.length > 7 ? Math.min(40, 64 - 300 / sorted.length) : 18;
  return (
    <div className="flex justify-center overflow-x-auto px-4 pt-4 pb-1" role="list" aria-label="Your cards">
      {sorted.map((id, k) => {
        const ok = playable(id);
        return (
          <button key={id} type="button" role="listitem" onClick={() => onPlay(id)} disabled={!ok}
            aria-label={`${describe(id, card(id).c)}${ok ? ', playable' : ''}`}
            className={cn('shrink-0 transition-transform duration-200 disabled:cursor-default', ok ? '-translate-y-3 hover:-translate-y-5' : 'brightness-75', id === drawn && 'ring-4 ring-yellow-300 rounded-xl')}
            style={{ marginLeft: k ? -overlap : 0, zIndex: k }}>
            <UnoCard id={id} size="md" />
          </button>
        );
      })}
    </div>
  );
}

export const order = (id: number) => { const k = card(id); return 'rygbw'.indexOf(k.c) * 100 + (/\d/.test(k.v) ? +k.v : { skip: 10, rev: 11, d2: 12, wild: 13, w4: 14 }[k.v as 'skip']); };
