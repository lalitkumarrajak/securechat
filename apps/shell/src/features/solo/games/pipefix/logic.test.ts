import { describe, expect, it } from 'vitest';
import { DOWN, LEFT, RIGHT, UP, makeLevel, needed, sizeFor, turn, wet, won, type Level } from './logic';

// 3×1: source ─ straight ─ end
const lv: Level = { w: 3, h: 1, source: 0, pipes: [RIGHT, LEFT | RIGHT, LEFT], start: [0, 1, 0] };

describe('Pipe Fix', () => {
  it('turns pieces clockwise', () => {
    expect(turn(UP, 1)).toBe(RIGHT);
    expect(turn(LEFT, 1)).toBe(UP);
    expect(turn(UP | RIGHT, 2)).toBe(DOWN | LEFT);
    expect(turn(UP | DOWN, 3)).toBe(LEFT | RIGHT);
    expect(turn(UP | RIGHT | DOWN, 4)).toBe(UP | RIGHT | DOWN);
  });
  it('water runs only through openings that meet', () => {
    expect(wet(lv, [0, 1, 0])).toEqual([true, false, false]); // the middle piece is up–down
    expect(wet(lv, [0, 2, 0])).toEqual([true, true, true]); // a straight piece works both ways round
    expect(won(lv, [0, 0, 1])).toBe(false);
    expect(needed(lv, [0, 1, 0], 1)).toBe(1);
    expect(needed(lv, [0, 0, 3], 2)).toBe(1);
  });
  it('makes levels whose answer fills every piece, bigger as you go, the same for a seed', () => {
    for (const level of [1, 2, 4, 7, 10, 15]) {
      const l = makeLevel(level, 42);
      const [w, h] = sizeFor(level);
      expect([l.w, l.h]).toEqual([w, h]);
      const zero = l.pipes.map(() => 0);
      expect(won(l, zero)).toBe(true); // the answer
      const edges = l.pipes.reduce((s, m) => s + ((m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1)), 0) / 2;
      expect(edges).toBe(w * h - 1); // a tree: no loops
      expect(won(l, l.start)).toBe(false); // scrambled
      const fixed = l.start.map((k, i) => k + needed(l, l.start, i));
      expect(won(l, fixed)).toBe(true);
    }
    expect(makeLevel(3, 7)).toEqual(makeLevel(3, 7));
    expect(makeLevel(3, 7)).not.toEqual(makeLevel(3, 8));
  });
});
