// Where everything sits on a Ludo board with 4 or 6 arms, in cell units.
//
// The centre is a regular polygon with one side per arm; each arm is 3 columns wide and 6 cells
// long. Across an arm, column u=0 is on the anticlockwise side, u=2 on the clockwise side; v counts
// outward from the centre. The track runs out along u=0, across the end, and back along u=2, then
// steps to the next arm clockwise: 13 squares per arm. The middle column is the arm owner's home
// column, and their yard sits on the clockwise side of their arm. The whole board is turned so
// your own yard is bottom-left, like in Ludo King.
import { ARM, START, STAR, homeAt, loopLen, trackSquare } from '../../../../../shared/games/ludo.js';

export const COLORS = ['#e8322f', '#2fa24a', '#f5c518', '#1f7fe0', '#9b3fd1', '#f5821f'];
export const DARK = ['#a51d1b', '#1c6e31', '#b38c00', '#14569c', '#6a2391', '#b35a0c'];
export const COLOR_NAMES = ['Red', 'Green', 'Yellow', 'Blue', 'Purple', 'Orange'];

export interface Pt { x: number; y: number }
export interface Cell extends Pt { ang: number; poly: Pt[] }

const D2R = Math.PI / 180;

export function makeLayout(arms: number, myArm: number) {
  const n = arms;
  const step = 360 / n;
  const apo = 1.5 / Math.tan(Math.PI / n);         // centre to the middle of a side
  const corner = 1.5 / Math.sin(Math.PI / n);      // centre to a corner of the centre polygon
  const target = n === 4 ? 135 : 150;               // bottom-left
  const rot = target - (-90 + myArm * step + step / 2);
  const armAng = (a: number) => (-90 + a * step + rot) * D2R;
  const yardAng = (a: number) => armAng(a) + (step / 2) * D2R;

  function cell(a: number, u: number, v: number): Cell {
    const th = armAng(a);
    const d = { x: Math.cos(th), y: Math.sin(th) };
    const p = { x: -d.y, y: d.x };
    const r = apo + v + 0.5, s = u - 1;
    const c = { x: d.x * r + p.x * s, y: d.y * r + p.y * s };
    const poly = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].map(([i, j]) => ({
      x: c.x + d.x * i + p.x * j, y: c.y + d.y * i + p.y * j,
    }));
    return { ...c, ang: th, poly };
  }

  // Track square index within an arm -> column and row.
  const armCell = (a: number, i: number) => (i < 6 ? cell(a, 0, i) : i === 6 ? cell(a, 1, 5) : cell(a, 2, 12 - i));

  const track: Cell[] = Array.from({ length: loopLen(n) }, (_, sq) => armCell(Math.floor(sq / ARM), sq % ARM));
  const homeCol = (a: number) => [0, 1, 2, 3, 4].map((j) => cell(a, 1, 4 - j));
  const startCell = (a: number) => armCell(a, START);
  const starCell = (a: number) => armCell(a, STAR);
  const entryCell = (a: number) => armCell(a, 6);

  const vertex = (ang: number) => ({ x: Math.cos(ang) * corner, y: Math.sin(ang) * corner });
  const centre = Array.from({ length: n }, (_, a) => vertex(yardAng(a)));
  const homeTri = (a: number) => [{ x: 0, y: 0 }, vertex(yardAng(a - 1)), vertex(yardAng(a))];

  // Yards: 6×6 corner squares on the 4-arm board; circles between the arms on the 6-arm board.
  const yard = (a: number) => {
    const ang = yardAng(a);
    const dist = n === 4 ? 4.5 * Math.SQRT2 : 8.1;
    const size = n === 4 ? 6 : 4.9;
    const c = { x: Math.cos(ang) * dist, y: Math.sin(ang) * dist };
    const sp = n === 4 ? 0.95 : 0.78;
    const spots = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([i, j]) => ({ x: c.x + i * sp, y: c.y + j * sp }));
    return { c, size, round: n !== 4, spots };
  };

  /** Where token t of the player on arm `a` stands at progress p (null when off the board). */
  function at(a: number, p: number, t: number): Pt | null {
    if (p === -2) return null;
    if (p === -1) return yard(a).spots[t];
    const L = loopLen(n);
    if (p <= L - 2) return track[trackSquare(n, a, p)!];
    if (p < homeAt(n)) return homeCol(a)[p - (L - 1)];
    const [o, v1, v2] = homeTri(a); // home: the middle of the player's triangle
    return { x: (o.x + v1.x + v2.x) / 3, y: (o.y + v1.y + v2.y) / 3 };
  }

  // Bounding box of everything drawn.
  const pts: Pt[] = [...track.flatMap((c) => c.poly)];
  for (let a = 0; a < n; a++) {
    const y = yard(a);
    const h = y.size / 2 + 0.15;
    pts.push({ x: y.c.x - h, y: y.c.y - h }, { x: y.c.x + h, y: y.c.y + h });
  }
  const minX = Math.min(...pts.map((p) => p.x)), maxX = Math.max(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y)), maxY = Math.max(...pts.map((p) => p.y));
  // The 6-arm board sits on a round base, so its box is the circle around everything.
  const R = Math.max(...pts.map((p) => Math.hypot(p.x, p.y)));
  const box = n === 4 ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY } : { x: -R, y: -R, w: 2 * R, h: 2 * R };

  return { n, track, homeCol, startCell, starCell, entryCell, centre, homeTri, yard, yardAng, armAng, at, box, cell };
}

export type Layout = ReturnType<typeof makeLayout>;

/** Progress values a token passes through going from `from` to `to` (for step-by-step animation). */
export function pathOf(from: number, to: number): number[] {
  if (from === -1) return [0];
  const out: number[] = [];
  for (let p = from + 1; p <= to; p++) out.push(p);
  return out;
}

export const poly = (pts: Pt[]) => pts.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(' ');
