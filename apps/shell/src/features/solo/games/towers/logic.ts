// Tower Guard: enemies walk a path across a grid in waves; towers on the spots beside the path shoot
// them. Coins come from kills and cleared waves; an enemy that gets through costs lives. Plain data and
// a fixed time step, no React, no chance: see logic.test.ts.

export const COLS = 8, ROWS = 12;
export const DT = 1 / 30;
export const WAVES = 12;
export const LIVES = 20;
export type P = { x: number; y: number };

/** The maps, in order: each a path through cell corners (col, row), from off the board to off the board. */
export const MAPS: [number, number][][] = [
  [[-1, 1], [6, 1], [6, 4], [1, 4], [1, 7], [6, 7], [6, 10], [3, 10], [3, 12]],
  [[1, -1], [1, 3], [6, 3], [6, 6], [2, 6], [2, 9], [6, 9], [6, 12]],
  [[-1, 2], [4, 2], [4, 5], [1, 5], [1, 9], [5, 9], [5, 6], [8, 6]],
];

export type Kind = 'fast' | 'splash' | 'slow' | 'sniper';
export const KINDS: Kind[] = ['fast', 'splash', 'slow', 'sniper'];
export const TOWERS: Record<Kind, { cost: number; range: number; rate: number; dmg: number; splash?: number; slow?: number }> = {
  fast: { cost: 20, range: 2.2, rate: 2.5, dmg: 3 },
  splash: { cost: 35, range: 2, rate: 0.7, dmg: 7, splash: 1.1 },
  slow: { cost: 30, range: 2, rate: 1, dmg: 2, slow: 1.6 },
  sniper: { cost: 45, range: 4.5, rate: 0.45, dmg: 22 },
};
export const MAX_LEVEL = 3;

export type Foe = 'walker' | 'runner' | 'brute' | 'boss';
export const FOES: Record<Foe, { hp: number; speed: number; reward: number; harm: number }> = {
  walker: { hp: 12, speed: 1, reward: 2, harm: 1 },
  runner: { hp: 7, speed: 1.8, reward: 2, harm: 1 },
  brute: { hp: 45, speed: 0.6, reward: 6, harm: 2 },
  boss: { hp: 240, speed: 0.45, reward: 25, harm: 5 },
};

export interface Tower { id: number; spot: number; kind: Kind; level: number; cd: number; spent: number; aim: number }
export interface Enemy { id: number; foe: Foe; hp: number; max: number; d: number; slow: number }
export interface Shot { kind: Kind; from: P; to: P; ttl: number }
export interface TD {
  map: number; path: P[]; cum: number[]; total: number; spots: P[];
  towers: Tower[]; enemies: Enemy[]; queue: { foe: Foe; at: number }[]; shots: Shot[];
  wave: number; phase: 'build' | 'wave' | 'won' | 'lost'; coins: number; lives: number; t: number; waveT: number; ids: number; kills: number;
}

export function newTD(map: number): TD {
  const path = MAPS[map].map(([c, r]) => ({ x: c + 0.5, y: r + 0.5 }));
  const cum = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y));
  const onPath = pathCells(map);
  const spots: P[] = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (onPath.has(`${c},${r}`)) continue;
    let near = false;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (onPath.has(`${c + dc},${r + dr}`)) near = true;
    if (near) spots.push({ x: c, y: r });
  }
  return { map, path, cum, total: cum[cum.length - 1], spots, towers: [], enemies: [], queue: [], shots: [],
    wave: 0, phase: 'build', coins: 90 + 15 * map, lives: LIVES, t: 0, waveT: 0, ids: 1, kills: 0 };
}

/** The cells the path runs through, "col,row". */
export function pathCells(map: number) {
  const cells = new Set<string>();
  const w = MAPS[map];
  for (let i = 1; i < w.length; i++) {
    const [c0, r0] = w[i - 1], [c1, r1] = w[i];
    const n = Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0));
    for (let k = 0; k <= n; k++) {
      const c = c0 + Math.sign(c1 - c0) * k, r = r0 + Math.sign(r1 - r0) * k;
      if (c >= 0 && c < COLS && r >= 0 && r < ROWS) cells.add(`${c},${r}`);
    }
  }
  return cells;
}

/** A point `d` cells along the path. */
export function along(s: TD, d: number): P {
  let i = 1;
  while (i < s.cum.length - 1 && s.cum[i] < d) i++;
  const a = s.path[i - 1], b = s.path[i], len = s.cum[i] - s.cum[i - 1] || 1;
  const k = Math.max(0, Math.min(1, (d - s.cum[i - 1]) / len));
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}

// --- towers -------------------------------------------------------------------------------------
export function stats(kind: Kind, level: number) {
  const b = TOWERS[kind];
  return { ...b, dmg: b.dmg * 1.6 ** (level - 1), range: b.range + 0.35 * (level - 1), rate: b.rate * 1.1 ** (level - 1) };
}
export const upgradeCost = (tw: Tower) => Math.round(TOWERS[tw.kind].cost * 0.75 * tw.level);
export const sellValue = (tw: Tower) => Math.floor(tw.spent * 0.7);
export const towerAt = (s: TD, spot: number) => s.towers.find((tw) => tw.spot === spot);
const centre = (s: TD, spot: number) => ({ x: s.spots[spot].x + 0.5, y: s.spots[spot].y + 0.5 });
const playing = (s: TD) => s.phase === 'build' || s.phase === 'wave';

