// Ludo rules (shared/games/ludo.js), driven with chosen dice.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { begin, remove } from '../shared/games/core.js';
import ludo, { homeAt, isSafe, trackSquare } from '../shared/games/ludo.js';

const game = (n) => begin({
  status: 'lobby',
  players: Array.from({ length: n }, (_, i) => ({ u: 'p' + i, state: 'joined' })),
}, ludo);
const dice = (...seq) => () => seq.shift() - 1; // rand(6) + 1 = next value
const act = (g, i, a, d) => { g.ev = []; ludo.act(g, i, a, d ? dice(d) : dice()); return g.ev.map((e) => e.k); };

describe('ludo', () => {
  it('seats 2 players opposite, 5-6 players on the 6-arm board', () => {
    assert.deepEqual(game(2).s.arm, [0, 2]);
    assert.equal(game(4).s.arms, 4);
    assert.equal(game(5).s.arms, 6);
    assert.deepEqual(game(6).s.arm, [0, 1, 2, 3, 4, 5]);
  });

  it('needs a 6 to come out, then rolls again', () => {
    const g = game(2);
    assert.deepEqual(act(g, 0, { a: 'roll' }, 3), ['roll', 'turn']);
    assert.equal(g.turn, 1);
    assert.deepEqual(act(g, 1, { a: 'roll' }, 6), ['roll', 'move', 'again']); // all in base: moves by itself
    assert.deepEqual(g.s.tokens[1], [0, -1, -1, -1]);
    assert.equal(g.turn, 1);
    assert.equal(g.s.phase, 'roll');
  });

  it('rejects moves out of turn or not allowed', () => {
    const g = game(2);
    assert.throws(() => ludo.act(g, 1, { a: 'roll' }, dice(1)), /Not your turn/);
    assert.throws(() => ludo.act(g, 0, { a: 'move', t: 0 }, dice(1)), /Not allowed/);
  });

  it('asks which token when there is a real choice', () => {
    const g = game(2);
    g.s.tokens[0] = [0, 10, -1, -1];
    assert.deepEqual(act(g, 0, { a: 'roll' }, 3), ['roll']);
    assert.deepEqual(g.s.moves, [0, 1]);
    assert.throws(() => act(g, 0, { a: 'move', t: 2 }), /can’t move/);
    assert.deepEqual(act(g, 0, { a: 'move', t: 1 }), ['move', 'turn']);
    assert.equal(g.s.tokens[0][1], 13);
  });

  it('captures on a normal square and earns another roll', () => {
    const g = game(4);
    // Player 0 (arm 0) at progress 5 = square 13; player 1 (arm 1) starts at square 21, so 13 is behind it.
    g.s.tokens[0] = [5, -1, -1, -1];
    g.s.tokens[1] = [trackSquareFor(g, 1, 15), -1, -1, -1];
    assert.equal(trackSquare(4, 1, g.s.tokens[1][0]), 15);
    act(g, 0, { a: 'roll' }, 2); // 13 -> 15
    assert.deepEqual(g.s.tokens[1][0], -1);
    assert.equal(g.ev.find((e) => e.k === 'move').cap.length, 1);
    assert.equal(g.turn, 0);
    assert.equal(g.s.phase, 'roll');
  });

  it('does not capture on safe squares', () => {
    const g = game(4);
    assert.ok(isSafe(21) && isSafe(16)); // player 1's start, and a star
    g.s.tokens[0] = [6, -1, -1, -1];      // square 14
    g.s.tokens[1] = [trackSquareFor(g, 1, 16), -1, -1, -1];
    act(g, 0, { a: 'roll' }, 2);
    assert.equal(trackSquare(4, 1, g.s.tokens[1][0]), 16);
    assert.equal(g.turn, 1);
  });

  it('three 6s in a row lose the turn', () => {
    const g = game(2);
    g.s.tokens[0] = [0, 10, 20, 30];
    act(g, 0, { a: 'roll' }, 6); act(g, 0, { a: 'move', t: 0 });
    act(g, 0, { a: 'roll' }, 6); act(g, 0, { a: 'move', t: 0 });
    assert.deepEqual(act(g, 0, { a: 'roll' }, 6), ['roll', 'burn', 'turn']);
    assert.equal(g.turn, 1);
  });

  it('needs an exact roll to reach home; all four home finishes the game', () => {
    const g = game(2);
    const H = homeAt(4);
    g.s.tokens[0] = [H, H, H, H - 3];
    assert.deepEqual(act(g, 0, { a: 'roll' }, 5), ['roll', 'turn']); // overshoots
    act(g, 1, { a: 'roll' }, 1);
    assert.deepEqual(act(g, 0, { a: 'roll' }, 3), ['roll', 'move', 'done', 'over']);
    assert.equal(g.status, 'over');
    assert.deepEqual(g.players.map((p) => p.rank), [1, 2]);
  });

  it('a 3-player game goes on for 2nd place', () => {
    const g = game(3);
    const H = homeAt(4);
    g.s.tokens[0] = [H, H, H, H - 1];
    act(g, 0, { a: 'roll' }, 1);
    assert.equal(g.status, 'play');
    assert.equal(g.players[0].rank, 1);
    assert.equal(g.turn, 1);
  });

  it('someone leaving takes their tokens off; the last one left wins', () => {
    const g = game(3);
    g.ev = [];
    remove(g, ludo, 0, 'left');
    assert.equal(g.turn, 1);
    assert.deepEqual(g.s.tokens[0], [-2, -2, -2, -2]);
    remove(g, ludo, 2, 'out');
    assert.equal(g.status, 'over');
    assert.equal(g.players[1].rank, 1);
  });

  it('plays for a player who ran out of time, preferring a capture', () => {
    const g = game(4);
    g.s.tokens[0] = [5, 30, -1, -1];
    g.s.tokens[1] = [trackSquareFor(g, 1, 15), -1, -1, -1];
    g.ev = [];
    ludo.auto(g, dice(2));
    assert.equal(g.s.tokens[0][0], 7);
    assert.equal(g.s.tokens[1][0], -1);
  });
});

// Progress of player i's token that puts it on track square sq.
function trackSquareFor(g, i, sq) {
  for (let p = 0; p < 60; p++) if (trackSquare(g.s.arms, g.s.arm[i], p) === sq) return p;
  throw new Error('unreachable square');
}
