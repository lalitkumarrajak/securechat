// Game invites and games in progress, at the top of the chat list.
import { ChevronRight } from 'lucide-react';
import { myName } from '../../lib/engine';
import { GAME_UI } from './registry';
import { decline, join, listed, meIn, nameOf, openGame, useGames, type Game } from './store';

function status(g: Game) {
  const me = meIn(g);
  if (g.status === 'lobby') {
    if (me?.state === 'invited') return `${nameOf(g, g.host)} invited you`;
    const n = g.players.filter((p) => p.state === 'joined').length;
    return `Waiting for players · ${n} ready`;
  }
  if (g.status === 'over') return me?.rank === 1 ? 'You won! 🏆' : me?.rank ? `You came ${me.rank}` : 'Game over';
  if (me?.state !== 'playing') return me?.rank ? `You finished ${me.rank}` : 'Watching';
  return g.players[g.turn]?.u === myName() ? 'Your turn!' : `${nameOf(g, g.players[g.turn]?.u)}’s turn`;
}

export function GamesStrip() {
  const games = useGames((s) => s.games);
  const unread = useGames((s) => s.unread);
  const items = listed(games);
  if (!items.length) return null;
  return (
    <ul className="border-b border-line" aria-label="Games">
      {items.map((g) => {
        const ui = GAME_UI[g.type];
        const others = g.players.filter((p) => p.u !== myName() && p.state !== 'declined').map((p) => p.n || p.u);
        const invited = g.status === 'lobby' && meIn(g)?.state === 'invited';
        const yourTurn = g.status === 'play' && g.players[g.turn]?.u === myName();
        return (
          <li key={g.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-hover">
            <button type="button" onClick={() => openGame(g.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl text-2xl" style={{ background: ui?.background }} aria-hidden>{ui?.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{ui?.name || 'Game'}{others.length ? ` with ${others.join(', ')}` : ''}</span>
                <span className={yourTurn || invited ? 'block truncate text-sm font-semibold text-accent' : 'block truncate text-sm text-muted'}>{status(g)}</span>
              </span>
              {unread[g.id] ? <span className="grid min-w-5 place-items-center rounded-full bg-accent px-1.5 text-xs font-bold text-accent-ink">{unread[g.id]}</span> : null}
            </button>
            {invited ? (
              <span className="flex gap-1.5">
                <button type="button" onClick={() => decline(g.id)} className="rounded-full border border-line px-3 py-1.5 text-sm hover:bg-panel">Decline</button>
                <button type="button" onClick={() => { join(g.id); openGame(g.id); }} className="rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink">Join</button>
              </span>
            ) : <ChevronRight className="size-5 text-muted" />}
          </li>
        );
      })}
    </ul>
  );
}
