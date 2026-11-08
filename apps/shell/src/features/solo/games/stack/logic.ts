// Stack Up's rules, without drawing: where the sliding block is at a moment, what's left of it when
// dropped (the overhang is cut off), perfect drops, and how fast it slides as the tower grows.
// Units: the play area is FIELD wide; x is a block's left edge.

export const FIELD = 360;
export const BASE_W = 180;
export const BLOCK_H = 26;
export const PERFECT = 4;   // dropped this close: counts as exact, nothing cut
export const GROW = 8;      // after COMBO perfect drops in a row, the block grows back this much
export const COMBO = 3;

export interface Slab { x: number; w: number }
export type Drop =
  | { kind: 'miss' }
  | { kind: 'perfect'; slab: Slab }
  | { kind: 'cut'; slab: Slab; chip: Slab };

export const base = (): Slab => ({ x: (FIELD - BASE_W) / 2, w: BASE_W });

/** Drop `cur` onto `prev`: what stays on the tower, and the piece that falls. */
export function drop(prev: Slab, cur: Slab, tol = PERFECT): Drop {
  if (Math.abs(cur.x - prev.x) <= tol) return { kind: 'perfect', slab: { x: prev.x, w: Math.min(cur.w, prev.w) } };
  const l = Math.max(prev.x, cur.x), r = Math.min(prev.x + prev.w, cur.x + cur.w);
  if (r - l <= 0.5) return { kind: 'miss' };
  const chip = cur.x > prev.x ? { x: r, w: cur.x + cur.w - r } : { x: cur.x, w: l - cur.x };
  return { kind: 'cut', slab: { x: l, w: r - l }, chip };
}

/** A run of perfect drops grows the block back a little, about its middle, up to the base width. */
export function grow(s: Slab, combo: number): Slab {
  if (combo < COMBO || s.w >= BASE_W) return s;
  const w = Math.min(BASE_W, s.w + GROW);
  return { x: s.x - (w - s.w) / 2, w };
}

/** Sliding speed (units a second) at a tower height: faster as it grows, to a limit. */
export const speedAt = (height: number) => Math.min(125 + height * 7, 400);

/** How far the slider swings either side of the block under it: far enough to miss completely. */
export const reach = (w: number) => w + 26;

/** The slider's offset from the block under it, `t` seconds after it appeared on side `side`
 *  (-1: from the left). It slides across and back, again and again. */
export function swing(t: number, w: number, speed: number, side: 1 | -1) {
  const a = reach(w), span = 2 * a;
  const d = (speed * Math.max(0, t)) % (2 * span);
  const off = d < span ? -a + d : a - (d - span);
  return off * -side;
}

/** Its velocity at that moment (for tests to time a tap). */
export function swingVelocity(t: number, w: number, speed: number, side: 1 | -1) {
  const span = 2 * reach(w), d = (speed * Math.max(0, t)) % (2 * span);
  return (d < span ? speed : -speed) * -side;
}

/** The tower's colours: a hue that turns as you climb, starting somewhere set by the seed. */
export const hueAt = (start: number, level: number) => (start + level * 9) % 360;
