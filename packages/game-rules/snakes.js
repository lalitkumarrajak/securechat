// Snakes & Ladders on the classic 100-square board, for 2 to 4 players. See core.js for how games plug in.
// Roll and move; a ladder carries you up, a snake slides you down. You need the exact number to land on
// 100 (a bigger roll stays put). A six rolls again; a third six in a row loses the turn. First home wins,
// and play goes on for the other places.
//
// g.s = { pos: [square per player: 0 = not on the board yet, -1 = left], dice, sixes }
import { finish, nextTurn, playing } from './core.js';

export const LADDERS = { 1: 38, 4: 14, 9: 31, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 80: 100 };
export const SNAKES = { 16: 6, 47: 26, 49: 11, 56: 53, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 98: 78 };
export const GOAL = 100;

/** Where rolling `d` from `from` leads: the square walked to, and where a snake or ladder there takes you. */
export function land(from, d) {
  const to = from + d;
  if (to > GOAL) return { to: from, end: from, jump: null };
  const end = LADDERS[to] ?? SNAKES[to] ?? to;
  return { to, end, jump: end === to ? null : end > to ? 'ladder' : 'snake' };
}

function roll(g, d) {
  const s = g.s, i = g.turn;
  s.dice = d;
  g.ev.push({ k: 'roll', s: i, d });
  s.sixes = d === 6 ? s.sixes + 1 : 0;
  if (s.sixes === 3) { // three sixes in a row: no move, turn over
    s.sixes = 0; s.dice = 0;
    g.ev.push({ k: 'burn', s: i });
    return pass(g);
  }
  const from = s.pos[i];
  const r = land(from, d);
  if (r.to === from) g.ev.push({ k: 'stay', s: i, from });
  else {
    g.ev.push({ k: 'move', s: i, from, to: r.to });
    if (r.jump) g.ev.push({ k: 'jump', s: i, from: r.to, to: r.end, kind: r.jump });
    s.pos[i] = r.end;
  }
  if (s.pos[i] === GOAL) {
    s.dice = 0; s.sixes = 0;
    finish(g, i);
    if (g.status !== 'over') pass(g);
    return;
  }
  if (d === 6) { g.ev.push({ k: 'again', s: i }); s.dice = 0; return; }
  s.dice = 0;
  pass(g);
}

function pass(g) { g.s.sixes = 0; g.s.dice = 0; nextTurn(g); }

export default {
  type: 'snakes',
  name: 'Snakes & Ladders',
  min: 2,
  max: 4,
  turnMs: 30_000,

  begin(g) { g.s = { pos: g.players.map(() => 0), dice: 0, sixes: 0 }; },

  act(g, i, a, rand) {
    if (g.status !== 'play' || g.turn !== i || !playing(g.players[i])) throw new Error('Not your turn');
    if (a?.a === 'roll') return roll(g, rand(6) + 1);
    throw new Error('Not allowed now');
  },

  auto(g, rand) { roll(g, rand(6) + 1); },
  pass,

  animMs(ev) {
    let ms = 0;
    for (const e of ev) {
      if (e.k === 'roll') ms += 1200;
      else if (e.k === 'move') ms += Math.max(1, e.to - Math.max(e.from, 0)) * 170 + 200;
      else if (e.k === 'jump') ms += 800;
      else if (e.k === 'turn') ms += 300;
    }
    return ms;
  },

  removed(g, i) { g.s.pos[i] = -1; },
};
