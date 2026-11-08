// Flip It: hold to charge, let go to flip the bottle onto the next table. It has to land on the
// table and standing up; land in the middle for a perfect (and a streak). Anything else ends it.
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { t } from '@sanga/i18n';
import { newSeed, useSaved } from '../../kit';
import { beep, burst, drawEffects, expose, GameOver, Hud, popText, shakeOffset, TapToStart, useCanvasLoop, type Pop, type Spark } from '../stack/arcade';
import { at, chargeOf, firstPlat, G, HALF_H, holdFor, idealPower, launch, nextPlat, outcome, points, spinFor, tilt, type Outcome, type Plat, type Throw } from './logic';

type Phase = 'ready' | 'aim' | 'charge' | 'fly' | 'settle' | 'tip' | 'fall' | 'over';
interface World {
  phase: Phase; seed: number; n: number; score: number; streak: number;
  from: Plat; to: Plat; prev: Plat | null; bottle: { x: number; y: number; a: number };
  ideal: number; spin: number; press: number; rel: number; l: Throw | null; out: Outcome | null;
  tip: { dir: number; vx: number; vy: number; va: number; t: number };
  cam: { x: number; y: number; s: number }; now: number; endAt: number; shake: number; sparks: Spark[]; pops: Pop[];
}

const LOOKS = [
  { top: '#f59e0b', body: '#b45309', edge: '#fde68a' },
  { top: '#38bdf8', body: '#0369a1', edge: '#bae6fd' },
  { top: '#f472b6', body: '#9d174d', edge: '#fbcfe8' },
  { top: '#a3e635', body: '#3f6212', edge: '#d9f99d' },
];

function aimAt(g: World) {
  g.ideal = idealPower(g.bottle, g.to);
  g.spin = spinFor(g.bottle, g.to);
}
function world(seed: number): World {
  const from = firstPlat(), to = nextPlat(from, 0, seed);
  const g: World = {
    phase: 'ready', seed, n: 0, score: 0, streak: 0, from, to, prev: null, bottle: { x: from.x, y: from.y, a: 0 },
    ideal: 0.5, spin: 8, press: 0, rel: 0, l: null, out: null, tip: { dir: 1, vx: 0, vy: 0, va: 0, t: 0 },
    cam: { x: 0, y: 0, s: 0 }, now: 0, endAt: 0, shake: 0, sparks: [], pops: [],
  };
  aimAt(g);
  return g;
}

