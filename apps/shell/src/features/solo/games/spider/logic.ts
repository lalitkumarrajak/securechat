// Spider Solitaire (the classic patience game): two decks, ten columns. Move a card, or a run of the
// same suit going down, onto any card one higher; deal a row from the stock when no column is empty;
// a full King-to-Ace run of one suit leaves the table. Pure functions, no React: see logic.test.ts.
import { rng } from '../../kit';

export interface Card { id: number; s: number; r: number; up: boolean } // suit 0..3 (♠ ♥ ♦ ♣), rank 1 (A) .. 13 (K)
export interface Spider { cols: Card[][]; stock: Card[]; done: number[]; moves: number; score: number; suits: 1 | 2 | 4 }
export type Move = { from: number; idx: number; to: number };

export const RUNS = 8;

/** A new game: 104 cards in 1, 2 or 4 suits, 54 on the table (top ones face up), 50 in the stock. */
export function newGame(seed: number, suits: 1 | 2 | 4): Spider {
  const r = rng(Math.imul(seed, 2654435761) + suits);
  const SUITS = suits === 1 ? [0] : suits === 2 ? [0, 1] : [0, 1, 2, 3];
  const deck = r.shuffle(Array.from({ length: 104 }, (_, id) => ({ id, s: SUITS[Math.floor(id / 13) % SUITS.length], r: (id % 13) + 1, up: false })));
  const cols: Card[][] = Array.from({ length: 10 }, () => []);
  for (let i = 0; i < 54; i++) cols[i % 10].push(deck[i]);
  for (const c of cols) c[c.length - 1].up = true;
  return { cols, stock: deck.slice(54), done: [], moves: 0, score: 500, suits };
}

/** Where the run you can pick up starts: the face-up cards at the bottom, same suit, going down by one. */
export function runStart(col: Card[]) {
  let i = col.length - 1;
  if (i < 0) return 0;
  while (i > 0 && col[i - 1].up && col[i - 1].s === col[i].s && col[i - 1].r === col[i].r + 1) i--;
  return i;
}

export function canMove(g: Spider, from: number, idx: number, to: number) {
  const a = g.cols[from], b = g.cols[to];
  if (from === to || !a || !b || idx < runStart(a) || idx >= a.length || !a[idx].up) return false;
  return b.length === 0 || b[b.length - 1].r === a[idx].r + 1;
}

const copy = (g: Spider): Spider => ({ ...g, cols: g.cols.map((c) => c.map((x) => ({ ...x }))), stock: g.stock.map((x) => ({ ...x })), done: [...g.done] });
const flip = (c: Card[]) => { if (c.length && !c[c.length - 1].up) c[c.length - 1].up = true; };

/** Takes away a finished King-to-Ace run of one suit from the bottom of a column, if there is one. */
function clear(g: Spider, i: number) {
  const c = g.cols[i];
  if (c.length < 13) return;
  const run = c.slice(-13);
  if (run.every((x, k) => x.up && x.s === run[0].s && x.r === 13 - k)) {
    c.splice(c.length - 13, 13);
    g.done.push(run[0].s);
    g.score += 100;
    flip(c);
  }
}

export function move(g: Spider, from: number, idx: number, to: number): Spider {
  if (!canMove(g, from, idx, to)) return g;
  const n = copy(g);
  n.cols[to].push(...n.cols[from].splice(idx));
  flip(n.cols[from]);
  clear(n, to);
  n.moves++; n.score--;
  return n;
}

export const canDeal = (g: Spider) => g.stock.length > 0 && g.cols.every((c) => c.length > 0);

/** One card face up onto every column. */
export function deal(g: Spider): Spider {
  if (!canDeal(g)) return g;
  const n = copy(g);
  for (let i = 0; i < 10; i++) n.cols[i].push({ ...n.stock.pop()!, up: true });
  for (let i = 0; i < 10; i++) clear(n, i);
  n.moves++; n.score--;
  return n;
}

export const won = (g: Spider) => g.done.length === RUNS;

/** Where tapping a card sends it: a card of its suit one higher, then any card one higher, then an empty column. */
export function bestTarget(g: Spider, from: number, idx: number): number {
  const card = g.cols[from][idx];
  if (!card) return -1;
  let best = -1, bestScore = -1;
  for (let k = 1; k < 10; k++) {
    const to = (from + k) % 10;
    if (!canMove(g, from, idx, to)) continue;
    const b = g.cols[to];
    const sc = b.length === 0 ? 1 : b[b.length - 1].s === card.s ? 3 : 2;
    if (sc > bestScore) { best = to; bestScore = sc; }
  }
  return best;
}

/** How much a move helps: turning a card over, joining its suit, emptying a column. 0 = pointless. */
function worth(g: Spider, m: Move): number {
  const a = g.cols[m.from], card = a[m.idx], below = a[m.idx - 1], b = g.cols[m.to];
  const onParent = below?.up && below.r === card.r + 1;
  if (onParent && below.s === card.s) return 0; // already where it belongs
  const top = b[b.length - 1];
  const reveals = below && !below.up;
  if (!top) return reveals ? 30 : 0; // into an empty column: only to turn a card over
  // emptying a column while the stock still has cards only stops the deal, unless it finishes a run
  if (!below && g.stock.length && move(g, m.from, m.idx, m.to).done.length === g.done.length) return 0;
  let w = 0;
  if (reveals) w += 50;
  if (top.s === card.s) w += 30;
  if (!below) w += 20;
  if (below?.up && !onParent) w += 10;
  return w ? w + a.length - m.idx : 0;
}

/** A useful move (the most useful), or 'deal', or null when nothing helps. */
export function hint(g: Spider): Move | 'deal' | null {
  let best: Move | null = null, bestW = 0;
  for (let from = 0; from < 10; from++) {
    const a = g.cols[from];
    if (!a.length) continue;
    const idx = runStart(a);
    const to = bestTarget(g, from, idx);
    if (to < 0) continue;
    const m = { from, idx, to }, w = worth(g, m);
    if (w > bestW) { best = m; bestW = w; }
  }
  if (best) return best;
  if (canDeal(g)) return 'deal';
  // an empty column holds up the deal: fill it with anything that can move
  if (g.stock.length) for (let from = 0; from < 10; from++) {
    const a = g.cols[from];
    if (a.length < 2) continue;
    const to = g.cols.findIndex((c) => c.length === 0);
    return { from, idx: a.length - 1, to };
  }
  return null;
}
