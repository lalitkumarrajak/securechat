// Dot Link: pairs of coloured dots on a square grid; join each pair with a path, paths don't cross,
// and every square ends up in a path. Pure functions, no React: see logic.test.ts.
import { rng } from '../../kit';

export interface Puzzle { n: number; solution: number[][] } // each colour's path, square by square (row * n + column); its ends are the dots
export type Paths = number[][]; // what you've drawn, one per colour, each starting at one of its dots

export const sizeFor = (level: number) => (level <= 2 ? 5 : level <= 5 ? 6 : level <= 9 ? 7 : 8);
const near = (n: number, a: number, b: number) => (Math.abs(a - b) === n) || (Math.abs(a - b) === 1 && Math.floor(a / n) === Math.floor(b / n));
const neighbours = (n: number, c: number) => [c - n, c + n, c % n ? c - 1 : -1, (c + 1) % n ? c + 1 : -1].filter((x) => x >= 0 && x < n * n);

/** Level n: a path through every square (a snake, shuffled by "backbite" moves), cut into pieces, one per colour. */
export function makeLevel(level: number, seed: number): Puzzle {
  const n = sizeFor(level);
  for (let attempt = 0; ; attempt++) {
    const r = rng(seed * 7919 + level * 104729 + attempt * 31);
    let path = Array.from({ length: n * n }, (_, i) => { const row = Math.floor(i / n), k = i % n; return row * n + (row % 2 ? n - 1 - k : k); });
    for (let step = 0; step < n * n * 40; step++) {
      if (r.next() < 0.5) path.reverse();
      const end = path[path.length - 1], x = r.pick(neighbours(n, end));
      const i = path.indexOf(x);
      if (i === path.length - 2) continue;
      path = [...path.slice(0, i + 1), ...path.slice(i + 1).reverse()];
    }
    const colours = Math.min(9, n - 1 + r.int(2) + (n >= 7 ? 1 : 0));
    const lengths = Array(colours).fill(3);
    for (let left = n * n - 3 * colours; left > 0; left--) lengths[r.int(colours)]++;
    const solution: number[][] = [];
    let at = 0;
    for (const len of lengths) { solution.push(path.slice(at, at + len)); at += len; }
    // a path whose ends sit side by side is too easy to cut short: try again
    if (solution.some((p) => near(n, p[0], p[p.length - 1]))) continue;
    return { n, solution };
  }
}

export const dotAt = (pz: Puzzle, cell: number) => pz.solution.findIndex((p) => p[0] === cell || p[p.length - 1] === cell);
export const pathAt = (paths: Paths, cell: number) => paths.findIndex((p) => p.includes(cell));
export const joined = (pz: Puzzle, path: number[], c: number) => {
  const s = pz.solution[c], a = s[0], b = s[s.length - 1];
  return path.length > 1 && ((path[0] === a && path[path.length - 1] === b) || (path[0] === b && path[path.length - 1] === a));
};
export const won = (pz: Puzzle, paths: Paths) => paths.every((p, c) => joined(pz, p, c)) && paths.reduce((s, p) => s + p.length, 0) === pz.n * pz.n;

/** Pressing on a square: a dot starts its colour afresh; a square on a path cuts that path back to it. The colour, or -1. */
export function begin(pz: Puzzle, paths: Paths, cell: number): [Paths, number] {
  const d = dotAt(pz, cell);
  if (d >= 0) return [paths.map((p, c) => (c === d ? [cell] : p)), d];
  const c = pathAt(paths, cell);
  if (c >= 0) return [paths.map((p, k) => (k === c ? p.slice(0, p.indexOf(cell) + 1) : p)), c];
  return [paths, -1];
}

/** Drawing colour c on to the next square: back over itself shortens it, into another path cuts that one. */
export function extend(pz: Puzzle, paths: Paths, c: number, cell: number): Paths {
  const cur = paths[c];
  if (!cur.length || !near(pz.n, cur[cur.length - 1], cell)) return paths;
  const i = cur.indexOf(cell);
  if (i >= 0) return paths.map((p, k) => (k === c ? p.slice(0, i + 1) : p));
  if (joined(pz, cur, c)) return paths; // already at its other dot
  const d = dotAt(pz, cell);
  if (d >= 0 && d !== c) return paths;
  return paths.map((p, k) => (k === c ? [...p, cell] : p.includes(cell) ? p.slice(0, p.indexOf(cell)) : p));
}

/** A colour not yet drawn the way the answer has it, drawn so; anything in its way is cut back. */
export function hint(pz: Puzzle, paths: Paths): [Paths, number] {
  const same = (p: number[], s: number[]) => p.join() === s.join() || p.join() === [...s].reverse().join();
  const c = pz.solution.findIndex((s, k) => !same(paths[k], s));
  if (c < 0) return [paths, -1];
  const s = pz.solution[c];
  return [paths.map((p, k) => {
    if (k === c) return [...s];
    const cut = p.findIndex((x) => s.includes(x));
    return cut < 0 ? p : p.slice(0, cut);
  }), c];
}