export default function FlipIt() {
  const [saved, setSaved] = useSaved('bottleflip', { best: 0 });
  const [phase, setPhase] = useState<Phase>('ready');
  const [score, setScore] = useState(0);
  const [over, setOver] = useState<{ score: number; best: number; isNew: boolean } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const W = useRef<World>(null as unknown as World);
  if (!W.current) W.current = world(newSeed());
  const bestRef = useRef(saved.best);
  bestRef.current = saved.best;

  const finish = (g: World) => {
    g.phase = 'over';
    const isNew = g.score > bestRef.current;
    if (isNew) setSaved({ best: g.score });
    setOver({ score: g.score, best: Math.max(g.score, bestRef.current), isNew });
    setPhase('over');
  };

  const press = (e?: PointerEvent) => {
    const g = W.current;
    if (g.phase === 'ready') { g.phase = 'aim'; setPhase('aim'); return; }
    if (g.phase !== 'aim') return;
    if (e) { try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* fine without */ } }
    g.phase = 'charge'; g.press = performance.now();
    beep(220, 0.06, 'sine', 0.02);
  };
  const release = () => {
    const g = W.current;
    if (g.phase !== 'charge') return;
    const now = performance.now(), p = chargeOf(now - g.press);
    g.l = launch(p, g.bottle, g.spin);
    g.out = outcome(g.l, g.from, g.to);
    g.phase = 'fly'; g.rel = now;
    beep(300 + p * 400, 0.12, 'triangle', 0.025, 200);
  };

  const again = () => {
    const g = world(newSeed());
    g.phase = 'aim'; g.now = W.current.now;
    W.current = g;
    setScore(0); setOver(null); setPhase('aim');
  };

  const canvas = useCanvasLoop((ctx, w, h, now, dt) => {
    const g = W.current;
    g.now = now;

    // what happens this frame
    if (g.phase === 'fly' && g.l && g.out) {
      const tt = Math.max(0, (now - g.rel) / 1000), o = g.out;
      if (o.kind !== 'miss' && tt >= o.t) {
        const pl = o.on === 'to' ? g.to : g.from;
        g.bottle = { x: o.x, y: pl.y, a: o.kind === 'land' ? 0 : o.angle };
        if (o.kind === 'tip') {
          const d = Math.sign(tilt(o.angle)) || 1;
          g.tip = { dir: d, vx: d * 40, vy: 0, va: d * 2, t: 0 };
          g.phase = 'tip'; g.endAt = now + 1100; g.shake = 6;
          beep(160, 0.3, 'sawtooth', 0.025, -70);
        } else if (o.on === 'from') {
          g.phase = 'aim'; aimAt(g);
          beep(330, 0.06, 'sine', 0.02);
        } else {
          const r = points(o.x - g.to.x, g.streak);
          g.streak = r.streak; g.score += r.points; g.n++;
          setScore(g.score);
          const sx = w / 2 + (o.x - g.cam.x) * g.cam.s, sy = h * 0.62 + (pl.y - g.cam.y) * g.cam.s;
          burst(g.sparks, sx, sy, r.perfect ? ['#fde047', '#fff', '#f472b6', '#60a5fa'] : ['#fff', '#e2e8f0'], r.perfect ? 22 : 10, r.perfect ? 260 : 150, 5);
          popText(g.pops, sx, sy - 90, r.perfect ? `${t('Perfect!')} +${r.points}` : `+${r.points}`, r.perfect ? '#fde047' : '#fff', r.perfect ? 24 : 20);
          if (r.streak > 1) popText(g.pops, sx, sy - 60, t('Streak {n}', { n: r.streak }), '#fff', 16);
          beep(r.perfect ? 660 : 520, 0.14, 'triangle', 0.03, r.perfect ? 300 : 0);
          g.prev = g.from; g.from = g.to; g.to = nextPlat(g.from, g.n, g.seed);
          aimAt(g);
          g.phase = 'settle'; g.endAt = now + 380;
        }
      } else {
        const p = at(g.l, tt);
        g.bottle = { x: p.x, y: p.y + HALF_H, a: p.angle };
        if ((p.y - g.cam.y) * g.cam.s > h * 0.38 + 120) { g.phase = 'fall'; g.endAt = now; }
      }
    }
    if (g.phase === 'settle' && now >= g.endAt) g.phase = 'aim';
    if (g.phase === 'tip') {
      const tp = g.tip; tp.t += dt;
      tp.va += tp.dir * 14 * dt; g.bottle.a += tp.va * dt;
      if (tp.t > 0.2) { tp.vy += G * 0.6 * dt; g.bottle.y += tp.vy * dt; g.bottle.x += tp.vx * dt; }
      if (now >= g.endAt) finish(g);
    }
    if (g.phase === 'fall') { g.shake = 5; finish(g); beep(120, 0.3, 'sawtooth', 0.02, -60); }

    // camera: both tables in view, zoomed to fit
    const left = Math.min(g.from.x - g.from.w / 2, g.bottle.x) - 50, right = g.to.x + g.to.w / 2 + 50;
    const ts = Math.min(w / Math.max(right - left, 360), h / 560, 1.6);
    const tx = (left + right) / 2, ty = (g.from.y + g.to.y) / 2;
    const k = Math.min(1, dt * 4);
    if (!g.cam.s) g.cam = { x: tx, y: ty, s: ts };
    else { g.cam.x += (tx - g.cam.x) * k; g.cam.y += (ty - g.cam.y) * k; g.cam.s += (ts - g.cam.s) * k; }
    const s = g.cam.s, X = (x: number) => w / 2 + (x - g.cam.x) * s, Y = (y: number) => h * 0.62 + (y - g.cam.y) * s;

    // sky, with soft lights drifting at their own depth
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0f172a'); sky.addColorStop(0.6, '#1e3a5f'); sky.addColorStop(1, '#334e68');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) {
      const px = ((i * 173 - g.cam.x * 0.3 * s) % (w + 200) + w + 200) % (w + 200) - 100, py = h * (0.12 + ((i * 37) % 50) / 100);
      ctx.fillStyle = `hsla(${(i * 47) % 360} 80% 70% / 0.05)`;
      ctx.beginPath(); ctx.arc(px, py, 30 + (i % 3) * 22, 0, Math.PI * 2); ctx.fill();
    }

    const [kx, ky] = shakeOffset(g.shake);
    g.shake = Math.max(0, g.shake - dt * 20);
    ctx.save(); ctx.translate(kx, ky);

    for (const pl of [g.prev, g.from, g.to]) {
      if (!pl) continue;
      const lk = LOOKS[pl.look % LOOKS.length], x0 = X(pl.x - pl.w / 2), top = Y(pl.y), pw = pl.w * s;
      if (x0 > w + 20 || x0 + pw < -20) continue;
      ctx.fillStyle = lk.body; ctx.fillRect(x0 + 6 * s, top, pw - 12 * s, h - top + 20);
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x0 + pw / 2, top, pw / 2 - 6 * s, h - top + 20);
      ctx.fillStyle = lk.top; ctx.beginPath(); ctx.roundRect(x0 - 4 * s, top - 2 * s, pw + 8 * s, 14 * s, 4 * s); ctx.fill();
      ctx.fillStyle = lk.edge; ctx.fillRect(x0 - 2 * s, top - 2 * s, pw + 4 * s, 3 * s);
      if (pl === g.to) { // where the middle is
        ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(X(pl.x) - 7 * s, top - 2 * s, 14 * s, 3 * s);
      }
    }

    // the bottle
    const b = g.bottle, charge = g.phase === 'charge' ? chargeOf(performance.now() - g.press) : 0;
    ctx.save();
    if (g.phase === 'fly' || g.phase === 'tip' || g.phase === 'fall') { ctx.translate(X(b.x), Y(b.y - HALF_H)); ctx.rotate(b.a); ctx.scale(s, s); }
    else { ctx.translate(X(b.x), Y(b.y)); ctx.scale(s * (1 + charge * 0.08), s * (1 - charge * 0.14)); ctx.translate(0, -HALF_H); }
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(2, HALF_H + 1, 13, 3, 0, 0, Math.PI * 2); if (g.phase !== 'fly') ctx.fill();
    ctx.fillStyle = 'rgba(186,230,253,0.35)'; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(-12, -18, 24, 48, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3b82f6'; ctx.beginPath(); ctx.roundRect(-11, 6, 22, 23, [0, 0, 6, 6]); ctx.fill();
    ctx.fillStyle = '#93c5fd'; ctx.fillRect(-11, 6, 22, 3);
    ctx.fillStyle = '#f97316'; ctx.fillRect(-12, -6, 24, 10);
    ctx.fillStyle = 'rgba(186,230,253,0.5)'; ctx.fillRect(-5, -27, 10, 10); ctx.strokeRect(-5, -27, 10, 10);
    ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.roundRect(-6.5, -31, 13, 6, 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(-8, -14, 3, 30);
    ctx.restore();

    // the power meter while you hold
    if (g.phase === 'charge') {
      const mx = X(b.x) - 34 * s - 12, my = Y(b.y) - 80 * s, mh = 80 * s;
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.roundRect(mx, my, 10, mh, 5); ctx.fill();
      const grd = ctx.createLinearGradient(0, my + mh, 0, my);
      grd.addColorStop(0, '#22c55e'); grd.addColorStop(0.6, '#facc15'); grd.addColorStop(1, '#ef4444');
      ctx.fillStyle = grd; ctx.beginPath(); ctx.roundRect(mx, my + mh * (1 - charge), 10, mh * charge, 5); ctx.fill();
    }

    drawEffects(ctx, g.sparks, g.pops, dt);
    ctx.restore();

    expose(root.current, { state: g.phase, score: g.score, hold: Math.round(holdFor(g.ideal)) });
  });

  const keyDown = (e: KeyboardEvent) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); press(); } };
  const keyUp = (e: KeyboardEvent) => { if (e.key === ' ' || e.key === 'Enter') release(); };
  const fromButton = (e: PointerEvent) => !!(e.target as HTMLElement).closest('button');

  return (
    <div ref={root} className="relative h-full touch-none select-none overflow-hidden outline-none" role="application" aria-label={t('Flip It')} tabIndex={0}
      onPointerDown={(e) => { if (e.button === 0 && !fromButton(e)) press(e); }} onPointerUp={release} onPointerCancel={release}
      onKeyDown={keyDown} onKeyUp={keyUp} onContextMenu={(e) => e.preventDefault()}>
      <canvas ref={canvas} className="absolute inset-0 size-full" aria-hidden />
      <Hud score={score} best={saved.best} />
      {phase === 'ready' && <TapToStart emoji="🍾" hint={t('Hold to charge, let go to flip.')} />}
      {over && <GameOver score={over.score} best={over.best} isNew={over.isNew} onAgain={again} />}
    </div>
  );
}
