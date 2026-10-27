// UNO rules (packages/game-rules/uno.js), with chosen hands.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { begin, remove } from '@sanga/game-rules/core.js';
import uno, { DECK, card } from '@sanga/game-rules/uno.js';

let seed = 1;
const rand = (n) => { seed = (seed * 16807) % 2147483647; return seed % n; };
const game = (n) => begin({ status: 'lobby', players: Array.from({ length: n }, (_, i) => ({ u: 'p' + i, state: 'joined' })) }, uno, rand);
const id = (c, v, skip = 0) => DECK.findIndex((k, i) => k.c === c && k.v === v && i >= skip);
const act = (g, i, a) => { g.ev = []; uno.act(g, i, a, rand); return g.ev.map((e) => e.k); };
// Put chosen cards in a player's hand and a chosen card on the pile.
function setup(g, hands, top, color) {
  g.s.hands = hands;
  g.s.pile = [top];
  g.s.color = color ?? card(top).c;
  g.s.deck = [...DECK.keys()].filter((x) => x !== top && !hands.flat().includes(x));
}

describe('uno', () => {
  it('deals 7 each from a 108-card deck, starting on a number card', () => {
    assert.equal(DECK.length, 108);
    const g = game(4);
    assert.ok(g.s.hands.every((h) => h.length === 7));
    assert.match(card(g.s.pile[0]).v, /^\d$/);
    assert.equal(g.s.deck.length + g.s.pile.length + 28, 108);
  });

  it('plays a matching card; refuses one that doesn’t match, and out of turn', () => {
    const g = game(3);
    setup(g, [[id('r', '5'), id('b', '7')], [id('g', '1')], [id('y', '2')]], id('r', '3'));
    assert.throws(() => act(g, 0, { a: 'play', id: id('b', '7') }), /doesn’t match/);
    assert.throws(() => act(g, 1, { a: 'draw' }), /Not your turn/);
    assert.deepEqual(act(g, 0, { a: 'play', id: id('r', '5') }), ['play', 'turn']);
    assert.equal(g.turn, 1);
  });

  it('skip, reverse and draw two', () => {
    const g = game(3);
    setup(g, [[id('r', 'skip'), id('r', '1')], [id('g', '1')], [id('y', '2'), id('r', 'rev'), id('r', '4')]], id('r', '3'));
    act(g, 0, { a: 'play', id: id('r', 'skip') });
    assert.equal(g.turn, 2); // 1 was skipped
    act(g, 2, { a: 'play', id: id('r', 'rev') });
    assert.equal(g.s.dir, -1);
    assert.equal(g.turn, 1); // going the other way now
    const h1 = g.s.hands[1].length;
    g.s.hands[1].push(id('r', 'd2'));
    act(g, 1, { a: 'play', id: id('r', 'd2') });
    assert.equal(g.s.hands[0].length, 1 + 2); // player 0 (next, going backwards) drew two…
    assert.equal(g.turn, 2); // …and was skipped
    assert.equal(g.s.hands[1].length, h1);
  });

  it('wild cards need a colour; wild draw four makes the next player draw four', () => {
    const g = game(2);
    setup(g, [[id('w', 'w4'), id('b', '3')], [id('g', '1')]], id('r', '3'));
    assert.throws(() => act(g, 0, { a: 'play', id: id('w', 'w4') }), /Pick a colour/);
    act(g, 0, { a: 'play', id: id('w', 'w4'), color: 'b' });
    assert.equal(g.s.color, 'b');
    assert.equal(g.s.hands[1].length, 5);
    assert.equal(g.turn, 0); // two players: skipped back to me
  });

  it('drawing: a card that fits may be played or kept', () => {
    const g = game(2);
    setup(g, [[id('b', '9')], [id('g', '1')]], id('r', '3'));
    g.s.deck.push(id('r', '8')); // next card off the deck
    assert.deepEqual(act(g, 0, { a: 'draw' }), ['draw']);
    assert.equal(g.s.drawn, id('r', '8'));
    assert.throws(() => act(g, 0, { a: 'play', id: id('b', '9') }), /card you drew/);
    act(g, 0, { a: 'keep' });
    assert.equal(g.turn, 1);
    assert.equal(g.s.drawn, null);
  });

  it('forgetting UNO can be caught (+2); calling it in time is safe', () => {
    const g = game(3);
    setup(g, [[id('r', '5'), id('r', '6')], [id('g', '1'), id('r', '7')], [id('y', '2')]], id('r', '3'));
    act(g, 0, { a: 'play', id: id('r', '5') }); // down to one card, didn't call UNO
    assert.equal(g.s.uno, 0);
    assert.deepEqual(act(g, 2, { a: 'catch', s: 0 }), ['caught', 'draw']);
    assert.equal(g.s.hands[0].length, 3);
    assert.equal(g.turn, 1); // catching doesn't change whose turn it is
    act(g, 1, { a: 'uno' }); // two cards, my turn: call it first
    act(g, 1, { a: 'play', id: id('r', '7') });
    assert.equal(g.s.uno, null);
    assert.throws(() => act(g, 2, { a: 'catch', s: 1 }), /Too late/);
  });

  it('the first to empty their hand wins; the rest are placed by cards left', () => {
    const g = game(3);
    setup(g, [[id('r', '5')], [id('g', '1'), id('g', '2'), id('g', '3')], [id('y', '2')]], id('r', '3'));
    act(g, 0, { a: 'play', id: id('r', '5') });
    assert.equal(g.status, 'over');
    assert.deepEqual(g.players.map((p) => p.rank), [1, 3, 2]);
  });

  it('players only see their own hand', () => {
    const g = game(3);
    g.ev = [];
    uno.act(g, 0, { a: 'draw' }, rand);
    const v1 = uno.view(g, 1);
    assert.deepEqual(v1.s.hand, g.s.hands[1]);
    assert.equal(v1.s.hands, undefined);
    assert.equal(v1.s.deck, g.s.deck.length);
    assert.deepEqual(v1.s.counts, g.s.hands.map((h) => h.length));
    assert.equal(v1.ev[0].ids, undefined); // can't see what player 0 drew
    assert.equal(uno.view(g, 0).ev[0].ids.length, 1);
  });

  it('the computer plays legal cards and calls UNO', () => {
    for (let round = 0; round < 30; round++) {
      const g = game(4);
      let turns = 0;
      while (g.status === 'play' && turns++ < 2000) { g.ev = []; uno.bot(g, rand); }
      assert.equal(g.status, 'over', 'a bots-only game finishes');
      assert.equal(g.players.filter((p) => p.rank === 1).length, 1);
    }
  });

  it('someone leaving: their cards go back, play continues', () => {
    const g = game(3);
    g.ev = [];
    remove(g, uno, 0, 'left');
    assert.equal(g.s.hands[0].length, 0);
    assert.notEqual(g.turn, 0);
  });
});
