// Dart Spin's rules, without drawing. The wheel's turn is a formula of time (steady, speeding up and
// slowing, or swinging back and forth), so where a dart lands is exact whatever the frame rate.
// Angles are measured on the wheel: a dart thrown from below lands at the bottom (π/2 in screen
// terms) of the wheel as it is when the dart arrives.
import { rng } from '../../kit';

export const FLIGHT = 0.09; // seconds from the hand to the wheel
export const GAP = 0.17;    // two darts closer than this (radians) touch
export const PRIZE = 0.2;   // a dart this close to a prize on the rim takes it
const TAU = Math.PI * 2;

/** θ(t) = dir·(a·t + b·sin(k·t + ph) − b·sin(ph)): b·k < a speeds up and slows; b·k > a swings back. */
export interface Spin { a: number; b: number; k: number; ph: number; dir: 1 | -1 }
export interface Stage { n: number; boss: boolean; darts: number; spin: Spin; stuck: number[]; prizes: number[] }

export const norm = (a: number) => ((a % TAU) + TAU) % TAU;
export const apart = (a: number, b: number) => { const d = Math.abs(norm(a) - norm(b)); return Math.min(d, TAU - d); };
export const angleAt = (s: Spin, t: number) => s.dir * (s.a * t + s.b * Math.sin(s.k * t + s.ph) - s.b * Math.sin(s.ph));

/** Where on the wheel a dart thrown at time t (seconds into the stage) lands. */
export const landsAt = (s: Spin, t: number) => norm(Math.PI / 2 - angleAt(s, t + FLIGHT));
/** Does a dart landing at `a` touch one already there? */
export const hits = (stuck: number[], a: number) => stuck.some((x) => apart(x, a) < GAP);
/** The prize a dart landing at `a` takes, or -1. */
export const prizeAt = (prizes: number[], a: number) => prizes.findIndex((x) => apart(x, a) < PRIZE);

export const isBoss = (n: number) => n % 5 === 0;

/** Points: a dart that sticks, a prize, a boss wheel beaten. */
export const POINTS = { dart: 1, prize: 2, boss: 5 };

/** Stage n: more darts, faster and stranger turning, darts already in it; every 5th is a boss. */
export function makeStage(n: number, seed: number): Stage {
  const r = rng(seed * 31 + n * 7349);
  const boss = isBoss(n);
  const a = Math.min(1.5 + n * 0.12, 3.4) * (boss ? 1.15 : 1);
  const kind = boss ? 3 : n === 1 ? 0 : n % 4; // 0,1 steady · 2 speeds up and slows · 3 swings back
  const k = 1.1 + r.next() * 0.9;
  const b = kind === 2 ? (0.75 * a) / k : kind === 3 ? (1.9 * a) / k : 0;
  const spin: Spin = { a, b, k, ph: r.next() * TAU, dir: r.next() < 0.5 ? -1 : 1 };
  const darts = boss ? 10 : Math.min(5 + Math.ceil(n / 2), 10);
  const pre = n === 1 ? 0 : boss ? 3 : Math.min(1 + Math.floor(n / 3), 4);
  const stuck: number[] = [];
  for (let i = 0; stuck.length < pre && i < 200; i++) { const x = r.next() * TAU; if (stuck.every((s) => apart(s, x) > GAP * 3)) stuck.push(x); }
  const prizes: number[] = [];
  const want = n < 3 ? 1 : 2;
  for (let i = 0; prizes.length < want && i < 200; i++) {
    const x = r.next() * TAU;
    if (stuck.every((s) => apart(s, x) > GAP * 2) && prizes.every((p) => apart(p, x) > 1)) prizes.push(x);
  }
  return { n, boss, darts, spin, stuck, prizes };
}

/** A stage being played: darts in the wheel, prizes left, darts landed, the score so far. */
export interface Play { stage: Stage; stuck: number[]; prizes: number[]; landed: number; score: number }
export const startStage = (n: number, seed: number, score = 0): Play => {
  const stage = makeStage(n, seed);
  return { stage, stuck: [...stage.stuck], prizes: [...stage.prizes], landed: 0, score };
};

/** A dart lands at `a`: it bounces off another (game over), or sticks (maybe taking a prize, maybe
 *  the last one, which clears the stage). */
export function land(p: Play, a: number): { play: Play; result: 'hit' | 'stick' | 'clear'; prize: number } {
  if (hits(p.stuck, a)) return { play: p, result: 'hit', prize: -1 };
  const prize = prizeAt(p.prizes, a);
  const landed = p.landed + 1, clear = landed >= p.stage.darts;
  const score = p.score + POINTS.dart + (prize >= 0 ? POINTS.prize : 0) + (clear && p.stage.boss ? POINTS.boss : 0);
  return {
    play: { ...p, stuck: [...p.stuck, a], prizes: p.prizes.filter((_, i) => i !== prize), landed, score },
    result: clear ? 'clear' : 'stick', prize,
  };
}
