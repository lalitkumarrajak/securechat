// Colour Pour: tubes of coloured layers; pour from one tube onto another whose top is the same colour
// (or that's empty) until every tube holds one colour. Pure functions, no React: see logic.test.ts.
import { rng } from '../../kit';

export const CAP = 4;
export type Tubes = number[][]; // each tube bottom → top, colours 0..n-1

/** Level n: more colours as you go (3 to 10), two empty tubes, always solvable. */
export function makeLevel(level: number, seed: number): Tubes {
  const colours = Math.min(10, 3 + Math.floor((level - 1) / 2));
  for (let attempt = 0; ; attempt++) {
    const r = rng(seed * 7919 + level * 104729 + attempt);
    const balls = r.shuffle(Array.from({ length: colours * CAP }, (_, i) => Math.floor(i / CAP)));
    const tubes: Tubes = Array.from({ length: colours }, (_, i) => balls.slice(i * CAP, (i + 1) * CAP));
    tubes.push([], []);
    if (!tubes.slice(0, colours).some((t) => done(t)) && solve(tubes)) return tubes; // nothing sorted yet, and it can be finished
  }
}

const top = (t: number[]) => t[t.length - 1];
/** How many layers of the top colour sit together at the top. */
const run = (t: number[]) => { let n = 0; for (let i = t.length - 1; i >= 0 && t[i] === top(t); i--) n++; return n; };

export function canPour(tubes: Tubes, from: number, to: number) {
  const a = tubes[from], b = tubes[to];
  return from !== to && a.length > 0 && b.length < CAP && (b.length === 0 || top(b) === top(a));
}

/** Pour as much of the top colour as fits. */
export function pour(tubes: Tubes, from: number, to: number): Tubes {
  if (!canPour(tubes, from, to)) return tubes;
  const n = Math.min(run(tubes[from]), CAP - tubes[to].length);
  const next = tubes.map((t) => [...t]);
  const moved = next[from].splice(next[from].length - n, n);
  next[to].push(...moved);
  return next;
}

export const done = (t: number[]) => t.length === 0 || (t.length === CAP && t.every((c) => c === t[0]));
export const won = (tubes: Tubes) => tubes.every(done);

/** A way to finish from here (list of [from, to]), or null if there's none. Depth-first, each position once. */
export function solve(tubes: Tubes, limit = 200_000): [number, number][] | null {
  const seen = new Set<string>();
  const key = (ts: Tubes) => ts.map((t) => t.join(',')).sort().join('|');
  const path: [number, number][] = [];
  let budget = limit;
  const go = (ts: Tubes): boolean => {
    if (won(ts)) return true;
    if (--budget < 0) return false;
    const k = key(ts);
    if (seen.has(k)) return false;
    seen.add(k);
    for (let f = 0; f < ts.length; f++) {
      if (done(ts[f])) continue;
      for (let to = 0; to < ts.length; to++) {
        if (!canPour(ts, f, to)) continue;
        if (ts[to].length === 0 && run(ts[f]) === ts[f].length) continue; // a one-colour tube into an empty one: pointless
        path.push([f, to]);
        if (go(pour(ts, f, to))) return true;
        path.pop();
      }
    }
    return false;
  };
  return go(tubes) ? path : null;
}
