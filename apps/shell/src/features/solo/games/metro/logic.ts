// Metro Lines: stations of a few shapes appear on a city cut by a river; passengers wait at them for a
// station of the shape they show. Lines run trains back and forth; a station with too many people for
// too long ends the game. Plain data and a fixed time step, no React: see logic.test.ts.
import { rng } from '../../kit';

export type Shape = 0 | 1 | 2 | 3 | 4; // circle, triangle, square, star, diamond
export const SHAPES = ['circle', 'triangle', 'square', 'star', 'diamond'] as const;
export const W = 360, H = 560;      // the map, in its own units
export const DT = 1 / 30;           // one simulation step, seconds
export const CAP = 6;               // people a train carries
export const CROWD = 6;             // people a station holds before it starts to overflow
export const OVERFLOW = 22;         // seconds a station can stay overflowing
export const WEEK = 60;             // seconds in a week
export const SPEED = 46;            // train speed, map units a second
export const MAX_LINES = 7;
const NEAR = 48, RIVER_GAP = 24, EDGE = 24;

export interface Station { id: number; x: number; y: number; shape: Shape; waiting: Shape[]; over: number; born: number }
export interface Line { id: number; colour: number; stops: number[] }
export interface Train { id: number; line: number; seg: number; pos: number; dir: 1 | -1; wait: number; load: Shape[] }
export type Gift = 'line' | 'train' | 'tunnel';
export interface Metro {
  r: ReturnType<typeof rng>;
  t: number; week: number; phase: 'play' | 'week' | 'over';
  river: [number, number][];
  stations: Station[]; lines: Line[]; trains: Train[];
  maxLines: number; trainCount: number; tunnels: number;
  score: number; lost: number | null;
  nextStation: number; nextPassenger: number; ids: number;
}

export function newGame(seed: number): Metro {
  const r = rng(seed * 31 + 7);
  const y0 = H * 0.52 + (r.next() - 0.5) * 70;
  const river: [number, number][] = [];
  for (let x = -20, i = 0; x <= W + 20; x += 64, i++) river.push([x, Math.round(y0 + (i % 2 ? 1 : -1) * (12 + r.next() * 18))]);
  const m: Metro = { r, t: 0, week: 0, phase: 'play', river, stations: [], lines: [], trains: [], maxLines: 3, trainCount: 3, tunnels: 2,
    score: 0, lost: null, nextStation: 16, nextPassenger: 1.5, ids: 1 };
  for (const s of [0, 1, 2] as Shape[]) addStation(m, s);
  return m;
}

// --- geometry --------------------------------------------------------------------------------
type P = { x: number; y: number };
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);
function segDist(p: P, a: P, b: P) {
  const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy;
  const k = l ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l)) : 0;
  return Math.hypot(p.x - a.x - k * dx, p.y - a.y - k * dy);
}
function cross(a: P, b: P, c: P, d: P) {
  const o = (p: P, q: P, s: P) => Math.sign((q.x - p.x) * (s.y - p.y) - (q.y - p.y) * (s.x - p.x));
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
}
const pts = (m: Metro) => m.river.map(([x, y]) => ({ x, y }));
/** Does going straight from a to b cross the river? */
export function crossesRiver(m: Metro, a: P, b: P) {
  const rp = pts(m);
  let n = 0;
  for (let i = 0; i < rp.length - 1; i++) if (cross(a, b, rp[i], rp[i + 1])) n++;
  return n % 2 === 1;
}
const riverDist = (m: Metro, p: P) => { const rp = pts(m); let d = Infinity; for (let i = 0; i < rp.length - 1; i++) d = Math.min(d, segDist(p, rp[i], rp[i + 1])); return d; };

export const station = (m: Metro, id: number) => m.stations.find((s) => s.id === id)!;
export const lineOf = (m: Metro, id: number) => m.lines.find((l) => l.id === id);

