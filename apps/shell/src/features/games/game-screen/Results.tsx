import { Avatar } from '../../../components/Avatar';
import { Button } from '@sanga/ui/button';
import { useApp } from '../../../state/app';
import { createGame, dismiss, type Game } from '../store';
import { Confetti } from './Confetti';

const MEDALS = ['🥇', '🥈', '🥉'];

export function Results({ g, me }: { g: Game; me: string }) {
  const friends = useApp((s) => s.friends);
  const ranked = [...g.players].sort((a, b) => (a.rank || 99) - (b.rank || 99));
  const mine = g.players.find((p) => p.u === me);
  const cancelled = g.ev.some((e) => e.k === 'cancelled' || e.k === 'expired');
  const again = g.players.filter((p) => p.u !== me && friends[p.u]).map((p) => p.u);
  return (
    <div className="absolute inset-0 z-30 grid place-items-center overflow-hidden bg-black/60 p-5 animate-fade-in">
      {mine?.rank === 1 && !cancelled && <Confetti />}
      <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 text-center text-slate-900 shadow-2xl">
        {cancelled ? (
          <><div className="text-5xl">🕓</div><h2 className="mt-2 text-xl font-bold">Game called off</h2>
            <p className="mt-1 text-sm text-slate-500">Not enough players joined.</p></>
        ) : (
          <>
            <div className="text-5xl">{mine?.rank === 1 ? '🏆' : '🎲'}</div>
            <h2 className="mt-2 text-xl font-bold">{mine?.rank === 1 ? 'You won!' : mine?.rank ? `You came ${mine.rank}${['th', 'st', 'nd', 'rd'][mine.rank] || 'th'}` : 'Game over'}</h2>
            <ol className="mt-4 space-y-2 text-left">
              {ranked.map((p) => (
                <li key={p.u} className="flex items-center gap-3 rounded-xl bg-slate-100 px-3 py-2">
                  <span className="w-7 text-center text-xl">{p.rank ? MEDALS[p.rank - 1] || p.rank : '–'}</span>
                  <Avatar u={p.u} name={p.n} size={32} />
                  <span className="min-w-0 flex-1 truncate font-medium">{p.u === me ? 'You' : p.n || p.u}</span>
                  <span className="text-xs text-slate-500">{p.state === 'left' ? 'left' : p.state === 'out' ? 'removed' : ''}</span>
                </li>
              ))}
            </ol>
          </>
        )}
        <div className="mt-5 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => dismiss(g.id)}>Close</Button>
          {again.length > 0 && <Button className="flex-1" onClick={() => { dismiss(g.id); createGame(g.type, again); }}>Play again</Button>}
        </div>
      </div>
    </div>
  );
}
