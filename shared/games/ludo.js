// Ludo, with Ludo King's "Classic" rules. See core.js for how games plug in.
//
// The board has 4 arms (2-4 players) or 6 arms (5-6 players). Each arm contributes 13 track
// squares, so the loop is 52 or 78 squares. A token's progress p counts from its own start square:
//   -2             off the board (its player left)
//   -1             in the base (yard)
//   0 .. L-2       on the shared track (L = loop length; L-2 is the square before the home column)
//   L-1 .. L+3     in its own home column (5 squares)
//   L+4            home (the centre)
// Rolling a 6 brings a token out onto its start square. A 6, a capture or reaching home earns
// another roll; three 6s in a row lose the turn. Start squares and star squares are safe.
//
// g.s = { arms, arm: [arm of each player], tokens: [[p × 4] per player], phase: 'roll' | 'move',
//         dice, sixes, moves: [tokens that may move] }
import { finish, nextTurn, playing } from './core.js';

export const ARM = 13;        // track squares per arm
export const START = 8;       // index of an arm's start square among its 13
export const STAR = 3;        // index of the star (safe) square: 8 squares after the previous arm's start
export const TOKENS = 4;
export const MAX_SIXES = 3;

export const armsFor = (players) => (players <= 4 ? 4 : 6);
export const loopLen = (arms) => arms * ARM;
export const homeAt = (arms) => arms * ARM + 4;

// Which arms the players sit at, in turn order. Two players sit opposite each other, like Ludo King.
export const seatArms = (players) => (players === 2 ? [0, 2] : Array.from({ length: players }, (_, i) => i));

/** Track square (0..L-1) a token occupies, or null when it's in the base, home column or home. */
export function trackSquare(arms, arm, p) {
  if (p < 0 || p > loopLen(arms) - 2) return null;
  return (arm * ARM + START + p) % loopLen(arms);
}

export const isSafe = (sq) => sq % ARM === START || sq % ARM === STAR;

/** Tokens of player i that can move with `dice`. */
export function legalMoves(s, i, dice) {
  const home = homeAt(s.arms);
  const out = [];
  s.tokens[i].forEach((p, t) => {
    if (p === -1 ? dice === 6 : p >= 0 && p < home && p + dice <= home) out.push(t);
  });
  return out;
}

/** Where token t of player i would land with `dice`, and whom it would capture. */
export function preview(g, i, t, dice) {
  const s = g.s;
  const from = s.tokens[i][t];
  const to = from === -1 ? 0 : from + dice;
  const captured = [];
  const sq = trackSquare(s.arms, s.arm[i], to);
  if (sq !== null && !isSafe(sq)) {
    s.tokens.forEach((toks, j) => {
      if (j === i) return;
      toks.forEach((q, u) => { if (trackSquare(s.arms, s.arm[j], q) === sq) captured.push({ s: j, t: u, from: q }); });
    });
  }
  return { from, to, captured };
}

// Moves that need no choice: only one token can move, or all of them stand on the same spot.
function forcedMove(s, i, moves) {
  if (!moves.length) return null;
  const first = s.tokens[i][moves[0]];
  return moves.every((t) => s.tokens[i][t] === first) ? moves[0] : null;
}

// The move made for a player who ran out of time: capture, reach home, come out, else the leader.
function pickMove(g, i, moves) {
  const score = (t) => {
    const r = preview(g, i, t, g.s.dice);
    return (r.captured.length ? 1000 : 0) + (r.to === homeAt(g.s.arms) ? 500 : 0) + (r.from === -1 ? 300 : 0) + r.from;
  };
  return moves.reduce((best, t) => (score(t) > score(best) ? t : best), moves[0]);
}

function pass(g) {
  Object.assign(g.s, { phase: 'roll', dice: 0, sixes: 0, moves: [] });
  nextTurn(g);
}

function roll(g, dice) {
  const s = g.s, i = g.turn;
  s.dice = dice;
  s.sixes = dice === 6 ? s.sixes + 1 : 0;
  g.ev.push({ k: 'roll', s: i, d: dice });
  if (s.sixes === MAX_SIXES) {
    g.ev.push({ k: 'burn', s: i }); // three 6s in a row: the turn is lost
    return pass(g);
  }
  const moves = legalMoves(s, i, dice);
  if (!moves.length) return pass(g);
  s.phase = 'move';
  s.moves = moves;
  const forced = forcedMove(s, i, moves);
  if (forced !== null) move(g, forced);
}

function move(g, t) {
  const s = g.s, i = g.turn;
  if (s.phase !== 'move' || !s.moves.includes(t)) throw new Error('That token can’t move');
  const r = preview(g, i, t, s.dice);
  s.tokens[i][t] = r.to;
  for (const c of r.captured) s.tokens[c.s][c.t] = -1;
  g.ev.push({ k: 'move', s: i, t, from: r.from, to: r.to, cap: r.captured });
  s.moves = [];
  const home = homeAt(s.arms);
  if (s.tokens[i].every((p) => p === home)) {
    finish(g, i);
    if (g.status !== 'over') pass(g);
    return;
  }
  if (s.dice === 6 || r.captured.length || r.to === home) { // another roll
    if (s.dice !== 6) s.sixes = 0;
    s.phase = 'roll';
    s.dice = 0;
    g.ev.push({ k: 'again', s: i });
    return;
  }
  pass(g);
}

export default {
  type: 'ludo',
  name: 'Ludo',
  min: 2,
  max: 6,
  turnMs: 30_000,

  begin(g) {
    const n = g.players.length;
    const arms = armsFor(n);
    g.s = { arms, arm: seatArms(n), tokens: g.players.map(() => Array(TOKENS).fill(-1)), phase: 'roll', dice: 0, sixes: 0, moves: [] };
  },

  act(g, i, a, rand) {
    if (g.status !== 'play' || g.turn !== i || !playing(g.players[i])) throw new Error('Not your turn');
    if (a?.a === 'roll' && g.s.phase === 'roll') return roll(g, rand(6) + 1);
    if (a?.a === 'move' && g.s.phase === 'move' && Number.isInteger(a.t)) return move(g, a.t);
    throw new Error('Not allowed now');
  },

  auto(g, rand) {
    if (g.s.phase === 'roll') roll(g, rand(6) + 1);
    if (g.status === 'play' && g.s.phase === 'move') move(g, pickMove(g, g.turn, g.s.moves));
  },

  pass,

  removed(g, i) {
    g.s.tokens[i] = Array(TOKENS).fill(-2);
  },
};
