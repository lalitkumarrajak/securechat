// Car Out: cars on a 6×6 lot slide only along their length; get the red car (car 0, on the exit row)
// out through the gap on the right. Pure functions, no React: see logic.test.ts.
import { rng } from '../../kit';

export const N = 6;
export const EXIT_ROW = 2;
export interface Car { len: number; horiz: boolean; fixed: number } // fixed: its row (across) or column (up and down)
export interface Level { cars: Car[]; start: number[]; best: number } // start: each car's moving coordinate; best: fewest moves
export type Move = [car: number, to: number];

/** The squares a car covers at position p. */
export const cells = (c: Car, p: number) => Array.from({ length: c.len }, (_, k) => (c.horiz ? c.fixed * N + p + k : (p + k) * N + c.fixed));

function grid(cars: Car[], pos: number[]) {
  const g = new Int8Array(N * N).fill(-1);
  cars.forEach((c, i) => { for (const x of cells(c, pos[i])) g[x] = i; });
  return g;
}

/** How far car i can slide: [lowest, highest] position. */
export function range(cars: Car[], pos: number[], i: number, g = grid(cars, pos)): [number, number] {
  const c = cars[i];
  const at = (p: number) => (c.horiz ? c.fixed * N + p : p * N + c.fixed);
  let lo = pos[i], hi = pos[i];
  while (lo > 0 && g[at(lo - 1)] < 0) lo--;
  while (hi + c.len < N && g[at(hi + c.len)] < 0) hi++;
  return [lo, hi];
}

export const canMove = (cars: Car[], pos: number[], i: number, to: number) => {
  const [lo, hi] = range(cars, pos, i);
  return to !== pos[i] && to >= lo && to <= hi;
};
export const move = (pos: number[], [i, to]: Move) => pos.map((p, k) => (k === i ? to : p));
/** Out: the red car has reached the exit (nothing can be in front of it then). */
export const won = (cars: Car[], pos: number[]) => pos[0] + cars[0].len === N;

/** For searching: a whole lot packed into one number (3 bits a car), and the moves from it, without building arrays. */
function engine(cars: Car[]) {
  const n = cars.length, W = cars.map((_, i) => 8 ** i);
  const p = new Int8Array(n), g = new Int8Array(N * N);
  const encode = (pos: number[]) => pos.reduce((s, x, i) => s + x * W[i], 0);
  const decode = (s: number) => { for (let i = 0; i < n; i++) p[i] = Math.floor(s / W[i]) % 8; return p; };
  const near = (s: number, visit: (q: number, car: number, to: number) => void) => {
    decode(s); g.fill(-1);
    for (let i = 0; i < n; i++) { const c = cars[i]; for (let k = 0; k < c.len; k++) g[c.horiz ? c.fixed * N + p[i] + k : (p[i] + k) * N + c.fixed] = i; }
    for (let i = 0; i < n; i++) {
      const c = cars[i], step = c.horiz ? 1 : N, base = c.horiz ? c.fixed * N : c.fixed, at = p[i];
      for (let to = at - 1; to >= 0 && g[base + to * step] < 0; to--) visit(s + (to - at) * W[i], i, to);
      for (let to = at + 1; to + c.len <= N && g[base + (to + c.len - 1) * step] < 0; to++) visit(s + (to - at) * W[i], i, to);
    }
  };
  const out = (s: number) => (s % 8) + cars[0].len === N; // car 0 is the lowest 3 bits
  return { encode, decode, near, out };
}

/** The fewest moves out from here (a move slides one car any distance), or null if it can't get out. */
export function solve(cars: Car[], pos: number[], limit = 100_000): Move[] | null {
  const e = engine(cars);
  const start = e.encode(pos);
  const from = new Map<number, [number, number, number]>(); // state -> [previous, car, to]
  const seen = new Set([start]);
  for (let queue = [start]; queue.length;) {
    const next: number[] = [];
    for (const s of queue) {
      if (e.out(s)) {
        const path: Move[] = [];
        for (let k = s; k !== start;) { const [prev, car, to] = from.get(k)!; path.unshift([car, to]); k = prev; }
        return path;
      }
      e.near(s, (q, car, to) => { if (!seen.has(q)) { seen.add(q); from.set(q, [s, car, to]); next.push(q); } });
    }
    if (seen.size > limit) return null;
    queue = next;
  }
  return null;
}

/** Every position reachable from pos, each with its fewest moves out (moves can be undone, so it's one
 * search back from the ways out); null if the lot is too open to be interesting. */
function spread(cars: Car[], pos: number[], limit: number) {
  const e = engine(cars);
  const seen = new Set([e.encode(pos)]);
  for (let queue = [...seen]; queue.length;) {
    const next: number[] = [];
    for (const s of queue) e.near(s, (q) => { if (!seen.has(q)) { seen.add(q); next.push(q); } });
    if (seen.size > limit) return null;
    queue = next;
  }
  const dist = new Map<number, number>();
  let queue = [...seen].filter(e.out);
  for (const s of queue) dist.set(s, 0);
  for (let d = 1; queue.length; d++) {
    const next: number[] = [];
    for (const s of queue) e.near(s, (q) => { if (!dist.has(q)) { dist.set(q, d); next.push(q); } });
    queue = next;
  }
  return { dist, decode: (s: number) => [...e.decode(s)] };
}

/** Level n: more cars and longer ways out as you go; always solvable, the same for a seed. Built backwards:
 * cars round the red one at the exit, then a position in that lot the wanted number of moves away. */
export function makeLevel(level: number, seed: number): Level {
  const want = Math.min(2 + level, 18);
  const count = Math.min(7 + Math.ceil(level / 2), 13);
  let best: Level | null = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    const r = rng(seed * 7919 + level * 104729 + attempt * 31);
    const cars: Car[] = [{ len: 2, horiz: true, fixed: EXIT_ROW }];
    const pos = [N - 2];
    const g = new Int8Array(N * N).fill(-1);
    for (const x of cells(cars[0], pos[0])) g[x] = 0;
    for (let tries = 0; cars.length < count && tries < 300; tries++) {
      const c: Car = { len: r.next() < 0.75 ? 2 : 3, horiz: r.next() < 0.5, fixed: r.int(N) };
      if (c.horiz && c.fixed === EXIT_ROW) continue; // it could never leave the red car's way
      const p = r.int(N - c.len + 1);
      const xs = cells(c, p);
      if (xs.some((x) => g[x] >= 0)) continue;
      xs.forEach((x) => (g[x] = cars.length));
      cars.push(c); pos.push(p);
    }
    const s = spread(cars, pos, 25_000);
    if (!s) continue;
    const d = Math.min(want, Math.max(...s.dist.values()));
    if (best && d <= best.best) continue;
    const at = [...s.dist].filter(([, v]) => v === d).map(([k]) => k);
    best = { cars, start: s.decode(r.pick(at)), best: d };
    if (d >= want) break;
  }
  return best!;
}
