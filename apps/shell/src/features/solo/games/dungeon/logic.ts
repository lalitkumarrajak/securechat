// Dungeon Deck: a 3×3 grid of cards with you in it. Step onto a card next to you: monsters hurt you by
// their strength unless your weapon blocks it (the weapon wears down by what it blocks), potions heal,
// gold scores, traps hurt whatever you hold, chests hide gold, a potion or a monster. The card you left
// is replaced; stairs take you a floor deeper, where everything is stronger. Pure functions: logic.test.ts.
import { rng } from '../../kit';

export type Kind = 'monster' | 'weapon' | 'potion' | 'gold' | 'trap' | 'chest' | 'stairs';
export interface DCard { kind: Kind; v: number; id: number; inside?: 'gold' | 'potion' | 'monster' }
export type Event =
  | { kind: 'start' }
  | { kind: 'monster'; v: number; dmg: number; gold: number; chest?: boolean }
  | { kind: 'weapon'; v: number } | { kind: 'potion'; v: number; chest?: boolean } | { kind: 'gold'; v: number; chest?: boolean }
  | { kind: 'trap'; v: number } | { kind: 'stairs'; floor: number };
export interface Dungeon {
  seed: number; drawn: number; cells: DCard[]; hero: number;
  hp: number; maxHp: number; weapon: number; gold: number; floor: number; steps: number; turns: number; last: Event;
}

export const STAIRS_AFTER = 10; // steps on a floor before the way down shows up

/** The k-th card of this game, by seed: monsters 4 in 10, then gold, potions, weapons, traps, chests. */
export function draw(seed: number, k: number, floor: number, stairs: boolean): DCard {
  if (stairs) return { kind: 'stairs', v: floor + 1, id: k };
  const r = rng(Math.imul(seed, 40503) + k * 7919);
  const roll = r.int(100);
  const cap = (n: number, max: number) => Math.min(max, n);
  if (roll < 42) return { kind: 'monster', v: cap(1 + Math.floor(floor / 2) + r.int(3 + floor), 13), id: k };
  if (roll < 58) return { kind: 'gold', v: 1 + r.int(2 + floor * 2), id: k };
  if (roll < 70) return { kind: 'potion', v: 2 + r.int(3), id: k };
  if (roll < 82) return { kind: 'weapon', v: cap(1 + r.int(3 + floor), 10), id: k };
  if (roll < 91) return { kind: 'trap', v: cap(1 + r.int(2 + floor), 8), id: k };
  const i = r.int(10);
  return { kind: 'chest', v: 1 + r.int(2 + floor), id: k, inside: i < 5 ? 'gold' : i < 8 ? 'potion' : 'monster' };
}

function fill(d: Dungeon, at: number) {
  const stairs = d.steps >= STAIRS_AFTER && !d.cells.some((c) => c?.kind === 'stairs');
  d.cells[at] = draw(d.seed, d.drawn++, d.floor, stairs);
}

function deal(d: Dungeon) {
  for (let i = 0; i < 9; i++) if (i !== d.hero) fill(d, i);
  d.cells[d.hero] = { kind: 'gold', v: 0, id: -1 }; // where you stand: never shown
}

export function newRun(seed: number): Dungeon {
  const d: Dungeon = { seed, drawn: 0, cells: [], hero: 4, hp: 10, maxHp: 10, weapon: 0, gold: 0, floor: 1, steps: 0, turns: 0, last: { kind: 'start' } };
  deal(d);
  return d;
}

export const adjacent = (a: number, b: number) => Math.abs((a % 3) - (b % 3)) + Math.abs(Math.floor(a / 3) - Math.floor(b / 3)) === 1;
export const over = (d: Dungeon) => d.hp <= 0;

/** A fight: the weapon blocks up to its value and loses what it blocked; the rest hurts. */
export function fight(weapon: number, v: number) {
  const blocked = Math.min(weapon, v);
  return { dmg: v - blocked, weapon: weapon - blocked };
}

/** Step onto the card at `to` (next to you). */
export function step(d0: Dungeon, to: number): Dungeon {
  if (over(d0) || !adjacent(d0.hero, to)) return d0;
  const d: Dungeon = { ...d0, cells: [...d0.cells] };
  const c = d.cells[to];
  const from = d.hero;
  const monster = (v: number, chest?: boolean) => {
    const f = fight(d.weapon, v);
    d.weapon = f.weapon; d.hp -= f.dmg; d.gold += v;
    d.last = { kind: 'monster', v, dmg: f.dmg, gold: v, chest };
  };
  switch (c.kind) {
    case 'monster': monster(c.v); break;
    case 'weapon': d.weapon = c.v; d.last = { kind: 'weapon', v: c.v }; break;
    case 'potion': d.hp = Math.min(d.maxHp, d.hp + c.v); d.last = { kind: 'potion', v: c.v }; break;
    case 'gold': d.gold += c.v; d.last = { kind: 'gold', v: c.v }; break;
    case 'trap': d.hp -= c.v; d.last = { kind: 'trap', v: c.v }; break;
    case 'chest':
      if (c.inside === 'monster') monster(c.v + 1, true);
      else if (c.inside === 'potion') { d.hp = Math.min(d.maxHp, d.hp + c.v + 1); d.last = { kind: 'potion', v: c.v + 1, chest: true }; }
      else { d.gold += c.v * 2 + 2; d.last = { kind: 'gold', v: c.v * 2 + 2, chest: true }; }
      break;
    case 'stairs':
      d.floor++; d.steps = 0; d.maxHp++; d.hp = Math.min(d.maxHp, d.hp + 2); d.hero = to; d.turns++;
      d.last = { kind: 'stairs', floor: d.floor };
      deal(d);
      return d;
  }
  d.hp = Math.max(0, d.hp);
  d.hero = to; d.steps++; d.turns++;
  d.cells[to] = d.cells[from];
  fill(d, from);
  return d;
}