// --- the city grows ---------------------------------------------------------------------------
function addStation(m: Metro, shape?: Shape) {
  const n = m.stations.length;
  const spread = Math.min(1, 0.32 + n * 0.06);
  for (let k = 0; k < 80; k++) {
    const p = { x: W / 2 + (m.r.next() * 2 - 1) * (W / 2 - EDGE) * spread, y: H / 2 + (m.r.next() * 2 - 1) * (H / 2 - EDGE) * spread };
    if (p.x < EDGE || p.x > W - EDGE || p.y < EDGE || p.y > H - EDGE) continue;
    if (riverDist(m, p) < RIVER_GAP || m.stations.some((s) => dist(s, p) < NEAR)) continue;
    const roll = m.r.next();
    const sh: Shape = shape ?? (n >= 6 && roll < 0.1 ? 3 : n >= 9 && roll < 0.18 ? 4 : roll < 0.5 ? 0 : roll < 0.78 ? 1 : 2);
    const s: Station = { id: m.ids++, x: Math.round(p.x), y: Math.round(p.y), shape: sh, waiting: [], over: 0, born: m.t };
    m.stations.push(s);
    return s;
  }
  return null;
}

function addPassenger(m: Metro) {
  const shapes = [...new Set(m.stations.map((s) => s.shape))];
  if (shapes.length < 2) return;
  const s = m.r.pick(m.stations);
  const want = m.r.pick(shapes.filter((x) => x !== s.shape));
  s.waiting.push(want);
}

// --- building ---------------------------------------------------------------------------------
export const linesLeft = (m: Metro) => m.maxLines - m.lines.length;
export const trainsLeft = (m: Metro) => m.trainCount - m.trains.length;
export function tunnelsUsed(m: Metro) {
  let n = 0;
  for (const l of m.lines) for (let i = 0; i < l.stops.length - 1; i++) if (crossesRiver(m, station(m, l.stops[i]), station(m, l.stops[i + 1]))) n++;
  return n;
}
export type BuildError = 'tunnel' | 'lines' | 'same' | null;
function canJoin(m: Metro, a: number, b: number): BuildError {
  if (a === b) return 'same';
  if (crossesRiver(m, station(m, a), station(m, b)) && tunnelsUsed(m) >= m.tunnels) return 'tunnel';
  return null;
}

/** A new line from a to b; it gets a train if one is free. Returns the line, or why not. */
export function newLine(m: Metro, a: number, b: number): Line | BuildError {
  if (linesLeft(m) <= 0) return 'lines';
  const err = canJoin(m, a, b);
  if (err) return err;
  const used = new Set(m.lines.map((l) => l.colour));
  const colour = Array.from({ length: MAX_LINES }, (_, i) => i).find((c) => !used.has(c))!;
  const line: Line = { id: m.ids++, colour, stops: [a, b] };
  m.lines.push(line);
  addTrain(m, line.id);
  return line;
}

/** Add a station at the head (start) or tail (end) of a line. */
export function extendLine(m: Metro, id: number, end: 'head' | 'tail', s: number): BuildError | 'ok' {
  const l = lineOf(m, id);
  if (!l || l.stops.includes(s)) return 'same';
  const from = end === 'tail' ? l.stops[l.stops.length - 1] : l.stops[0];
  const err = canJoin(m, from, s);
  if (err) return err;
  if (end === 'tail') l.stops.push(s);
  else { l.stops.unshift(s); for (const tr of m.trains) if (tr.line === id) tr.seg++; }
  return 'ok';
}

/** Take a line away: its trains come back, the people on them get off at the stop they were nearest. */
export function removeLine(m: Metro, id: number) {
  const l = lineOf(m, id);
  if (!l) return;
  for (const tr of m.trains.filter((x) => x.line === id)) {
    const stop = station(m, l.stops[tr.seg + (tr.dir > 0 ? 0 : 1)]);
    stop.waiting.push(...tr.load.filter((w) => w !== stop.shape));
  }
  m.trains = m.trains.filter((x) => x.line !== id);
  m.lines = m.lines.filter((x) => x.id !== id);
}

export function addTrain(m: Metro, id: number) {
  if (trainsLeft(m) <= 0 || !lineOf(m, id)) return false;
  const others = m.trains.filter((x) => x.line === id).length;
  const l = lineOf(m, id)!;
  // a second train starts from the other end, so they spread out
  const atEnd = others % 2 === 1;
  const tr: Train = { id: m.ids++, line: id, seg: atEnd ? l.stops.length - 2 : 0, pos: atEnd ? segLen(m, l, l.stops.length - 2) : 0, dir: atEnd ? -1 : 1, wait: 0, load: [] };
  m.trains.push(tr);
  arrive(m, tr, l, l.stops[atEnd ? l.stops.length - 1 : 0]); // it starts at a station: people get on
  return true;
}

