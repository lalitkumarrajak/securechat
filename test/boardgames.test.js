// Tic-Tac-Toe, Connect Four and Snakes & Ladders (packages/game-rules).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { begin, remove } from '@sanga/game-rules/core.js';
import ttt, { winLine, pick as tttPick } from '@sanga/game-rules/tictactoe.js';
import c4, { landing, lineThrough, pick as c4Pick, COLS } from '@sanga/game-rules/connect4.js';
import snakes, { land, LADDERS, SNAKES } from '@sanga/game-rules/snakes.js';

let seed = 7;
const rand = (n) => { seed = (seed * 16807) % 2147483647; return seed % n; };
const game = (def, n) => begin({ status: 'lobby', players: Array.from({ length: n }, (_, i) => ({ u: 'p' + i, state: 'joined' })) }, def, rand);
const act = (def, g, i, a, r = rand) => { g.ev = []; def.act(g, i, a, r); return g.ev.map((e) => e.k); };

describe('tic-tac-toe', () => {
  it('turns alternate; taken squares and out-of-turn moves are refused', () => {
    const g = game(ttt, 2);
    assert.throws(() => act(ttt, g, 1, { a: 'place', c: 0 }), /Not your turn/);
    assert.deepEqual(act(ttt, g, 0, { a: 'place', c: 4 }), ['place', 'turn']);
    assert.throws(() => act(ttt, g, 1, { a: 'place', c: 4 }), /taken/);
    assert.throws(() => act(ttt, g, 1, { a: 'place', c: 9 }), /Pick a square/);
    assert.equal(g.turn, 1);
  });
  it('three in a row wins; the other player is second', () => {
    const g = game(ttt, 2);
    for (const [i, c] of [[0, 0], [1, 3], [0, 1], [1, 4], [0, 2]]) act(ttt, g, i, { a: 'place', c });
    assert.equal(g.status, 'over');
    assert.deepEqual(g.s.line, [0, 1, 2]);
    assert.deepEqual(g.players.map((p) => p.rank), [1, 2]);
  });
  it('a full board without a line is a draw: both first', () => {
    const g = game(ttt, 2);
    for (const [i, c] of [[0, 0], [1, 1], [0, 2], [1, 4], [0, 3], [1, 5], [0, 7], [1, 6], [0, 8]]) act(ttt, g, i, { a: 'place', c });
    assert.equal(g.status, 'over');
    assert.equal(g.s.draw, true);
    assert.deepEqual(g.players.map((p) => p.rank), [1, 1]);
  });
  it('the computer wins when it can, blocks when it must, and plays whole games legally', () => {
    assert.equal(tttPick([0, 0, -1, 1, 1, -1, -1, -1, -1], 0, rand), 2);
    assert.equal(tttPick([1, 1, -1, 0, -1, -1, -1, -1, -1], 0, rand), 2);
    for (let t = 0; t < 50; t++) {
      const g = game(ttt, 2);
      for (let n = 0; g.status === 'play' && n < 20; n++) { g.ev = []; ttt.auto(g, rand); }
      assert.equal(g.status, 'over');
    }
  });
  it('leaving hands the game to the other player', () => {
    const g = game(ttt, 2);
    remove(g, ttt, 0, 'left');
    assert.equal(g.status, 'over');
    assert.equal(g.players[1].rank, 1);
    assert.equal(winLine([-1, -1, -1, -1, -1, -1, -1, -1, -1]), null);
  });
});

describe('connect four', () => {
  it('discs fall to the bottom; full columns refuse', () => {
    const g = game(c4, 2);
    act(c4, g, 0, { a: 'drop', c: 3 });
    assert.equal(g.s.cells[5 * COLS + 3], 0);
    act(c4, g, 1, { a: 'drop', c: 3 });
    assert.equal(g.s.cells[4 * COLS + 3], 1);
    for (let k = 0; k < 4; k++) act(c4, g, g.turn, { a: 'drop', c: 3 });
    assert.equal(landing(g.s.cells, 3), -1);
    assert.throws(() => act(c4, g, g.turn, { a: 'drop', c: 3 }), /full/);
    assert.throws(() => act(c4, g, g.turn, { a: 'drop', c: 7 }), /Pick a column/);
  });
  it('four across, up, or diagonally wins', () => {
    const g = game(c4, 2);
    for (const c of [0, 0, 1, 1, 2, 2, 3]) act(c4, g, g.turn, { a: 'drop', c });
    assert.equal(g.status, 'over');
    assert.deepEqual(g.s.line, [35, 36, 37, 38]);
    assert.equal(g.players[0].rank, 1);
    const v = game(c4, 2);
    for (const c of [2, 3, 2, 3, 2, 3, 2]) act(c4, v, v.turn, { a: 'drop', c });
    assert.equal(v.players[0].rank, 1);
    const cells = Array(42).fill(-1);
    for (const [r, c] of [[5, 0], [4, 1], [3, 2], [2, 3]]) cells[r * COLS + c] = 1;
    assert.equal(lineThrough(cells, 3, 2).length, 4);
    assert.equal(lineThrough(Array(42).fill(-1), 0, 0), null);
  });
  it('the computer takes a win, blocks one, and finishes games legally', () => {
    const cells = Array(42).fill(-1);
    for (const c of [0, 1, 2]) cells[5 * COLS + c] = 0;
    assert.equal(c4Pick(cells, 0, rand), 3);
    assert.equal(c4Pick(cells, 1, rand), 3);
    for (let t = 0; t < 20; t++) {
      const g = game(c4, 2);
      for (let n = 0; g.status === 'play' && n < 60; n++) { g.ev = []; c4.auto(g, rand); }
      assert.equal(g.status, 'over');
    }
  });
});

