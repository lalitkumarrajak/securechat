import { describe, expect, it } from 'vitest';
import {
  DT, FOES, LIVES, MAPS, WAVES, along, build, hpScale, newTD, pathCells, sell, sellValue, startWave, stats, step, target, towerAt, upgrade, upgradeCost, waveOf,
  type Kind, type TD,
} from './logic';

const run = (s: TD, seconds: number) => { for (let i = 0; i < Math.round(seconds / DT); i++) step(s, DT); };
const untilBuild = (s: TD) => { for (let i = 0; i < 30 * 600 && s.phase === 'wave'; i++) step(s, DT); };
/** The empty spot that sees the most path within range r of it. */
function bestSpot(s: TD, r: number) {
  const cells = [...pathCells(s.map)].map((k) => k.split(',').map(Number));
  let best = -1, score = -1;
  s.spots.forEach((p, i) => {
    if (towerAt(s, i)) return;
    const n = cells.filter(([c, rr]) => Math.hypot(c - p.x, rr - p.y) <= r).length;
    if (n > score) { score = n; best = i; }
  });
  return best;
}
/** A fair player: builds a mix of towers where they see most path, then upgrades. */
function play(map: number) {
  const s = newTD(map);
  const order: Kind[] = ['fast', 'fast', 'splash', 'slow', 'sniper', 'fast', 'splash', 'sniper'];
  let k = 0;
  while (s.phase === 'build') {
    for (;;) {
      const kind = order[k % order.length];
      const spot = bestSpot(s, stats(kind, 1).range);
      if (spot >= 0 && build(s, spot, kind)) { k++; continue; }
      const tw = [...s.towers].sort((a, b) => a.level - b.level)[0];
      if (s.towers.length >= 8 && tw && upgrade(s, tw.id)) continue;
      break;
    }
    startWave(s);
    untilBuild(s);
  }
  return s;
}

describe('Tower Guard', () => {
  it('enemies follow the path from start to end', () => {
    const s = newTD(0);
    expect(along(s, 0)).toEqual({ x: -0.5, y: 1.5 });
    expect(along(s, 7)).toEqual({ x: 6.5, y: 1.5 }); // the first corner
    expect(along(s, 8)).toEqual({ x: 6.5, y: 2.5 }); // turned down
    expect(along(s, s.total)).toEqual({ x: 3.5, y: 12.5 });
    startWave(s);
    run(s, 0.1);
    const e = s.enemies[0];
    run(s, 3);
    expect(e.d).toBeCloseTo(3.1, 1); // walkers go a cell a second
  });

  it('build spots sit beside the path, never on it', () => {
    for (let m = 0; m < MAPS.length; m++) {
      const s = newTD(m), on = pathCells(m);
      expect(s.spots.length).toBeGreaterThan(20);
      for (const p of s.spots) expect(on.has(`${p.x},${p.y}`)).toBe(false);
    }
  });

  it('towers cost coins, upgrade, and sell back for less', () => {
    const s = newTD(0);
    expect(s.coins).toBe(90);
    expect(build(s, 0, 'fast')).toBe(true);
    expect(build(s, 0, 'slow')).toBe(false); // taken
    expect(s.coins).toBe(70);
    const tw = s.towers[0];
    expect(upgrade(s, tw.id)).toBe(true);
    expect(s.coins).toBe(70 - 15);
    expect(tw.level).toBe(2);
    expect(stats('fast', 2).dmg).toBeGreaterThan(stats('fast', 1).dmg);
    expect(upgradeCost(tw)).toBe(30);
    expect(sellValue(tw)).toBe(24);
    expect(sell(s, tw.id)).toBe(true);
    expect(s.coins).toBe(55 + 24);
    s.coins = 10;
    expect(build(s, 1, 'sniper')).toBe(false); // can't afford
  });

  it('a tower aims at the enemy furthest along the path within its range', () => {
    const s = newTD(0);
    s.enemies = [
      { id: 1, foe: 'walker', hp: 10, max: 10, d: 2, slow: 0 },
      { id: 2, foe: 'walker', hp: 10, max: 10, d: 4, slow: 0 },
      { id: 3, foe: 'walker', hp: 10, max: 10, d: 12, slow: 0 },
    ];
    expect(target(s, { x: 3, y: 2.5 }, 2)?.id).toBe(2);
    expect(target(s, { x: 3, y: 2.5 }, 10)?.id).toBe(3);
    expect(target(s, { x: 0, y: 11 }, 1)).toBeNull();
  });

  it('damage, splash and slow', () => {
    const at = (kind: Kind) => {
      const s = newTD(0);
      const spot = s.spots.findIndex((p) => p.x === 2 && p.y === 2); // just below the first stretch
      build(s, spot, kind);
      s.phase = 'wave'; s.queue = [{ foe: 'brute', at: 99 }];
      s.enemies = [
        { id: 1, foe: 'brute', hp: 100, max: 100, d: 3.5, slow: 0 },
        { id: 2, foe: 'brute', hp: 100, max: 100, d: 3.0, slow: 0 },
        { id: 3, foe: 'brute', hp: 100, max: 100, d: 0.5, slow: 0 },
      ];
      step(s, DT);
      return s.enemies;
    };
    const fast = at('fast');
    expect(fast.map((e) => e.hp)).toEqual([97, 100, 100]);
    const boom = at('splash');
    expect(boom.map((e) => e.hp)).toEqual([93, 93, 100]); // both close ones, not the far one
    const cold = at('slow');
    expect(cold[0].slow).toBeGreaterThan(1);
    const s = newTD(0);
    s.phase = 'wave'; s.queue = [{ foe: 'walker', at: 99 }];
    s.enemies = [{ id: 1, foe: 'walker', hp: 10, max: 10, d: 0, slow: 2 }, { id: 2, foe: 'walker', hp: 10, max: 10, d: 0, slow: 0 }];
    run(s, 1);
    expect(s.enemies[0].d).toBeCloseTo(s.enemies[1].d / 2, 1);
  });

  it('waves grow, kills pay, a cleared wave pays a bonus', () => {
    expect(waveOf(1)).toHaveLength(6);
    expect(waveOf(6).some((x) => x.foe === 'boss')).toBe(true);
    expect(waveOf(10).length).toBeGreaterThan(waveOf(3).length);
    expect(hpScale(0, 5)).toBeGreaterThan(hpScale(0, 1));
    const s = newTD(0);
    build(s, bestSpot(s, 2.2), 'fast');
    build(s, bestSpot(s, 2.2), 'fast');
    build(s, bestSpot(s, 2), 'splash');
    const coins = s.coins;
    expect(startWave(s)).toBe(true);
    expect(startWave(s)).toBe(false); // one at a time
    untilBuild(s);
    expect(s.phase).toBe('build');
    expect(s.wave).toBe(1);
    expect(s.kills).toBe(6);
    expect(s.lives).toBe(LIVES);
    expect(s.coins).toBe(coins + 6 * FOES.walker.reward + 6);
  });

  it('enemies that get through cost lives; with no towers the map is lost', () => {
    const s = newTD(0);
    startWave(s);
    untilBuild(s);
    expect(s.lives).toBe(LIVES - 6);
    while (s.phase === 'build') { startWave(s); untilBuild(s); }
    expect(s.phase).toBe('lost');
    expect(s.lives).toBe(0);
    expect(build(s, 0, 'fast')).toBe(false);
  });

  it('every map can be won by a fair player', () => {
    for (let m = 0; m < MAPS.length; m++) {
      const s = play(m);
      expect([m, s.phase, s.wave]).toEqual([m, 'won', WAVES]);
    }
  });
});
