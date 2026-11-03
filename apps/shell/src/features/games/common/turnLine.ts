import { t } from '@sanga/i18n';
import type { Game } from '../store';

/** One line under the board: whose move it is, or how it ended. */
export function turnLine(g: Game, me: number, draw: boolean) {
  if (g.status === 'over') {
    if (draw) return t('It’s a draw!');
    const w = g.players.findIndex((p) => p.rank === 1);
    return w === me ? t('You won! 🎉') : w >= 0 ? t('{name} won', { name: g.players[w].n || g.players[w].u }) : t('Game over');
  }
  return g.turn === me ? t('Your turn') : t('{name}’s turn…', { name: g.players[g.turn]?.n || g.players[g.turn]?.u });
}
