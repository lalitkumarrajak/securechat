import { describe, expect, it } from 'vitest';
import { base, BASE_W, COMBO, drop, grow, hueAt, PERFECT, reach, speedAt, swing, swingVelocity } from './logic';

describe('Stack Up', () => {
  const b = base();
  it('cuts off what hangs over, on either side', () => {
    expect(drop(b, { x: b.x + 30, w: b.w })).toEqual({ kind: 'cut', slab: { x: b.x + 30, w: b.w - 30 }, chip: { x: b.x + b.w, w: 30 } });
    expect(drop(b, { x: b.x - 50, w: b.w })).toEqual({ kind: 'cut', slab: { x: b.x, w: b.w - 50 }, chip: { x: b.x - 50, w: 50 } });
  });
  it('a drop within a few units is perfect: nothing is cut', () => {
    expect(drop(b, { x: b.x + PERFECT, w: b.w })).toEqual({ kind: 'perfect', slab: b });
    expect(drop(b, { x: b.x - 3, w: b.w }).kind).toBe('perfect');
    expect(drop(b, { x: b.x + PERFECT + 1, w: b.w }).kind).toBe('cut');
  });
  it('missing the block below entirely ends it', () => {
    expect(drop(b, { x: b.x + b.w, w: b.w }).kind).toBe('miss');
    expect(drop(b, { x: b.x - b.w - 1, w: b.w }).kind).toBe('miss');
  });
  it('a run of perfect drops grows the block back, to the base width at most', () => {
    const s = { x: 100, w: 60 };
    expect(grow(s, COMBO - 1)).toBe(s);
    expect(grow(s, COMBO)).toEqual({ x: 96, w: 68 });
    expect(grow({ x: 90, w: BASE_W - 2 }, 5).w).toBe(BASE_W);
  });
  it('slides across and back, far enough to miss, faster as the tower grows', () => {
    const w = 100, v = 200, a = reach(w);
    expect(swing(0, w, v, -1)).toBe(-a); // from the left
    expect(swing(0, w, v, 1)).toBe(a); // from the right
    expect(swing(a / v, w, v, -1)).toBeCloseTo(0); // over the middle
    expect(swing((2 * a) / v, w, v, -1)).toBeCloseTo(a); // the far side, then back
    expect(swing((3 * a) / v, w, v, -1)).toBeCloseTo(0);
    expect(swingVelocity(0.1, w, v, -1)).toBe(v);
    expect(swingVelocity((2.5 * a) / v, w, v, -1)).toBe(-v);
    expect(a).toBeGreaterThan(w);
    expect(speedAt(20)).toBeGreaterThan(speedAt(0));
    expect(speedAt(1000)).toBe(400);
  });
  it('colours turn as the tower climbs', () => {
    expect(hueAt(350, 0)).toBe(350);
    expect(hueAt(350, 2)).toBe(8);
  });
});