describe('snakes & ladders', () => {
  it('ladders go up, snakes go down, and you need the exact number to finish', () => {
    assert.deepEqual(land(0, 1), { to: 1, end: 38, jump: 'ladder' });
    assert.deepEqual(land(10, 6), { to: 16, end: 6, jump: 'snake' });
    assert.deepEqual(land(50, 3), { to: 53, end: 53, jump: null });
    assert.deepEqual(land(98, 4), { to: 98, end: 98, jump: null });
    assert.equal(land(94, 6).end, 100);
    for (const [from, to] of Object.entries(LADDERS)) assert.ok(to > from);
    for (const [from, to] of Object.entries(SNAKES)) assert.ok(to < from);
    assert.equal(Object.keys(LADDERS).filter((k) => k in SNAKES).length, 0);
  });
  it('moves by the dice, in turn; a six rolls again; three sixes lose the turn', () => {
    const g = game(snakes, 3);
    assert.throws(() => act(snakes, g, 1, { a: 'roll' }), /Not your turn/);
    assert.deepEqual(act(snakes, g, 0, { a: 'roll' }, () => 1), ['roll', 'move', 'turn']); // 2 -> square 2
    assert.equal(g.s.pos[0], 2);
    assert.equal(g.turn, 1);
    g.turn = 0;
    assert.deepEqual(act(snakes, g, 0, { a: 'roll' }, () => 5), ['roll', 'move', 'again']); // 6 -> 8, again
    assert.equal(g.turn, 0);
    assert.equal(g.s.pos[0], 8);
    act(snakes, g, 0, { a: 'roll' }, () => 5);
    assert.deepEqual(act(snakes, g, 0, { a: 'roll' }, () => 5), ['roll', 'burn', 'turn']);
    assert.equal(g.s.pos[0], 14);
    assert.equal(g.turn, 1);
  });
  it('landing on a ladder or snake takes you there', () => {
    const g = game(snakes, 2);
    assert.deepEqual(act(snakes, g, 0, { a: 'roll' }, () => 0), ['roll', 'move', 'jump', 'turn']); // 1 -> ladder to 38
    assert.equal(g.s.pos[0], 38);
    g.turn = 0; g.s.pos[0] = 12;
    act(snakes, g, 0, { a: 'roll' }, () => 3); // 16: snake to 6
    assert.equal(g.s.pos[0], 6);
  });
  it('the exact roll wins; too big stays; the rest play on for second place', () => {
    const g = game(snakes, 3);
    g.s.pos = [98, 50, 50];
    assert.deepEqual(act(snakes, g, 0, { a: 'roll' }, () => 3), ['roll', 'stay', 'turn']);
    assert.equal(g.s.pos[0], 98);
    g.turn = 0;
    assert.deepEqual(act(snakes, g, 0, { a: 'roll' }, () => 1), ['roll', 'move', 'done', 'turn']);
    assert.equal(g.players[0].rank, 1);
    assert.equal(g.status, 'play');
    assert.equal(g.turn, 1);
  });
  it('a leaver leaves the board, and whole computer games finish', () => {
    const g = game(snakes, 2);
    remove(g, snakes, 0, 'left');
    assert.equal(g.s.pos[0], -1);
    assert.equal(g.status, 'over');
    for (let t = 0; t < 20; t++) {
      const h = game(snakes, 4);
      for (let n = 0; h.status === 'play' && n < 3000; n++) { h.ev = []; snakes.auto(h, rand); }
      assert.equal(h.status, 'over');
      assert.deepEqual(h.players.map((p) => p.rank).sort(), [1, 2, 3, 4]);
    }
  });
});
