import { describe, expect, it } from 'vitest';
import { angleAt, apart, FLIGHT, GAP, hits, isBoss, land, landsAt, makeStage, norm, POINTS, prizeAt, startStage, type Spin } from './logic';

describe('Dart Spin', () => {
  it('measures angles around the circle', () => {
    expect(apart(0.1, Math.PI * 2 - 0.1)).toBeCloseTo(0.2);
    expect(apart(1, 1 + Math.PI)).toBeCloseTo(Math.PI);
    expect(norm(-0.5)).toBeCloseTo(Math.PI * 2 - 0.5);
  });
  it('a dart touching another (closer than the gap) bounces off', () => {
    expect(hits([1], 1 + GAP * 0.9)).toBe(true);
    expect(hits([1], 1 - GAP * 1.1)).toBe(false);
    expect(hits([0.05], Math.PI * 2 - 0.05)).toBe(true); // across zero
    expect(hits([], 2)).toBe(false);
  });
  it('lands where the bottom of the wheel is when the dart arrives', () => {
    const steady: Spin = { a: 2, b: 0, k: 1, ph: 0, dir: 1 };
    expect(angleAt(steady, 0)).toBe(0);
    expect(landsAt(steady, 0)).toBeCloseTo(norm(Math.PI / 2 - 2 * FLIGHT));
    expect(landsAt(steady, 1)).toBeCloseTo(norm(Math.PI / 2 - 2 * (1 + FLIGHT)));
    const swing: Spin = { a: 1, b: 2, k: 1, ph: 0, dir: -1 };
    const speed = (t: number) => (angleAt(swing, t + 1e-4) - angleAt(swing, t)) / 1e-4;
    expect(Math.sign(speed(0))).not.toBe(Math.sign(speed(Math.PI))); // turns back
  });
  it('takes a prize on the rim', () => {
    expect(prizeAt([2, 4], 4.1)).toBe(1);
    expect(prizeAt([2, 4], 3)).toBe(-1);
  });
  it('scores darts and prizes; the last dart clears the stage; a hit ends it', () => {
    let p = startStage(1, 9);
    expect(p.stuck).toEqual([]);
    const prize = p.prizes[0];
    let r = land(p, prize);
    expect(r.result).toBe('stick');
    expect(r.play.score).toBe(POINTS.dart + POINTS.prize);
    expect(r.play.prizes).toEqual([]);
    p = r.play;
    expect(land(p, prize + GAP / 2).result).toBe('hit');
    for (let i = 1; i < p.stage.darts; i++) {
      r = land(p, norm(prize + i * (GAP + 0.05)));
      p = r.play;
    }
    expect(r.result).toBe('clear');
    expect(p.score).toBe(p.stage.darts * POINTS.dart + POINTS.prize);
  });
  it('a boss wheel every fifth stage, harder as you go, the same for a seed', () => {
    expect([1, 4, 5, 10].map(isBoss)).toEqual([false, false, true, true]);
    const one = makeStage(1, 3), four = makeStage(4, 3), five = makeStage(5, 3);
    expect(one.stuck).toHaveLength(0);
    expect(four.stuck.length).toBeGreaterThan(0);
    expect(five.boss).toBe(true);
    expect(five.spin.b * five.spin.k).toBeGreaterThan(five.spin.a); // a boss swings back and forth
    expect(makeStage(9, 3).spin.a).toBeGreaterThan(one.spin.a);
    expect(makeStage(6, 11)).toEqual(makeStage(6, 11));
    for (let n = 1; n < 30; n++) {
      const s = makeStage(n, 5);
      for (const [i, a] of s.stuck.entries()) for (const b of s.stuck.slice(i + 1)) expect(apart(a, b)).toBeGreaterThan(GAP);
      for (const p of s.prizes) expect(hits(s.stuck, p)).toBe(false);
    }
  });
  it('a boss wheel beaten is worth extra', () => {
    let p = startStage(5, 2), r = land(p, 0);
    for (let i = 0; i < p.stage.darts; i++) {
      const free = Array.from({ length: 360 }, (_, k) => (k / 360) * Math.PI * 2).find((a) => !hits(p.stuck, a))!;
      r = land(p, free); p = r.play;
    }
    expect(r.result).toBe('clear');
    expect(p.score).toBeGreaterThanOrEqual(p.stage.darts * POINTS.dart + POINTS.boss);
  });
});
