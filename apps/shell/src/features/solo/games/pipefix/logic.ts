// Pipe Fix: a grid of pipe pieces, each turned the wrong way; turn them so the water from the source
// reaches every piece. Pure functions, no React: see logic.test.ts.
import { rng } from '../../kit';

/** A piece's openings: up, right, down, left. */
export const UP = 1, RIGHT = 2, DOWN = 4, LEFT = 8;
const DIRS = [UP, RIGHT, DOWN, LEFT];
export interface Level { w: number; h: number; source: number; pipes: number[]; start: number[] } // pipes: the answer; start: quarter turns each piece is off by

export const sizeFor = (level: number): [number, number] =>
  level <= 1 ? [4, 4] : level <= 2 ? [4, 5] : level <= 3 ? [5, 5] : level <= 5 ? [5, 6] : level <= 8 ? [6, 6] : level <= 12 ? [6, 7] : [7, 8];

/** Turned clockwise k quarter turns. */
export const turn = (m: number, k: number) => { k = ((k % 4) + 4) % 4; return ((m << k) | (m >> (4 - k))) & 15; };
/** The neighbour through an opening, or -1 at the edge. */
export const step = (w: number, h: number, i: number, d: number) => {
  const r = Math.floor(i / w), c = i % w;
  if (d === UP) return r > 0 ? i - w : -1;
  if (d === DOWN) return r < h - 1 ? i + w : -1;
  if (d === LEFT) return c > 0 ? i - 1 : -1;
  return c < w - 1 ? i + 1 : -1;
};
const opposite = (d: number) => turn(d, 2);

/** The pieces as they look now: the answer turned by how far each piece is turned. */
export const shapes = (lv: Level, turns: number[]) => lv.pipes.map((m, i) => turn(m, turns[i]));

/** How many pieces along the water gets to each piece, through openings that meet; -1 where it doesn't. */
export function flow(lv: Level, turns: number[]): number[] {
  const s = shapes(lv, turns), dist = Array(s.length).fill(-1);
  dist[lv.source] = 0;
  for (let queue = [lv.source]; queue.length;) {
    const next: number[] = [];
    for (const i of queue) for (const d of DIRS) {
      if (!(s[i] & d)) continue;
      const j = step(lv.w, lv.h, i, d);
      if (j >= 0 && dist[j] < 0 && s[j] & opposite(d)) { dist[j] = dist[i] + 1; next.push(j); }
    }
    queue = next;
  }
  return dist;
}
export const wet = (lv: Level, turns: number[]) => flow(lv, turns).map((d) => d >= 0);
export const won = (lv: Level, turns: number[]) => wet(lv, turns).every(Boolean);

/** Quarter turns still needed to put piece i the answer's way (a straight piece is right both ways round). */
export const needed = (lv: Level, turns: number[], i: number) => [0, 1, 2, 3].find((k) => turn(lv.pipes[i], turns[i] + k) === lv.pipes[i])!;

/** Level n: a random tree over the whole grid from the source in the middle (each piece is where it
 * branches), then every piece turned at random. */
export function makeLevel(level: number, seed: number): Level {
  const [w, h] = sizeFor(level);
  const r = rng(seed * 7919 + level * 104729);
  const source = Math.floor(h / 2) * w + Math.floor((w - 1) / 2);
  const pipes = Array(w * h).fill(0), inTree = Array(w * h).fill(false);
  inTree[source] = true;
  const edges: [number, number][] = DIRS.map((d) => [source, d]);
  for (let joined = 1; joined < w * h;) {
    const [i, d] = edges.splice(r.int(edges.length), 1)[0];
    const j = step(w, h, i, d);
    if (j < 0 || inTree[j]) continue;
    if (pipes[i] && countBits(pipes[i]) >= 3 && r.next() < 0.7) { edges.push([i, d]); if (edges.length > 1) continue; } // fewer crossings
    pipes[i] |= d; pipes[j] |= opposite(d); inTree[j] = true; joined++;
    for (const e of DIRS) edges.push([j, e]);
  }
  for (;;) {
    const start = pipes.map(() => r.int(4));
    if (!won({ w, h, source, pipes, start }, start) && start.filter((k, i) => turn(pipes[i], k) !== pipes[i]).length >= Math.min(w * h / 2, 6)) return { w, h, source, pipes, start };
  }
}
const countBits = (m: number) => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1);
