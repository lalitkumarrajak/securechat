// UNO with the standard 108-card deck and the usual rules. See core.js for how games plug in.
// Hands are secret: view() shows each player only their own cards, and how many the others hold.
//
// Cards are numbered 0..107; card(id) is { c, v }: colour r/y/g/b (w for wild cards) and value
// 0-9, skip, rev, d2 (Draw Two), wild or w4 (Wild Draw Four).
//
// g.s = { deck: [ids], pile: [ids, top last], hands: [[ids] per player], color, dir: 1 | -1,
//         drawn: the card just drawn if it may still be played (else null),
//         said: who called UNO ahead of playing down to one card,
//         uno: who is down to one card without having called UNO (anyone can catch them) }
//
// A turn: play a card matching the colour or value (or any wild), or draw one; a drawn card that
// fits may be played straight away, or kept. Skip, Reverse (a Skip with two players), Draw Two and
// Wild Draw Four work as printed. Forgetting to call UNO and getting caught costs two cards.
// The first player to empty their hand wins; everyone else is placed by how few cards they hold.
import { playing } from './core.js';

export const COLORS = ['r', 'y', 'g', 'b'];
export const HAND = 7;
const VALUES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'rev', 'd2'];

export const DECK = (() => {
  const d = [];
  for (const c of COLORS) {
    d.push({ c, v: '0' });
    for (const v of VALUES) d.push({ c, v }, { c, v });
  }
  for (let i = 0; i < 4; i++) d.push({ c: 'w', v: 'wild' }, { c: 'w', v: 'w4' });
  return d;
})();
export const card = (id) => DECK[id];

function shuffle(a, rand) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Can card `id` go on the pile right now? */
export function fits(s, id) {
  const k = card(id), top = card(s.pile[s.pile.length - 1]);
  return k.c === 'w' || k.c === s.color || k.v === top.v;
}

// Take n cards for player i, reshuffling the played cards into a new deck when it runs out.
function take(g, i, n, rand, why) {
  const s = g.s, got = [];
  for (let k = 0; k < n; k++) {
    if (!s.deck.length) {
      if (s.pile.length < 2) break; // everything is in people's hands
      const top = s.pile.pop();
      s.deck = shuffle(s.pile, rand);
      s.pile = [top];
    }
    got.push(s.deck.pop());
  }
  s.hands[i].push(...got);
  if (s.hands[i].length > 1) { if (s.uno === i) s.uno = null; if (s.said === i) s.said = null; }
  g.ev.push({ k: 'draw', s: i, ids: got, ...(why && { why }) });
  return got;
}

// The next player still in the game, `steps` places along in the current direction.
function seatAfter(g, from, steps = 1) {
  const n = g.players.length;
  let j = from;
  for (let k = 0; k < steps; k++) {
    for (let t = 0; t < n; t++) {
      j = (j + g.s.dir + n) % n;
      if (playing(g.players[j])) break;
    }
  }
  return j;
}

function advance(g, steps = 1) {
  g.s.drawn = null;
  g.turn = seatAfter(g, g.turn, steps);
  g.turnNo = (g.turnNo || 0) + 1;
  g.ev.push({ k: 'turn', s: g.turn });
}

// Someone emptied their hand: they win, the others are placed by how few cards they hold.
function finishGame(g, i) {
  const s = g.s;
  g.ranked = 0;
  const order = g.players.map((pl, j) => j).filter((j) => playing(g.players[j]))
    .sort((a, b) => (a === i ? -1 : b === i ? 1 : s.hands[a].length - s.hands[b].length));
  for (const j of order) { g.players[j].state = 'done'; g.players[j].rank = ++g.ranked; }
  g.ev.push({ k: 'done', s: i, rank: 1 });
  g.status = 'over';
  g.ev.push({ k: 'over' });
}

function play(g, i, id, color, rand) {
  const s = g.s, hand = s.hands[i];
  if (!hand.includes(id)) throw new Error('That card isn’t in your hand');
  if (s.drawn !== null && id !== s.drawn) throw new Error('Play the card you drew, or keep it');
  if (!fits(s, id)) throw new Error('That card doesn’t match');
  const k = card(id);
  if (k.c === 'w' && !COLORS.includes(color)) throw new Error('Pick a colour');
  hand.splice(hand.indexOf(id), 1);
  s.pile.push(id);
  s.color = k.c === 'w' ? color : k.c;
  g.ev.push({ k: 'play', s: i, id, color: s.color });
  if (s.uno !== null && s.uno !== i) s.uno = null; // the chance to catch them has passed
  if (hand.length === 1) s.uno = s.said === i ? null : i; // forgot to call UNO: catchable
  s.said = null;
  if (!hand.length) return finishGame(g, i);
  const solo = g.players.filter(playing).length === 2;
  if (k.v === 'rev') { s.dir = -s.dir; g.ev.push({ k: 'reverse', dir: s.dir }); return advance(g, solo ? 2 : 1); }
  if (k.v === 'skip') { g.ev.push({ k: 'skip', s: seatAfter(g, i) }); return advance(g, 2); }
  if (k.v === 'd2' || k.v === 'w4') {
    const victim = seatAfter(g, i);
    take(g, victim, k.v === 'd2' ? 2 : 4, rand, k.v);
    g.ev.push({ k: 'skip', s: victim });
    return advance(g, 2);
  }
  advance(g, 1);
}