export function build(s: TD, spot: number, kind: Kind) {
  const cost = TOWERS[kind].cost;
  if (!playing(s) || !s.spots[spot] || towerAt(s, spot) || s.coins < cost) return false;
  s.coins -= cost;
  s.towers.push({ id: s.ids++, spot, kind, level: 1, cd: 0, spent: cost, aim: -Math.PI / 2 });
  return true;
}
export function upgrade(s: TD, id: number) {
  const tw = s.towers.find((x) => x.id === id);
  if (!playing(s) || !tw || tw.level >= MAX_LEVEL || s.coins < upgradeCost(tw)) return false;
  const c = upgradeCost(tw);
  s.coins -= c; tw.spent += c; tw.level++;
  return true;
}
export function sell(s: TD, id: number) {
  const tw = s.towers.find((x) => x.id === id);
  if (!playing(s) || !tw) return false;
  s.coins += sellValue(tw);
  s.towers = s.towers.filter((x) => x !== tw);
  return true;
}

// --- waves --------------------------------------------------------------------------------------
/** Who comes in wave w (1-based), in order, with when (seconds after it starts). */
export function waveOf(w: number): { foe: Foe; at: number }[] {
  const list: Foe[] = [];
  const walkers = 5 + w, runners = w >= 3 ? w - 1 : 0, brutes = w >= 5 ? Math.floor((w - 3) / 2) : 0;
  for (let i = 0; i < Math.max(walkers, runners); i++) { if (i < walkers) list.push('walker'); if (i < runners) list.push('runner'); }
  for (let i = 0; i < brutes; i++) list.push('brute');
  if (w % 6 === 0) list.push('boss');
  let at = 0;
  return list.map((foe) => { const x = { foe, at }; at += foe === 'runner' ? 0.6 : foe === 'walker' ? 0.9 : 1.6; return x; });
}
export const hpScale = (map: number, w: number) => (1 + 0.45 * (w - 1)) * (1 + 0.25 * map);

export function startWave(s: TD) {
  if (s.phase !== 'build' || s.wave >= WAVES) return false;
  s.wave++;
  s.phase = 'wave';
  s.waveT = 0;
  s.queue = waveOf(s.wave);
  return true;
}

// --- time ---------------------------------------------------------------------------------------
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);
/** The enemy furthest along the path within range of p. */
export function target(s: TD, p: P, range: number) {
  let best: Enemy | null = null;
  for (const e of s.enemies) if (e.hp > 0 && dist(along(s, e.d), p) <= range && (!best || e.d > best.d)) best = e;
  return best;
}

function fire(s: TD, tw: Tower) {
  const st = stats(tw.kind, tw.level), from = centre(s, tw.spot);
  const e = target(s, from, st.range);
  if (!e) return false;
  const at = along(s, e.d);
  if (st.splash) { for (const o of s.enemies) if (dist(along(s, o.d), at) <= st.splash) o.hp -= st.dmg; }
  else e.hp -= st.dmg;
  if (st.slow) e.slow = st.slow;
  tw.aim = Math.atan2(at.y - from.y, at.x - from.x);
  s.shots.push({ kind: tw.kind, from, to: at, ttl: tw.kind === 'splash' ? 0.25 : 0.12 });
  return true;
}

/** Move the battle on by dt seconds (use DT). */
export function step(s: TD, dt: number) {
  s.shots = s.shots.filter((x) => (x.ttl -= dt) > 0);
  if (s.phase !== 'wave') return;
  s.t += dt; s.waveT += dt;
  while (s.queue.length && s.queue[0].at <= s.waveT) {
    const { foe } = s.queue.shift()!;
    const hp = Math.round(FOES[foe].hp * hpScale(s.map, s.wave));
    s.enemies.push({ id: s.ids++, foe, hp, max: hp, d: 0, slow: 0 });
  }
  for (const e of s.enemies) {
    e.d += FOES[e.foe].speed * (e.slow > 0 ? 0.5 : 1) * dt;
    e.slow = Math.max(0, e.slow - dt);
  }
  for (const e of s.enemies.filter((x) => x.d >= s.total)) { s.lives -= FOES[e.foe].harm; e.hp = -Infinity; }
  s.enemies = s.enemies.filter((e) => e.hp !== -Infinity);
  if (s.lives <= 0) { s.lives = 0; s.phase = 'lost'; return; }
  for (const tw of s.towers) {
    tw.cd -= dt;
    if (tw.cd <= 0) tw.cd = fire(s, tw) ? 1 / stats(tw.kind, tw.level).rate : 0;
  }
  for (const e of s.enemies) if (e.hp <= 0) { s.coins += FOES[e.foe].reward; s.kills++; }
  s.enemies = s.enemies.filter((e) => e.hp > 0);
  if (!s.queue.length && !s.enemies.length) {
    s.coins += 5 + s.wave;
    s.phase = s.wave >= WAVES ? 'won' : 'build';
  }
}
