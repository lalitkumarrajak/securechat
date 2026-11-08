import { describe, expect, it } from 'vitest';
import { adjacent, draw, fight, newRun, over, step, STAIRS_AFTER, type DCard, type Dungeon } from './logic';

const at = (d: Dungeon, i: number, c: Omit<DCard, 'id'>): Dungeon => { const cells = [...d.cells]; cells[i] = { ...c, id: 999 }; return { ...d, cells }; };

describe('Dungeon Deck', () => {
  it('starts in the middle with 10 health, the same cards for a seed', () => {
    const d = newRun(3);
    expect(d.hero).toBe(4);
    expect(d.hp).toBe(10);
    expect(d.cells).toHaveLength(9);
    expect(newRun(3)).toEqual(newRun(3));
    expect(newRun(3).cells).not.toEqual(newRun(4).cells);
  });

  it('only steps to a card next to you (not diagonally)', () => {
    expect(adjacent(4, 1)).toBe(true);
    expect(adjacent(4, 0)).toBe(false);
    expect(adjacent(2, 3)).toBe(false); // end of one row, start of the next
    const d = newRun(1);
    expect(step(d, 0)).toBe(d);
  });

  it('fights: the weapon blocks and wears down, the rest hurts, and the monster pays gold', () => {
    expect(fight(0, 4)).toEqual({ dmg: 4, weapon: 0 });
    expect(fight(5, 3)).toEqual({ dmg: 0, weapon: 2 });
    expect(fight(2, 6)).toEqual({ dmg: 4, weapon: 0 });
    const d = at({ ...newRun(1), weapon: 2 }, 1, { kind: 'monster', v: 5 });
    const n = step(d, 1);
    expect(n.hp).toBe(7);
    expect(n.weapon).toBe(0);
    expect(n.gold).toBe(5);
    expect(n.hero).toBe(1);
    expect(n.cells[4].id).toBe(d.drawn); // the card you left is replaced
    expect(n.drawn).toBe(d.drawn + 1);
  });

  it('potions heal up to the most, weapons replace yours, traps ignore your weapon', () => {
    const d = { ...newRun(1), hp: 8, weapon: 6 };
    expect(step(at(d, 5, { kind: 'potion', v: 4 }), 5).hp).toBe(10);
    expect(step(at(d, 5, { kind: 'weapon', v: 3 }), 5).weapon).toBe(3);
    const t = step(at(d, 5, { kind: 'trap', v: 3 }), 5);
    expect(t.hp).toBe(5);
    expect(t.weapon).toBe(6);
    expect(step(at(d, 7, { kind: 'gold', v: 4 }), 7).gold).toBe(4);
    expect(step(at(d, 7, { kind: 'chest', v: 2, inside: 'gold' }), 7).gold).toBe(6);
    expect(step(at(d, 7, { kind: 'chest', v: 2, inside: 'monster' }), 7).weapon).toBe(3);
  });

  it('the game is over at 0 health', () => {
    const d = step(at({ ...newRun(1), hp: 3 }, 3, { kind: 'monster', v: 9 }), 3);
    expect(d.hp).toBe(0);
    expect(over(d)).toBe(true);
    expect(step(d, 4)).toBe(d);
  });

  it('stairs show up after a while and lead to a stronger floor', () => {
    let d = newRun(11);
    for (let i = 0; i < 200 && !d.cells.some((c) => c.kind === 'stairs'); i++) {
      d = { ...d, hp: 99 };
      d = step(d, [1, 3, 5, 7].map((o) => (d.hero + o - 4)).find((x) => x >= 0 && x < 9 && adjacent(d.hero, x))!);
    }
    expect(d.steps).toBeGreaterThanOrEqual(STAIRS_AFTER);
    const s = d.cells.findIndex((c) => c.kind === 'stairs');
    let n = d; // walk there, row first, then column (the stairs stay put until you step on them)
    for (let i = 0; i < 4 && n.floor === 1; i++) {
      const h = n.hero, sr = Math.floor(s / 3), sc = s % 3, hr = Math.floor(h / 3), hc = h % 3;
      n = step({ ...n, hp: 99 }, hr !== sr ? h + (sr > hr ? 3 : -3) : h + (sc > hc ? 1 : -1));
    }
    expect(n.floor).toBe(2);
    expect(n.steps).toBe(0);
    const avg = (f: number) => { let s = 0, k = 0; for (let i = 0; i < 2000; i++) { const c = draw(5, i, f, false); if (c.kind === 'monster') { s += c.v; k++; } } return s / k; };
    expect(avg(4)).toBeGreaterThan(avg(1) + 2);
  });
});
