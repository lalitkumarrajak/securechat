import { describe, expect, it } from 'vitest';
import { CAP, canPour, makeLevel, pour, solve, won } from './logic';

describe('Colour Pour', () => {
  it('pours the top colour, as much as fits', () => {
    const t = [[0, 1, 1], [1], []];
    expect(pour(t, 0, 1)).toEqual([[0], [1, 1, 1], []]);
    expect(pour([[0, 1, 1, 1], [2, 2, 1], []], 0, 1)).toEqual([[0, 1, 1], [2, 2, 1, 1], []]);
  });
  it('won’t pour onto another colour, into a full tube, or from an empty one', () => {
    expect(canPour([[0], [1]], 0, 1)).toBe(false);
    expect(canPour([[0], [0, 0, 0, 0]], 0, 1)).toBe(false);
    expect(canPour([[], [0]], 0, 1)).toBe(false);
  });
  it('makes levels that can be finished, harder as you go, the same for a seed', () => {
    for (const level of [1, 2, 5, 9, 15]) {
      const t = makeLevel(level, 42);
      expect(t.flat()).toHaveLength((t.length - 2) * CAP);
      expect(won(t)).toBe(false);
      const path = solve(t)!;
      expect(path).not.toBeNull();
      expect(won(path.reduce((s, [f, to]) => pour(s, f, to), t))).toBe(true);
    }
    expect(makeLevel(3, 7)).toEqual(makeLevel(3, 7));
    expect(makeLevel(20, 1).length).toBeGreaterThan(makeLevel(1, 1).length);
  });
});
