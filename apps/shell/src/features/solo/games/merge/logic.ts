// Monster Merge: a 5×6 field. Summon an egg (level 1) for coins; drop a monster on an identical one
// and they merge into the next level, up to level 12. Every monster from level 2 earns coins each
// second, three times more per level. Pure functions, no React: see logic.test.ts.
import { rng } from '../../kit';

export const COLS = 5, ROWS = 6, CELLS = COLS * ROWS, TIERS = 12;
export interface Farm { cells: number[]; coins: number; summons: number; found: number; seed: number; at: number }

export const newFarm = (seed: number, now = 0): Farm => ({ cells: Array(CELLS).fill(0), coins: 60, summons: 0, found: 1, seed, at: now });

/** Coins a second from one monster of this level: 0 for an egg, then 1, 3, 9, 27… */
export const income = (tier: number) => (tier < 2 ? 0 : 3 ** (tier - 2));
export const totalIncome = (f: Farm) => f.cells.reduce((s, c) => s + income(c), 0);
/** The next summon's price grows slowly with every summon. */
export const cost = (summons: number) => Math.round(10 + summons * 2 + (summons * summons) / 40);

/** An egg in a free cell (picked by the seed), if you can pay and there's room. */
export function summon(f: Farm): Farm {
  const free = f.cells.flatMap((c, i) => (c ? [] : [i]));
  const price = cost(f.summons);
  if (!free.length || f.coins < price) return f;
  const at = free[rng(Math.imul(f.seed, 69069) + f.summons).int(free.length)];
  const cells = [...f.cells];
  cells[at] = 1;
  return { ...f, cells, coins: f.coins - price, summons: f.summons + 1 };
}

export const canMerge = (f: Farm, a: number, b: number) => a !== b && f.cells[a] > 0 && f.cells[a] === f.cells[b] && f.cells[a] < TIERS;

/** Drop the monster at `a` on `b`: the same level merges, an empty cell takes it, another monster swaps. */
export function drop(f: Farm, a: number, b: number): Farm {
  if (a === b || !f.cells[a]) return f;
  const cells = [...f.cells];
  if (canMerge(f, a, b)) {
    const tier = cells[b] + 1;
    cells[b] = tier; cells[a] = 0;
    return { ...f, cells, found: Math.max(f.found, tier), coins: f.coins + tier * tier }; // a small reward for every merge
  }
  if (cells[a] === cells[b]) return f; // two at the top level: nothing more to make
  [cells[a], cells[b]] = [cells[b], cells[a]];
  return { ...f, cells };
}

/** Coins earned since `f.at` (at most 8 hours away count). */
export function earn(f: Farm, now: number): Farm {
  if (!f.at || now - f.at > 8 * 3600_000) return { ...f, coins: f.at ? f.coins + 8 * 3600 * totalIncome(f) : f.coins, at: now };
  const secs = Math.max(0, Math.floor((now - f.at) / 1000));
  return secs ? { ...f, coins: f.coins + secs * totalIncome(f), at: f.at + secs * 1000 } : f;
}
