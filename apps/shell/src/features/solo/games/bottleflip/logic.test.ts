import { describe, expect, it } from 'vitest';
import { at, chargeOf, firstPlat, holdFor, idealPower, launch, nextPlat, outcome, points, spinFor, tilt, UPRIGHT } from './logic';

describe('Flip It', () => {
  const from = firstPlat(), to = nextPlat(from, 0, 42), stand = { x: from.x, y: from.y };
  const throwWith = (p: number) => launch(p, stand, spinFor(stand, to));

  it('the charge rises while you hold, then falls back', () => {
    expect(chargeOf(0)).toBe(0);
    expect(chargeOf(holdFor(0.4))).toBeCloseTo(0.4);
    expect(chargeOf(holdFor(1))).toBeCloseTo(1);
    expect(chargeOf(holdFor(1.25))).toBeCloseTo(0.75);
  });
  it('the ideal throw lands upright in the middle of the next table', () => {
    const o = outcome(throwWith(idealPower(stand, to)), from, to);
    expect(o.kind).toBe('land');
    if (o.kind === 'miss') return;
    expect(o.on).toBe('to');
    expect(o.x).toBeCloseTo(to.x, 3);
    expect(Math.abs(tilt(o.angle))).toBeLessThan(0.01);
  });
  it('a little off still stands; too far off misses or tips over', () => {
    const p = idealPower(stand, to);
    expect(outcome(throwWith(p + 0.02), from, to).kind).toBe('land');
    expect(outcome(throwWith(p - 0.02), from, to).kind).toBe('land');
    expect(outcome(throwWith(p + 0.25), from, to).kind).not.toBe('land');
    expect(outcome(throwWith(0.005), from, to).kind).toBe('miss'); // a tap: off the edge of its own table
  });
  it('landing on the table but not upright tips over', () => {
    const fast = launch(idealPower(stand, to), stand, spinFor(stand, to) * 1.3);
    const o = outcome(fast, from, to);
    expect(o.kind).toBe('tip');
  });
  it('tilt is how far from upright, either way', () => {
    expect(tilt(2 * Math.PI)).toBeCloseTo(0);
    expect(tilt(2 * Math.PI + 0.3)).toBeCloseTo(0.3);
    expect(tilt(2 * Math.PI - 0.3)).toBeCloseTo(-0.3);
    expect(UPRIGHT).toBeLessThan(0.5);
  });
  it('flies in an arc: up, then down', () => {
    const l = throwWith(0.5);
    expect(at(l, 0.2).y).toBeLessThan(l.y0);
    expect(at(l, 0.2).x).toBeGreaterThan(l.x0);
  });
  it('scores 1, or more for perfects in a row', () => {
    expect(points(20, 3)).toEqual({ perfect: false, streak: 0, points: 1 });
    expect(points(2, 0)).toEqual({ perfect: true, streak: 1, points: 2 });
    expect(points(-3, 1)).toEqual({ perfect: true, streak: 2, points: 3 });
    expect(points(0, 9).points).toBe(4);
  });
  it('tables are reachable, separate, narrower further on, and the same for a seed', () => {
    let pl = firstPlat();
    for (let n = 0; n < 40; n++) {
      const nx = nextPlat(pl, n, 7);
      const p = idealPower({ x: pl.x, y: pl.y }, nx);
      expect(p).toBeGreaterThan(0.15);
      expect(p).toBeLessThan(0.85);
      expect(nx.x - nx.w / 2).toBeGreaterThan(pl.x + pl.w / 2);
      pl = nx;
    }
    expect(nextPlat(firstPlat(), 30, 1).w).toBeLessThan(nextPlat(firstPlat(), 0, 1).w);
    expect(nextPlat(firstPlat(), 3, 5)).toEqual(nextPlat(firstPlat(), 3, 5));
  });
});