export function chooseGift(m: Metro, g: Gift) {
  if (m.phase !== 'week') return;
  if (g === 'line' && m.maxLines < MAX_LINES) { m.maxLines++; m.trainCount++; }
  else if (g === 'train') m.trainCount++;
  else m.tunnels += 2;
  m.week++;
  m.phase = 'play';
}
export const gifts = (m: Metro): Gift[] => (m.maxLines < MAX_LINES ? ['line', 'train', 'tunnel'] : ['train', 'tunnel']);

// --- trains -----------------------------------------------------------------------------------
const segLen = (m: Metro, l: Line, seg: number) => dist(station(m, l.stops[seg]), station(m, l.stops[seg + 1]));
const serves = (m: Metro, l: Line, shape: Shape) => l.stops.some((id) => station(m, id).shape === shape);
/** Lines through a station. */
const linesAt = (m: Metro, id: number) => m.lines.filter((l) => l.stops.includes(id));
/** Would a person at `here` wanting `shape` get there on line l: directly, or by changing once? */
function leadsTo(m: Metro, l: Line, here: number, shape: Shape) {
  if (serves(m, l, shape)) return true;
  return l.stops.some((id) => id !== here && linesAt(m, id).some((o) => o.id !== l.id && serves(m, o, shape)));
}

function arrive(m: Metro, tr: Train, l: Line, at: number) {
  const s = station(m, at);
  let moved = 0;
  // off: home, or changing to a line that goes there
  const keep: Shape[] = [];
  for (const w of tr.load) {
    if (w === s.shape) { m.score++; moved++; }
    else if (!serves(m, l, w) && linesAt(m, at).some((o) => o.id !== l.id && serves(m, o, w))) { s.waiting.push(w); moved++; }
    else keep.push(w);
  }
  tr.load = keep;
  // on: anyone this line takes where they're going
  const stay: Shape[] = [];
  for (const w of s.waiting) {
    if (tr.load.length < CAP && leadsTo(m, l, at, w)) { tr.load.push(w); moved++; }
    else stay.push(w);
  }
  s.waiting = stay;
  tr.wait = 0.25 + 0.12 * moved;
}

function moveTrain(m: Metro, tr: Train, dt: number) {
  if (tr.wait > 0) { tr.wait -= dt; return; }
  const l = lineOf(m, tr.line);
  if (!l || l.stops.length < 2) return;
  tr.seg = Math.min(tr.seg, l.stops.length - 2);
  const len = segLen(m, l, tr.seg);
  tr.pos += tr.dir * SPEED * dt;
  if (tr.dir > 0 && tr.pos >= len) {
    arrive(m, tr, l, l.stops[tr.seg + 1]);
    if (tr.seg + 1 >= l.stops.length - 1) { tr.pos = len; tr.dir = -1; } else { tr.seg++; tr.pos = 0; }
  } else if (tr.dir < 0 && tr.pos <= 0) {
    arrive(m, tr, l, l.stops[tr.seg]);
    if (tr.seg === 0) { tr.pos = 0; tr.dir = 1; } else { tr.seg--; tr.pos = segLen(m, l, tr.seg); }
  }
}

/** Where a train is drawn, and which way it faces (radians). */
export function trainAt(m: Metro, tr: Train) {
  const l = lineOf(m, tr.line)!;
  const a = station(m, l.stops[tr.seg]), b = station(m, l.stops[Math.min(tr.seg + 1, l.stops.length - 1)]);
  const len = dist(a, b) || 1, k = Math.max(0, Math.min(1, tr.pos / len));
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, angle: Math.atan2(b.y - a.y, b.x - a.x) };
}

// --- time -------------------------------------------------------------------------------------
/** Move the world on by dt seconds (use DT). */
export function step(m: Metro, dt: number) {
  if (m.phase !== 'play') return;
  m.t += dt;
  for (const tr of m.trains) moveTrain(m, tr, dt);
  if ((m.nextStation -= dt) <= 0) { addStation(m); m.nextStation = Math.max(10, 18 - m.t / 40); }
  if ((m.nextPassenger -= dt) <= 0) { addPassenger(m); m.nextPassenger = Math.max(0.7, 2.4 - m.t / 160) * (0.7 + m.r.next() * 0.6); }
  for (const s of m.stations) {
    if (s.waiting.length > CROWD) s.over += dt / OVERFLOW;
    else s.over = Math.max(0, s.over - (2 * dt) / OVERFLOW);
    if (s.over >= 1) { s.over = 1; m.phase = 'over'; m.lost = s.id; return; }
  }
  if (m.t >= (m.week + 1) * WEEK) m.phase = 'week';
}
