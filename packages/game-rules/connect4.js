// Connect Four: two players drop discs into a 7 × 6 grid; four in a row (any direction) wins.
// Player 0 is red and goes first, player 1 is yellow. See core.js for how games plug in.
//
// g.s = { cells: [42 × -1 | player index] (row 0 is the top, so square = row × 7 + column),
//         line: the winning squares or null, draw: bool }
import { finish, nextTurn, playing } from './core.js';

export const COLS = 7;
export const ROWS = 6;
const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

/** Row a disc dropped in column c would land in, or -1 if the column is full. */
export function landing(cells, c) {
  for (let r = ROWS - 1; r >= 0; r--) if (cells[r * COLS + c] === -1) return r;
  return -1;
}

/** The squares of a run of four or more through (r, c), if the disc there is part of one. */
export function lineThrough(cells, r, c) {
  const who = cells[r * COLS + c];
  if (who === -1) return null;
  for (const [dr, dc] of DIRS) {
    const run = [r * COLS + c];
    for (const sign of [1, -1]) {
      for (let k = 1; ; k++) {
        const rr = r + dr * k * sign, cc = c + dc * k * sign;
        if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || cells[rr * COLS + cc] !== who) break;
        run.push(rr * COLS + cc);
      }
    }
    if (run.length >= 4) return run.sort((a, b) => a - b);
  }
  return null;
}

function drop(g, i, c) {
  const s = g.s;
  if (!Number.isInteger(c) || c < 0 || c >= COLS) throw new Error('Pick a column');
  const r = landing(s.cells, c);
  if (r < 0) throw new Error('That column is full');
  s.cells[r * COLS + c] = i;
  g.ev.push({ k: 'drop', s: i, c, r });
  const line = lineThrough(s.cells, r, c);
  if (line) { s.line = line; return finish(g, i); }
  if (s.cells.every((v) => v !== -1)) {
    s.draw = true;
    for (const pl of g.players.filter(playing)) { pl.state = 'done'; pl.rank = 1; }
    g.ranked = 1;
    g.status = 'over';
    g.ev.push({ k: 'draw' }, { k: 'over' });
    return;
  }
  nextTurn(g);
}

/** Would a disc of `who` dropped in column c make four? */
const wouldWin = (cells, who, c) => {
  const r = landing(cells, c);
  if (r < 0) return false;
  const t = [...cells]; t[r * COLS + c] = who;
  return !!lineThrough(t, r, c);
};

/** A sensible column: win now, block their win, never hand them a win on top, prefer the middle. */
export function pick(cells, me, rand) {
  const open = [...Array(COLS).keys()].filter((c) => landing(cells, c) >= 0);
  const win = open.find((c) => wouldWin(cells, me, c)); if (win !== undefined) return win;
  const block = open.find((c) => wouldWin(cells, 1 - me, c)); if (block !== undefined) return block;
  const safe = open.filter((c) => {
    const r = landing(cells, c);
    if (r === 0) return true;
    const t = [...cells]; t[r * COLS + c] = me;
    return !wouldWin(t, 1 - me, c);
  });
  const pool = safe.length ? safe : open;
  const best = Math.min(...pool.map((c) => Math.abs(c - 3)));
  const middle = pool.filter((c) => Math.abs(c - 3) === best);
  return middle[rand(middle.length)];
}

/** A tip for a new player: { why: 'win' | 'block' | 'middle', c: the column to try, traps: columns that
 *  would let the other player win on top of your disc }. */
export function advice(cells, me) {
  const open = [...Array(COLS).keys()].filter((c) => landing(cells, c) >= 0);
  const traps = open.filter((c) => {
    const r = landing(cells, c);
    if (r === 0) return false;
    const t = [...cells]; t[r * COLS + c] = me;
    return wouldWin(t, 1 - me, c);
  });
  const win = open.find((c) => wouldWin(cells, me, c)); if (win !== undefined) return { why: 'win', c: win, traps };
  const block = open.find((c) => wouldWin(cells, 1 - me, c)); if (block !== undefined) return { why: 'block', c: block, traps };
  const pool = open.filter((c) => !traps.includes(c));
  const from = pool.length ? pool : open;
  if (!from.length) return null;
  const c = from.reduce((b, x) => (Math.abs(x - 3) < Math.abs(b - 3) ? x : b));
  return { why: 'middle', c, traps };
}

export default {
  type: 'connect4',
  name: 'Connect Four',
  min: 2,
  max: 2,
  turnMs: 30_000,

  begin(g) { g.s = { cells: Array(COLS * ROWS).fill(-1), line: null, draw: false }; },

  act(g, i, a) {
    if (g.status !== 'play' || g.turn !== i || !playing(g.players[i])) throw new Error('Not your turn');
    if (a?.a === 'drop') return drop(g, i, a.c);
    throw new Error('Not allowed now');
  },

  auto(g, rand) { drop(g, g.turn, pick(g.s.cells, g.turn, rand)); },
  pass(g) { nextTurn(g); },
  animMs: (ev) => ev.reduce((ms, e) => ms + (e.k === 'drop' ? 200 + e.r * 90 + 250 : e.k === 'turn' ? 200 : 0), 0),
  removed() {},
};
