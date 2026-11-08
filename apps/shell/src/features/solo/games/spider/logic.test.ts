import { describe, expect, it } from 'vitest';
import { bestTarget, canDeal, canMove, deal, hint, move, newGame, runStart, won, type Card, type Spider } from './logic';

const c = (s: number, r: number, up = true, id = s * 100 + r): Card => ({ id, s, r, up });
const game = (cols: Card[][], stock: Card[] = []): Spider => ({ cols: [...cols, ...Array.from({ length: 10 - cols.length }, (_, i) => [c(3, 1 + i, true, 900 + i)])], stock, done: [], moves: 0, score: 500, suits: 4 });

describe('Spider Solitaire', () => {
  it('deals 104 cards: 54 on the table, top ones up, 50 in the stock; the same for a seed', () => {
    for (const suits of [1, 2, 4] as const) {
      const g = newGame(7, suits);
      expect(g.cols.map((x) => x.length)).toEqual([6, 6, 6, 6, 5, 5, 5, 5, 5, 5]);
      expect(g.stock).toHaveLength(50);
      expect(g.cols.every((x) => x[x.length - 1].up && x.slice(0, -1).every((y) => !y.up))).toBe(true);
      const all = [...g.cols.flat(), ...g.stock];
      expect(new Set(all.map((x) => x.id)).size).toBe(104);
      expect(new Set(all.map((x) => x.s)).size).toBe(suits);
      for (let r = 1; r <= 13; r++) expect(all.filter((x) => x.r === r)).toHaveLength(8);
    }
    expect(newGame(5, 2)).toEqual(newGame(5, 2));
    expect(newGame(5, 2)).not.toEqual(newGame(6, 2));
  });

  it('picks up only same-suit runs going down, and puts them on a card one higher of any suit', () => {
    const g = game([[c(0, 9, false), c(1, 8), c(0, 7), c(0, 6)], [c(2, 8)], [c(1, 9)], []]);
    expect(runStart(g.cols[0])).toBe(2);
    expect(canMove(g, 0, 2, 1)).toBe(true); // 7♠6♠ onto 8♦
    expect(canMove(g, 0, 1, 2)).toBe(false); // 8♥ isn't in the run
    expect(canMove(g, 0, 3, 2)).toBe(false); // 6 onto 9
    expect(canMove(g, 0, 2, 3)).toBe(true); // into an empty column
    const n = move(g, 0, 2, 1);
    expect(n.cols[1].map((x) => x.r)).toEqual([8, 7, 6]);
    expect(n.cols[0]).toHaveLength(2);
    expect(n.moves).toBe(1);
    expect(g.cols[0]).toHaveLength(4); // the old position is untouched (undo)
    const m = move(n, 0, 1, 2); // 8♥ onto 9♥ turns the 9♠ over
    expect(m.cols[0][0].up).toBe(true);
  });

  it('takes away a King-to-Ace run of one suit', () => {
    const run = Array.from({ length: 12 }, (_, k) => c(1, 13 - k));
    const g = game([[c(0, 5, false), ...run], [c(1, 1)]]);
    const n = move(g, 1, 0, 0);
    expect(n.done).toEqual([1]);
    expect(n.cols[0]).toEqual([{ ...c(0, 5), up: true }]);
    expect(n.score).toBe(g.score - 1 + 100);
  });

  it('deals a row only when no column is empty', () => {
    const stock = Array.from({ length: 10 }, (_, k) => c(0, k + 1, false, 500 + k));
    const g = game([[c(0, 3)]], stock);
    expect(canDeal(g)).toBe(true);
    const n = deal(g);
    expect(n.stock).toHaveLength(0);
    expect(n.cols.every((x) => x.length === 2 && x[1].up)).toBe(true);
    const e = game([[c(0, 3)], []], stock);
    expect(canDeal(e)).toBe(false);
    expect(deal(e)).toBe(e);
  });

  it('taps go to the same suit first; hints find a useful move, else the deal', () => {
    const g = game([[c(0, 5, false), c(0, 7)], [c(1, 8)], [c(0, 8)]]);
    expect(bestTarget(g, 0, 1)).toBe(2);
    expect(hint(g)).toEqual({ from: 0, idx: 1, to: 2 });
    const stuck: Spider = { ...game([]), cols: Array.from({ length: 10 }, (_, i) => [c(i % 4, 1 + (i % 2) * 6, true, 800 + i)]), stock: [c(0, 1)] };
    expect(hint(stuck)).toBe('deal');
  });

  it('following the hints in one suit makes progress and never repeats itself', () => {
    let g = newGame(1, 1);
    const seen = new Set<string>();
    for (let i = 0; i < 2000 && !won(g); i++) {
      const h = hint(g);
      if (!h) break;
      const key = JSON.stringify(g.cols.map((x) => x.map((y) => y.id + (y.up ? 'u' : '')))) + g.stock.length;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      g = h === 'deal' ? deal(g) : move(g, h.from, h.idx, h.to);
    }
    expect(g.done.length).toBeGreaterThan(0);
  });
});
