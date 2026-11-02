// Tic-Tac-Toe: two players, three in a row wins. Player 0 is X and goes first, player 1 is O.
// See core.js for how games plug in.
//
// g.s = { cells: [9 × -1 (empty) | player index], line: the winning three squares or null, draw: bool }
import { finish, nextTurn, playing } from './core.js';

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

/** The three squares in a row, if someone has them. */
export const winLine = (cells) => LINES.find(([a, b, c]) => cells[a] !== -1 && cells[a] === cells[b] && cells[b] === cells[c]) ?? null;

const empty = (cells) => cells.map((v, k) => (v === -1 ? k : -1)).filter((k) => k >= 0);

function place(g, i, c) {
  const s = g.s;
  if (!Number.isInteger(c) || c < 0 || c > 8) throw new Error('Pick a square');
  if (s.cells[c] !== -1) throw new Error('That square is taken');
  s.cells[c] = i;
  g.ev.push({ k: 'place', s: i, c });
  const line = winLine(s.cells);
  if (line) { s.line = line; return finish(g, i); }
  if (!empty(s.cells).length) { // a draw: both share first place
    s.draw = true;
    for (const pl of g.players.filter(playing)) { pl.state = 'done'; pl.rank = 1; }
    g.ranked = 1;
    g.status = 'over';
    g.ev.push({ k: 'draw' }, { k: 'over' });
    return;
  }
  pass(g);
}

function pass(g) { nextTurn(g); }

/** A sensible move: win if it can, stop the other winning, then centre, corners, sides. */
export function pick(cells, me, rand) {
  const free = empty(cells);
  const other = 1 - me;
  const wins = (who) => free.filter((c) => { const t = [...cells]; t[c] = who; return winLine(t); });
  const w = wins(me); if (w.length) return w[0];
  const b = wins(other); if (b.length) return b[0];
  for (const group of [[4], [0, 2, 6, 8], [1, 3, 5, 7]]) {
    const g = group.filter((c) => cells[c] === -1);
    if (g.length) return g[rand(g.length)];
  }
  return free[0];
}

export default {
  type: 'tictactoe',
  name: 'Tic-Tac-Toe',
  min: 2,
  max: 2,
  turnMs: 30_000,

  begin(g) { g.s = { cells: Array(9).fill(-1), line: null, draw: false }; },

  act(g, i, a) {
    if (g.status !== 'play' || g.turn !== i || !playing(g.players[i])) throw new Error('Not your turn');
    if (a?.a === 'place') return place(g, i, a.c);
    throw new Error('Not allowed now');
  },

  auto(g, rand) { place(g, g.turn, pick(g.s.cells, g.turn, rand)); },
  pass,
  animMs: (ev) => ev.reduce((ms, e) => ms + (e.k === 'place' ? 500 : e.k === 'turn' ? 200 : 0), 0),
  removed() {},
};
