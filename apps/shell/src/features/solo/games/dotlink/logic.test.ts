import { describe, expect, it } from 'vitest';
import { begin, extend, hint, joined, makeLevel, sizeFor, won, type Paths, type Puzzle } from './logic';

// 3×3:  0 0 1      colour 0: 0 → 1 → 4 → 3 → 6 → 7 (ends 0 and 7)
//       0 0 1      colour 1: 2 → 5 → 8           (ends 2 and 8)
//       0 0 1
const pz: Puzzle = { n: 3, solution: [[0, 1, 4, 3, 6, 7], [2, 5, 8]] };
const draw = (paths: Paths, c: number, cells: number[]) => cells.reduce((p, x) => extend(pz, p, c, x), paths);

describe('Dot Link', () => {
  it('draws from a dot, square by square, only to a neighbour', () => {
    let [p, c] = begin(pz, [[], []], 0);
    expect(c).toBe(0);
    p = draw(p, 0, [1, 5]); // 5 isn't next to 1
    expect(p[0]).toEqual([0, 1]);
    p = draw(p, 0, [4, 3, 6, 7]);
    expect(joined(pz, p[0], 0)).toBe(true);
    expect(draw(p, 0, [8])[0]).toEqual(p[0]); // done at its dot: no further
    expect(begin(pz, p, 4)).toEqual([[[0, 1, 4], []], 0]); // pressing on its path cuts it back
    expect(begin(pz, [[], []], 4)[1]).toBe(-1); // an empty square starts nothing
  });
  it('goes back over itself, won’t enter another colour’s dot, cuts another colour’s path', () => {
    let p = draw(begin(pz, [[], []], 0)[0], 0, [1, 4, 1]);
    expect(p[0]).toEqual([0, 1]);
    p = draw(p, 0, [2]);
    expect(p[0]).toEqual([0, 1]); // 2 is the other colour's dot
    p = draw(begin(pz, p, 2)[0], 1, [5, 4, 3]);
    p = draw(p, 0, [4]); // colour 0 cuts through colour 1's path at 4
    expect(p).toEqual([[0, 1, 4], [2, 5]]);
  });
  it('is won when every pair is joined and every square filled', () => {
    expect(won(pz, [[0, 1, 4, 3, 6, 7], [2, 5, 8]])).toBe(true);
    expect(won(pz, [[0, 3, 6, 7], [2, 5, 8]])).toBe(false); // joined, but 1 and 4 are empty
  });
  it('a hint draws one colour the right way, cutting what’s in its way', () => {
    const [p, c] = hint(pz, [[0, 1], [2, 5, 4, 3]]);
    expect(c).toBe(0);
    expect(p).toEqual([[0, 1, 4, 3, 6, 7], [2, 5]]);
    expect(hint(pz, hint(pz, p)[0])[1]).toBe(-1);
  });
  it('makes boards filled by their answer, bigger as you go, the same for a seed', () => {
    for (const level of [1, 3, 6, 10, 20]) {
      const l = makeLevel(level, 42);
      expect(l.n).toBe(sizeFor(level));
      const cells = l.solution.flat();
      expect(new Set(cells).size).toBe(l.n * l.n);
      expect(l.solution.every((s) => s.length >= 3)).toBe(true);
      expect(won(l, l.solution)).toBe(true);
      // the answer can be drawn through the rules, and the hints finish it too
      let p: Paths = l.solution.map(() => []);
      l.solution.forEach((s, c) => { p = s.slice(1).reduce((q, x) => extend(l, q, c, x), begin(l, p, s[0])[0]); });
      expect(won(l, p)).toBe(true);
      let h: Paths = l.solution.map(() => []);
      for (let k = 0; k < l.solution.length; k++) h = hint(l, h)[0];
      expect(won(l, h)).toBe(true);
    }
    expect(makeLevel(4, 7)).toEqual(makeLevel(4, 7));
    expect(makeLevel(4, 7)).not.toEqual(makeLevel(4, 8));
  });
});
