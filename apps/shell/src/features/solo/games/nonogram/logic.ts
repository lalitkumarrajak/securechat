// Picture Cross: a hidden picture on a grid; the numbers by each row and column are the runs of
// filled squares in it, in order. Pure functions, no React: see logic.test.ts.
import { tk } from '@sanga/i18n';

export interface Picture { name: string; colour: string; rows: string[] } // '#' filled, '.' empty
export interface Puzzle { name: string; colour: string; w: number; h: number; cells: boolean[] }

// Drawn by hand for this game, small to big. Each one can be worked out a line at a time (logic.test.ts checks).
export const PICTURES: Picture[] = [
  { name: tk('Heart'), colour: '#f43f5e', rows: ['.#.#.', '#####', '#####', '.###.', '..#..'] },
  { name: tk('Boat'), colour: '#0ea5e9', rows: ['.#...', '.##..', '.###.', '#####', '.###.'] },
  { name: tk('House'), colour: '#f59e0b', rows: ['..#..', '.###.', '#####', '.#.##', '.#.##'] },
  { name: tk('Mushroom'), colour: '#ef4444', rows: ['.####.', '######', '#.##.#', '######', '..##..', '.####.'] },
  { name: tk('Fish'), colour: '#fb923c', rows: ['..###.', '.#####', '#.####', '######', '.#####', '..###.'] },
  { name: tk('Cat'), colour: '#a78bfa', rows: ['#.....#', '##...##', '#######', '#.###.#', '#######', '.#####.', '..#.#..'] },
  { name: tk('Tree'), colour: '#22c55e', rows: ['...#...', '..###..', '.#####.', '..###..', '.#####.', '#######', '...#...'] },
  { name: tk('Umbrella'), colour: '#ec4899', rows: ['...##...', '.######.', '########', '#.#..#.#', '...##...', '...##...', '...##.#.', '....##..'] },
  { name: tk('Rocket'), colour: '#6366f1', rows: ['...##...', '..####..', '..####..', '..#..#..', '..####..', '.######.', '###..###', '##....##'] },
  { name: tk('Duck'), colour: '#eab308', rows: ['..###....', '.#####...', '.#.###...', '#######..', '..###....', '.#######.', '#########', '.#######.', '..#####..'] },
  { name: tk('Star'), colour: '#facc15', rows: ['....#....', '....#....', '...###...', '#########', '.#######.', '..#####..', '..##.##..', '.##...##.', '##.....##'] },
  { name: tk('Butterfly'), colour: '#d946ef', rows: ['.#......#.', '..#....#..', '###.##.###', '####..####', '##########', '.########.', '..##..##..', '.###..###.', '####..####', '.##....##.'] },
  { name: tk('Teapot'), colour: '#14b8a6', rows: ['....##....', '...####...', '.########.', '#.######.#', '#.######.#', '.########.', '..######..', '..######.#', '...####.##', '.########.'] },
];

export function puzzleFor(level: number): Puzzle {
  const p = PICTURES[(level - 1) % PICTURES.length];
  const flip = Math.floor((level - 1) / PICTURES.length) % 2 === 1; // the second time round, mirrored
  const rows = p.rows.map((r) => (flip ? [...r].reverse().join('') : r));
  return { name: p.name, colour: p.colour, w: rows[0].length, h: rows.length, cells: rows.flatMap((r) => [...r].map((c) => c === '#')) };
}

/** The runs of filled squares in a line. */
export const runs = (line: boolean[]) => {
  const out: number[] = [];
  let k = 0;
  for (const x of [...line, false]) { if (x) k++; else if (k) { out.push(k); k = 0; } }
  return out;
};
export const rowOf = <T,>(cells: T[], w: number, r: number) => cells.slice(r * w, r * w + w);
export const colOf = <T,>(cells: T[], w: number, c: number) => cells.filter((_, i) => i % w === c);
export const clues = (pz: Puzzle) => ({
  rows: Array.from({ length: pz.h }, (_, r) => runs(rowOf(pz.cells, pz.w, r))),
  cols: Array.from({ length: pz.w }, (_, c) => runs(colOf(pz.cells, pz.w, c))),
});
/** A line done: its runs match its clue. */
export const lineOk = (line: boolean[], clue: number[]) => runs(line).join() === clue.join();
/** Won: every row and column matches its clue. */
export const won = (pz: Puzzle, filled: boolean[]) => {
  const c = clues(pz);
  return c.rows.every((k, r) => lineOk(rowOf(filled, pz.w, r), k)) && c.cols.every((k, i) => lineOk(colOf(filled, pz.w, i), k));
};

/** One line: every way to place the clue's runs that fits what's known (1 filled, 0 empty, -1 unknown), and what they all agree on. */
export function solveLine(clue: number[], known: number[]): number[] | null {
  const n = known.length, agree: number[] = Array(n).fill(-2);
  const line: number[] = Array(n).fill(0);
  const place = (k: number, from: number): void => {
    if (k === clue.length) {
      for (let i = from; i < n; i++) if (known[i] === 1) return;
      for (let i = 0; i < n; i++) { const v = i < from ? line[i] : 0; agree[i] = agree[i] === -2 ? v : agree[i] === v ? v : -1; }
      return;
    }
    const len = clue[k], rest = clue.slice(k + 1).reduce((s, x) => s + x + 1, 0);
    for (let at = from; at + len + rest <= n; at++) {
      if (at > from && known[at - 1] === 1) break; // a filled square left uncovered
      let ok = true;
      for (let i = at; i < at + len; i++) if (known[i] === 0) { ok = false; break; }
      if (!ok || (at + len < n && known[at + len] === 1)) continue;
      for (let i = from; i < at; i++) line[i] = 0;
      for (let i = at; i < at + len; i++) line[i] = 1;
      if (at + len < n) line[at + len] = 0;
      place(k + 1, Math.min(n, at + len + 1));
    }
  };
  place(0, 0);
  return agree[0] === -2 && n > 0 ? null : agree.map((v, i) => (known[i] !== -1 ? known[i] : v));
}

/** Solve a line at a time; the grid if that settles every square (so the picture is the only answer), else null. */
export function solve(rows: number[][], cols: number[][]): boolean[] | null {
  const h = rows.length, w = cols.length, g: number[] = Array(w * h).fill(-1);
  for (let changed = true; changed;) {
    changed = false;
    for (let r = 0; r < h; r++) {
      const out = solveLine(rows[r], rowOf(g, w, r));
      if (!out) return null;
      out.forEach((v, c) => { if (g[r * w + c] !== v) { g[r * w + c] = v; changed = true; } });
    }
    for (let c = 0; c < w; c++) {
      const out = solveLine(cols[c], colOf(g, w, c));
      if (!out) return null;
      out.forEach((v, r) => { if (g[r * w + c] !== v) { g[r * w + c] = v; changed = true; } });
    }
  }
  return g.includes(-1) ? null : g.map((v) => v === 1);
}
