import { describe, expect, it } from 'vitest';
import { canMove, makeLevel, move, range, solve, won, type Car } from './logic';

const cars: Car[] = [
  { len: 2, horiz: true, fixed: 2 }, // red, row 2
  { len: 3, horiz: false, fixed: 4 }, // a truck in column 4
  { len: 2, horiz: true, fixed: 5 }, // a car on the bottom row
];

describe('Car Out', () => {
  it('slides cars only along their length, and not through others', () => {
    const pos = [0, 0, 0]; // the truck covers rows 0–2 of column 4: in the red car's way
    expect(range(cars, pos, 0)).toEqual([0, 2]);
    expect(range(cars, pos, 1)).toEqual([0, 3]); // the bottom car is in columns 0–1
    expect(canMove(cars, pos, 0, 3)).toBe(false);
    expect(canMove(cars, [0, 0, 3], 1, 3)).toBe(false); // the bottom car now sits under column 4
    expect(range(cars, [0, 0, 3], 1)).toEqual([0, 2]);
    expect(won(cars, pos)).toBe(false);
    expect(won(cars, move(move(pos, [1, 3]), [0, 4]))).toBe(true);
  });
  it('finds the fewest moves out', () => {
    expect(solve(cars, [0, 0, 0])).toEqual([[1, 3], [0, 4]]);
    expect(solve(cars, [0, 0, 3])).toHaveLength(3); // the bottom car out of the way, the truck down, then out
    const stuck: Car[] = [cars[0], { len: 3, horiz: false, fixed: 4 }, { len: 3, horiz: false, fixed: 4 }];
    expect(solve(stuck, [0, 0, 3])).toBeNull();
  });
  it('makes levels that can be finished, harder as you go, the same for a seed', () => {
    let last = 0;
    for (const level of [1, 3, 6, 10, 14]) {
      const l = makeLevel(level, 42);
      const path = solve(l.cars, l.start)!;
      expect(path).toHaveLength(l.best);
      expect(won(l.cars, path.reduce((p, m) => { expect(canMove(l.cars, p, m[0], m[1])).toBe(true); return move(p, m); }, l.start))).toBe(true);
      expect(l.best).toBeGreaterThanOrEqual(Math.min(last, 8));
      last = l.best;
    }
    expect(makeLevel(4, 7)).toEqual(makeLevel(4, 7));
    expect(makeLevel(12, 1).cars.length).toBeGreaterThan(makeLevel(1, 1).cars.length);
  });
});
