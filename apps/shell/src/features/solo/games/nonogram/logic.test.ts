import { describe, expect, it } from 'vitest';
import { PICTURES, clues, lineOk, puzzleFor, runs, solve, solveLine, won } from './logic';

describe('Picture Cross', () => {
  it('counts the runs in a line', () => {
    expect(runs([true, true, false, true])).toEqual([2, 1]);
    expect(runs([false, false])).toEqual([]);
    expect(lineOk([true, false, true], [1, 1])).toBe(true);
    expect(lineOk([true, true, false], [1, 1])).toBe(false);
  });
  it('works out what a line must be', () => {
    expect(solveLine([4], [-1, -1, -1, -1, -1])).toEqual([-1, 1, 1, 1, -1]); // the overlap
    expect(solveLine([1, 1], [-1, -1, -1])).toEqual([1, 0, 1]);
    expect(solveLine([2], [-1, 1, -1, -1, 0])).toEqual([-1, 1, -1, 0, 0]);
    expect(solveLine([], [-1, -1])).toEqual([0, 0]);
    expect(solveLine([3], [-1, 0, -1, -1])).toBeNull(); // no room
  });
  it('every picture has the same width on each row, and only one answer, which a line solver finds', () => {
    for (const p of PICTURES) {
      expect(new Set(p.rows.map((r) => r.length)).size, p.name).toBe(1);
      const pz = { name: p.name, colour: p.colour, w: p.rows[0].length, h: p.rows.length, cells: p.rows.flatMap((r) => [...r].map((c) => c === '#')) };
      const c = clues(pz);
      expect(solve(c.rows, c.cols), p.name).toEqual(pz.cells);
    }
  });
  it('levels go small to big, then round again mirrored', () => {
    expect(puzzleFor(1).w).toBe(5);
    expect(puzzleFor(PICTURES.length).w).toBe(10);
    const a = puzzleFor(1), b = puzzleFor(PICTURES.length + 1);
    expect(b.cells).toEqual(a.cells.map((_, i) => a.cells[Math.floor(i / a.w) * a.w + (a.w - 1 - (i % a.w))]));
    expect(won(a, a.cells)).toBe(true);
    expect(won(a, a.cells.map((x, i) => (i === 0 ? !x : x)))).toBe(false);
  });
});