function draw(g, i, rand) {
  const s = g.s;
  if (s.drawn !== null) throw new Error('You’ve already drawn');
  if (s.uno !== null && s.uno !== i) s.uno = null;
  const [id] = take(g, i, 1, rand);
  if (id !== undefined && fits(s, id)) s.drawn = id; // may play it now, or keep it
  else advance(g, 1);
}

// The colour a player holds most of (for choosing after a wild card).
function bestColor(hand) {
  const n = { r: 0, y: 0, g: 0, b: 0 };
  for (const id of hand) if (card(id).c !== 'w') n[card(id).c]++;
  return COLORS.reduce((a, b) => (n[b] > n[a] ? b : a), 'r');
}

// A sensible card: keep wilds for last, prefer the current colour, then actions to slow others.
function choose(s, hand) {
  const ok = (s.drawn !== null ? [s.drawn] : hand).filter((id) => fits(s, id));
  if (!ok.length) return null;
  const score = (id) => { const k = card(id); return (k.c === 'w' ? -10 : 0) + (k.c === s.color ? 3 : 0) + (['skip', 'rev', 'd2'].includes(k.v) ? 2 : 0); };
  return ok.reduce((a, b) => (score(b) > score(a) ? b : a));
}

function autoTurn(g, rand, smart) {
  const s = g.s, i = g.turn, hand = s.hands[i];
  if (smart) {
    if (s.uno !== null && s.uno !== i && rand(3) > 0) catchUno(g, i, s.uno, rand); // usually spots it
    if (hand.length === 2 && choose(s, hand) !== null) { s.said = i; g.ev.push({ k: 'uno', s: i }); }
  }
  let id = choose(s, hand);
  if (id === null) {
    if (s.drawn !== null) return keep(g);
    draw(g, i, rand);
    if (g.turn !== i || s.drawn === null) return;
    id = s.drawn;
  }
  play(g, i, id, bestColor(hand.filter((x) => x !== id)), rand);
}

function keep(g) {
  if (g.s.drawn === null) throw new Error('Nothing to keep');
  g.ev.push({ k: 'keep', s: g.turn });
  advance(g, 1);
}

function catchUno(g, by, who, rand) {
  if (g.s.uno !== who || who === by) throw new Error('Too late');
  g.s.uno = null;
  g.ev.push({ k: 'caught', s: who, by });
  take(g, who, 2, rand, 'caught');
}

export default {
  type: 'uno',
  name: 'UNO',
  min: 2,
  max: 8,
  turnMs: 30_000,

  begin(g, rand) {
    const deck = shuffle([...DECK.keys()], rand);
    const hands = g.players.map(() => deck.splice(0, HAND));
    // Start the pile with a number card, so the first turn is a plain one.
    const first = deck.findIndex((id) => /^\d$/.test(card(id).v));
    const [top] = deck.splice(first, 1);
    g.s = { deck, pile: [top], hands, color: card(top).c, dir: 1, drawn: null, said: null, uno: null };
  },

  act(g, i, a, rand) {
    if (g.status !== 'play' || !playing(g.players[i])) throw new Error('You’re not playing');
    const s = g.s;
    if (a?.a === 'uno') { // call UNO: with two cards on your turn, or as soon as you're down to one
      if (s.hands[i].length > 2 || (s.hands[i].length === 2 && g.turn !== i)) throw new Error('Call UNO when you’re about to have one card');
      if (s.uno === i) s.uno = null; else s.said = i;
      g.ev.push({ k: 'uno', s: i });
      return;
    }
    if (a?.a === 'catch') return catchUno(g, i, a.s, rand);
    if (g.turn !== i) throw new Error('Not your turn');
    if (a?.a === 'play' && Number.isInteger(a.id)) return play(g, i, a.id, a.color, rand);
    if (a?.a === 'draw') return draw(g, i, rand);
    if (a?.a === 'keep') return keep(g);
    throw new Error('Not allowed now');
  },

  auto: (g, rand) => autoTurn(g, rand, false),
  bot: (g, rand) => autoTurn(g, rand, true),
  pass: (g) => advance(g, 1),

  removed(g, i) { // their cards go back under the deck
    g.s.deck.unshift(...g.s.hands[i]);
    g.s.hands[i] = [];
    if (g.s.uno === i) g.s.uno = null;
  },

  // Each player sees their own hand, everyone's card counts and the top of the pile.
  view(g, i) {
    const s = g.s;
    const mine = (j) => j === i;
    return {
      s: {
        hand: i >= 0 ? s.hands[i] : [], counts: s.hands.map((h) => h.length), pile: s.pile.slice(-6), deck: s.deck.length,
        color: s.color, dir: s.dir, drawn: g.turn === i ? s.drawn : null, uno: s.uno, said: s.said,
      },
      ev: g.ev.map((e) => (e.k === 'draw' && !mine(e.s) ? { ...e, ids: undefined, n: e.ids.length } : e)),
    };
  },

  animMs(ev) {
    let ms = 0;
    for (const e of ev) ms += e.k === 'play' ? 700 : e.k === 'draw' ? 350 + 150 * (e.ids?.length || e.n || 1) : e.k === 'turn' ? 300 : 0;
    return ms;
  },
};
