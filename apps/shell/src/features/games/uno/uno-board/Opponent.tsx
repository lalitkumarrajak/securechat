import { Avatar } from '../../../../components/Avatar';
import { cn } from '@sanga/ui/utils';
import type { Game } from '../../store';
import { TurnRing } from '../../TurnRing';
import { Chances } from '../../Chances';
import { UnoView } from './types';
import { CardBack } from './CardBack';

export function Opponent({ g, j, me, bubble, onCatch }: { g: Game<UnoView>; j: number; me: number; bubble: string | null; onCatch: () => void }) {
  const pl = g.players[j];
  const s = g.s;
  const count = s.counts[j] ?? 0;
  const active = g.status === 'play' && g.turn === j;
  const gone = pl.state === 'left' || pl.state === 'out';
  return (
    <div className={cn('relative flex w-[76px] shrink-0 flex-col items-center gap-1 rounded-2xl border-2 bg-black/25 px-1 py-1.5', active ? 'border-white' : 'border-transparent', gone && 'opacity-40')}
      data-player={pl.u}>
      <TurnRing active={active} deadline={g.deadline} color="#fff">
        <div className="rounded-xl bg-white p-0.5"><Avatar u={pl.u} name={pl.n} size={34} className="[&>*]:rounded-lg" /></div>
      </TurnRing>
      <div className="w-full truncate text-center text-[11px] font-semibold text-white">{pl.n || pl.u}</div>
      <div className="relative h-7 w-full">
        {Array.from({ length: Math.min(count, 7) }, (_, k) => (
          <span key={k} className="absolute top-0" style={{ left: `calc(50% - 9px + ${(k - Math.min(count, 7) / 2 + 0.5) * 6}px)`, rotate: `${(k - 3) * 5}deg` }}>
            <CardBack size="xs" />
          </span>
        ))}
        <span className="absolute -right-1 -bottom-1 grid min-w-5 place-items-center rounded-full bg-white px-1 text-[11px] font-bold text-slate-900 shadow" aria-label={`${count} cards`}>{count}</span>
      </div>
      {pl.rank ? <span className="text-[10px] font-semibold text-amber-300">{pl.rank === 1 ? 'Winner!' : `#${pl.rank}`}</span>
        : s.uno === j && j !== me ? (
          <button type="button" onClick={onCatch} className="uno-pulse rounded-full bg-yellow-300 px-2 py-0.5 text-[11px] font-black text-red-700 shadow" aria-label={`Catch ${pl.n}: they didn't say UNO`}>Catch!</button>
        ) : count === 1 ? <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black text-yellow-300 italic">UNO</span>
        : pl.state === 'playing' && !pl.bot ? <Chances missed={pl.missed || 0} /> : null}
      {bubble && (
        <div className="ludo-bubble absolute top-full z-20 mt-1 max-w-[150px] rounded-2xl bg-white px-3 py-1.5 text-sm font-medium text-slate-900 shadow-lg">{bubble}</div>
      )}
    </div>
  );
}
