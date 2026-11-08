// Flip It's rules, without drawing. Hold to charge (the charge rises and falls while you hold), let go:
// the bottle flies in an arc and turns over once. It turns at the speed that lands it upright on the
// middle of the next table, so too little or too much power lands it off the table or not upright.
// Units: y grows downward; a table is its middle x, its top y and its width.
import { rng } from '../../kit';

export const G = 1500;                    // gravity
export const ANGLE = (64 * Math.PI) / 180; // the throw's angle from the ground
export const HALF_H = 30;                  // half the bottle's height
export const CHARGE_MS = 1200;             // holding this long charges fully; then it falls back
export const UPRIGHT = 0.42;               // radians either side of upright that still stand
export const PERFECT = 7;                  // this close to a table's middle: perfect

export interface Plat { x: number; y: number; w: number; look: number }
export interface Point { x: number; y: number }
export interface Throw { x0: number; y0: number; vx: number; vy: number; spin: number }
export interface Landing { kind: 'land' | 'tip'; on: 'to' | 'from'; t: number; x: number; angle: number }
export type Outcome = Landing | { kind: 'miss' };

/** Charge after holding `ms`: 0→1 over CHARGE_MS, then back down, and so on. */
export function chargeOf(ms: number) {
  const c = (Math.max(0, ms) / CHARGE_MS) % 2;
  return c <= 1 ? c : 2 - c;
}
export const holdFor = (p: number) => p * CHARGE_MS;
const speedOf = (p: number) => 320 + 620 * p;

/** The throw from a bottle standing at `at` (its base) with charge p, turning at `spin` rad/s. */
export function launch(p: number, at: Point, spin: number): Throw {
  const s = speedOf(p);
  return { x0: at.x, y0: at.y - HALF_H, vx: s * Math.cos(ANGLE), vy: -s * Math.sin(ANGLE), spin };
}
/** Where the bottle's middle is, and its turn, t seconds into the throw. */
export const at = (l: Throw, t: number) => ({ x: l.x0 + l.vx * t, y: l.y0 + l.vy * t + 0.5 * G * t * t, angle: l.spin * t });

/** When, coming down, the bottle's base reaches height `top` (null if it never gets that high). */
export function timeAtTop(l: Throw, top: number): number | null {
  const y = top - HALF_H, d = l.vy * l.vy + 2 * G * (y - l.y0);
  return d < 0 ? null : (-l.vy + Math.sqrt(d)) / G;
}

/** The charge that lands the bottle on the middle of `to`, from standing at `from`. */
export function idealPower(from: Point, to: Plat) {
  let lo = 0, hi = 1;
  for (let i = 0; i < 50; i++) {
    const p = (lo + hi) / 2, l = launch(p, from, 0), t = timeAtTop(l, to.y);
    if (t === null || at(l, t).x < to.x) lo = p; else hi = p;
  }
  return (lo + hi) / 2;
}

/** How fast it turns: once over exactly in the flight of the ideal throw. */
export function spinFor(from: Point, to: Plat) {
  const t = timeAtTop(launch(idealPower(from, to), from, 0), to.y)!;
  return (2 * Math.PI) / t;
}

/** -π..π: how far from upright. */
export const tilt = (a: number) => { const r = ((a % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI; return r; };

/** Where a throw ends: on the next table (upright or tipping over), back on this one, or nowhere. */
export function outcome(l: Throw, from: Plat, to: Plat): Outcome {
  const edge = (pl: Plat, x: number) => Math.abs(x - pl.x) <= pl.w / 2 - 3;
  const tryOn = (pl: Plat, on: 'to' | 'from'): Landing | null => {
    const t = timeAtTop(l, pl.y);
    if (t === null) return null;
    const p = at(l, t);
    if (!edge(pl, p.x)) return null;
    return { kind: Math.abs(tilt(p.angle)) <= UPRIGHT ? 'land' : 'tip', on, t, x: p.x, angle: p.angle };
  };
  const a = tryOn(to, 'to'), b = tryOn(from, 'from');
  if (a && b) return a.t < b.t ? a : b;
  return a ?? b ?? { kind: 'miss' };
}

/** Points for landing `off` units from the middle of a table, with `streak` perfect landings before it. */
export function points(off: number, streak: number) {
  const perfect = Math.abs(off) <= PERFECT;
  const s = perfect ? streak + 1 : 0;
  return { perfect, streak: s, points: perfect ? 1 + Math.min(s, 3) : 1 };
}

/** The first table, and each next one: further and narrower as you go, never out of reach. */
export const firstPlat = (): Plat => ({ x: 0, y: 0, w: 100, look: 0 });
export function nextPlat(prev: Plat, n: number, seed: number): Plat {
  const r = rng(seed * 7919 + n * 104729);
  const w = Math.max(48, 96 - n * 2.5);
  for (let i = 0; i < 30; i++) {
    const dx = 150 + r.next() * 110 + Math.min(n, 15) * 3, dy = (r.next() - 0.55) * 130;
    const to = { x: prev.x + dx, y: prev.y + dy, w, look: (prev.look + 1 + r.int(3)) % 4 };
    const p = idealPower({ x: prev.x, y: prev.y }, to);
    if (p > 0.2 && p < 0.8 && dx - w / 2 - prev.w / 2 > 40) return to;
  }
  return { x: prev.x + 180, y: prev.y, w, look: (prev.look + 1) % 4 };
}
