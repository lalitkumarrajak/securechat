import type { Game } from '../store';

/** One line under the board: whose move it is, or how it ended. */
export function turnLine(g: Game, me: number, draw: boolean) {
  if (g.status === 'over') {
    if (draw) return 'It’s a draw!';
    const w = g.players.findIndex((p) => p.rank === 1);
    return w === me ? 'You won! 🎉' : w >= 0 ? `${g.players[w].n || g.players[w].u} won` : 'Game over';
  }
  return g.turn === me ? 'Your turn' : `${g.players[g.turn]?.n || g.players[g.turn]?.u}’s turn…`;
}
