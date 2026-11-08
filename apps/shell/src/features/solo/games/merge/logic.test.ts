import { describe, expect, it } from 'vitest';
import { canMerge, CELLS, cost, drop, earn, income, newFarm, summon, TIERS, totalIncome, type Farm } from './logic';

const farm = (cells: Record<number, number>, coins = 0): Farm => {
  const f = newFarm(1);
  const c = [...f.cells];
  for (const [i, v] of Object.entries(cells)) c[Number(i)] = v;
  return { ...f, cells: c, coins };
};

describe('Monster Merge', () => {
  it('summons an egg into a free cell for coins, the same cells for a seed', () => {
    const f = newFarm(5);
    const a = summon(f);
    expect(a.cells.filter(Boolean)).toEqual([1]);
    expect(a.coins).toBe(f.coins - cost(0));
    expect(a.summons).toBe(1);
    expect(summon(newFarm(5))).toEqual(a);
    expect(cost(1)).toBeGreaterThan(cost(0));
    expect(summon({ ...f, coins: 5 })).toEqual({ ...f, coins: 5 }); // too poor
    const full = { ...f, cells: Array(CELLS).fill(2), coins: 999 };
    expect(summon(full)).toBe(full);
  });

  it('merges two of a level into the next, up to the top level', () => {
    const f = farm({ 0: 1, 1: 1, 2: 2 });
    expect(canMerge(f, 0, 1)).toBe(true);
    expect(canMerge(f, 0, 2)).toBe(false);
    const m = drop(f, 0, 1);
    expect(m.cells.slice(0, 3)).toEqual([0, 2, 2]);
    expect(m.found).toBe(2);
    const m2 = drop(m, 1, 2);
    expect(m2.cells[2]).toBe(3);
    expect(m2.found).toBe(3);
    const top = farm({ 0: TIERS, 1: TIERS });
    expect(drop(top, 0, 1)).toBe(top);
  });

  it('moves into an empty cell, swaps with a different monster', () => {
    const f = farm({ 0: 3, 1: 5 });
    expect(drop(f, 0, 7).cells[7]).toBe(3);
    expect(drop(f, 0, 7).cells[0]).toBe(0);
    expect(drop(f, 0, 1).cells.slice(0, 2)).toEqual([5, 3]);
    expect(drop(f, 4, 0)).toBe(f); // nothing to pick up
  });

  it('earns coins over time: three times more each level, eggs earn nothing', () => {
    expect([1, 2, 3, 4].map(income)).toEqual([0, 1, 3, 9]);
    const f = { ...farm({ 0: 1, 1: 2, 2: 4 }), at: 1000 };
    expect(totalIncome(f)).toBe(10);
    const e = earn(f, 6500);
    expect(e.coins).toBe(50); // 5 whole seconds
    expect(e.at).toBe(6000);
    expect(earn(f, 1000 + 24 * 3600 * 1000).coins).toBe(8 * 3600 * 10); // at most 8 hours away
  });
});
