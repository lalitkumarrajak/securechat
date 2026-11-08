// Stack Up: a block slides above the tower; tap to drop it. What hangs over is cut off and falls;
// drop it exactly and it stays whole (a few in a row grow it back). Miss and it's over.
import { useRef, useState, type KeyboardEvent } from 'react';
import { t } from '@sanga/i18n';
import { newSeed, rng, useSaved } from '../../kit';
import { beep, burst, drawEffects, expose, GameOver, Hud, popText, shakeOffset, TapToStart, useCanvasLoop, type Pop, type Spark } from './arcade';
import { base, BLOCK_H, drop, FIELD, grow, hueAt, speedAt, swing, swingVelocity, type Slab } from './logic';

type Phase = 'ready' | 'play' | 'dying' | 'over';
interface Block extends Slab { hue: number }
interface Chip extends Block { y: number; vy: number; vx: number; rot: number; vr: number }
interface World {
  phase: Phase; blocks: Block[]; w: number; t0: number; side: 1 | -1; chips: Chip[]; combo: number;
  cam: number; now: number; endAt: number; shake: number; ring: { b: Block; y: number; life: number; fresh: boolean } | null;
  sparks: Spark[]; pops: Pop[]; hue0: number; stars: [number, number, number][];
}

function world(seed: number): World {
  const r = rng(seed), hue0 = r.int(360);
  return {
    phase: 'ready', blocks: [{ ...base(), hue: hue0 }], w: base().w, t0: 0, side: r.next() < 0.5 ? -1 : 1, chips: [], combo: 0,
    cam: 0, now: 0, endAt: 0, shake: 0, ring: null, sparks: [], pops: [], hue0,
    stars: Array.from({ length: 40 }, () => [r.next(), r.next() * 3, 0.5 + r.next() * 1.5]),
  };
}

export default function StackUp() {
  const [saved, setSaved] = useSaved('stack', { best: 0 });
  const [phase, setPhase] = useState<Phase>('ready');
  const [score, setScore] = useState(0);
  const [over, setOver] = useState<{ score: number; best: number; isNew: boolean } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const W = useRef<World>(null as unknown as World);
  if (!W.current) W.current = world(newSeed());
  const bestRef = useRef(saved.best);
  bestRef.current = saved.best;

  const level = (g: World) => g.blocks.length; // the slider's level
  const moverX = (g: World) => {
    const prev = g.blocks[g.blocks.length - 1];
    return prev.x + swing((g.now - g.t0) / 1000, g.w, speedAt(level(g) - 1), g.side);
  };

  const finish = (g: World) => {
    g.phase = 'over';
    const s = g.blocks.length - 1, isNew = s > bestRef.current;
    if (isNew) setSaved({ best: s });
    setOver({ score: s, best: Math.max(s, bestRef.current), isNew });
    setPhase('over');
  };

  const tap = () => {
    const g = W.current;
    if (g.phase === 'ready') { g.phase = 'play'; g.t0 = g.now; setPhase('play'); return; }
    if (g.phase !== 'play') return;
    const prev = g.blocks[g.blocks.length - 1], n = level(g), hue = hueAt(g.hue0, n);
    const cur = { x: moverX(g), w: g.w }, res = drop(prev, cur), y = n * BLOCK_H;
    if (res.kind === 'miss') {
      g.chips.push({ ...cur, hue, y, vy: 0, vx: (cur.x > prev.x ? 1 : -1) * 40, rot: 0, vr: (cur.x > prev.x ? 1 : -1) * 2.5 });
      g.phase = 'dying'; g.endAt = g.now + 800; g.shake = 9; g.combo = 0;
      beep(140, 0.35, 'sawtooth', 0.03, -80);
      return;
    }
    let slab = res.slab;
    if (res.kind === 'perfect') {
      g.combo++;
      slab = grow(slab, g.combo);
      g.ring = { b: { ...slab, hue }, y, life: 0, fresh: true };
      beep(440 * Math.pow(2, Math.min(g.combo, 12) / 12), 0.12, 'triangle');
    } else {
      g.combo = 0;
      const right = res.chip.x > slab.x;
      g.chips.push({ ...res.chip, hue, y, vy: 0, vx: (right ? 1 : -1) * 60, rot: 0, vr: (right ? 1 : -1) * (1.5 + Math.random() * 2) });
      g.shake = 2;
      beep(260, 0.07, 'square', 0.02);
    }
    g.blocks.push({ ...slab, hue });
    g.w = slab.w; g.t0 = g.now; g.side = g.side === 1 ? -1 : 1;
    setScore(g.blocks.length - 1);
  };

  const again = () => {
    const g = world(newSeed());
    g.phase = 'play'; g.now = W.current.now; g.t0 = g.now;
    W.current = g;
    setScore(0); setOver(null); setPhase('play');
  };

  const canvas = useCanvasLoop((ctx, w, h, now, dt) => {
    const g = W.current;
    g.now = now;
    if (g.phase === 'ready') g.t0 = now;
    if (g.phase === 'dying' && now >= g.endAt) finish(g);

    const s = Math.min(w / FIELD, h / 520, 1.7), ox = w / 2 - (FIELD / 2) * s, ground = h * 0.74;
    const top = level(g) * BLOCK_H;
    const target = Math.max(0, top - (h * 0.36) / s);
    g.cam += (target - g.cam) * Math.min(1, dt * 5);
    const sy = (y: number) => ground - (y - g.cam) * s;

    // the sky turns as you climb; stars come out high up
    const hb = hueAt(g.hue0, level(g)) + 200;
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, `hsl(${hb} 45% 13%)`); sky.addColorStop(1, `hsl(${hb + 35} 50% 30%)`);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    const starA = Math.min(0.9, level(g) / 25 + 0.15);
    ctx.fillStyle = '#fff';
    for (const [sx, syy, r] of g.stars) {
      const y = ((syy * h + g.cam * s * 0.25) % (h * 3)) - h;
      if (y < -4 || y > h) continue;
      ctx.globalAlpha = starA * (0.4 + 0.6 * Math.abs(Math.sin(now / 900 + sx * 20)));
      ctx.fillRect(sx * w, y, r, r);
    }
    ctx.globalAlpha = 1;

    const [kx, ky] = shakeOffset(g.shake);
    g.shake = Math.max(0, g.shake - dt * 30);
    ctx.save(); ctx.translate(kx, ky);

    const D = 9 * s, Dy = 7 * s;
    const slab = (x: number, y: number, bw: number, hue: number, light = 0) => {
      const X = ox + x * s, Y = sy(y), Wd = bw * s, Hh = BLOCK_H * s;
      ctx.fillStyle = `hsl(${hue} 72% ${74 + light}%)`; // top
      ctx.beginPath(); ctx.moveTo(X, Y - Hh); ctx.lineTo(X + Wd, Y - Hh); ctx.lineTo(X + Wd + D, Y - Hh - Dy); ctx.lineTo(X + D, Y - Hh - Dy); ctx.fill();
      ctx.fillStyle = `hsl(${hue} 60% ${40 + light}%)`; // side
      ctx.beginPath(); ctx.moveTo(X + Wd, Y - Hh); ctx.lineTo(X + Wd + D, Y - Hh - Dy); ctx.lineTo(X + Wd + D, Y - Dy); ctx.lineTo(X + Wd, Y); ctx.fill();
      ctx.fillStyle = `hsl(${hue} 70% ${57 + light}%)`; // front
      ctx.fillRect(X, Y - Hh, Wd, Hh);
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(X, Y - Hh, Wd, 2 * s);
    };

    // the plinth under the first block, down past the bottom
    const b0 = g.blocks[0];
    const px = ox + (b0.x - 6) * s, pw = (b0.w + 12) * s;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(px, sy(0), pw + D, h);
    ctx.fillStyle = `hsl(${g.hue0} 25% 22%)`; ctx.fillRect(px, sy(0), pw, h);

    const from = Math.max(0, Math.floor((g.cam - 40) / BLOCK_H));
    for (let i = from; i < g.blocks.length; i++) { const b = g.blocks[i]; if (sy(i * BLOCK_H) > -40) slab(b.x, i * BLOCK_H, b.w, b.hue); }

    if (g.phase === 'play') slab(moverX(g), top, g.w, hueAt(g.hue0, level(g)), 4);

    for (let i = g.chips.length - 1; i >= 0; i--) {
      const c = g.chips[i];
      c.vy -= 1100 * dt; c.y += c.vy * dt; c.x += c.vx * dt; c.rot += c.vr * dt;
      if (sy(c.y) > h + 200) { g.chips.splice(i, 1); continue; }
      const cx = ox + (c.x + c.w / 2) * s, cy = sy(c.y) - (BLOCK_H * s) / 2;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(c.rot);
      ctx.fillStyle = `hsl(${c.hue} 70% 57%)`; ctx.fillRect((-c.w / 2) * s, (-BLOCK_H / 2) * s, c.w * s, BLOCK_H * s);
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect((-c.w / 2) * s, 0, c.w * s, (BLOCK_H / 2) * s);
      ctx.restore();
    }

    if (g.ring) {
      const r = g.ring; r.life += dt;
      if (r.life > 0.5) g.ring = null;
      else {
        const grow = r.life * 40 * s;
        ctx.strokeStyle = `rgba(255,255,255,${1 - r.life * 2})`; ctx.lineWidth = 3;
        ctx.strokeRect(ox + r.b.x * s - grow, sy(r.y) - BLOCK_H * s - grow, r.b.w * s + grow * 2, BLOCK_H * s + grow * 2);
        if (r.fresh) {
          r.fresh = false;
          burst(g.sparks, ox + (r.b.x + r.b.w / 2) * s, sy(r.y) - BLOCK_H * s, ['#fff', `hsl(${r.b.hue} 90% 75%)`], 16, 240, 4);
          popText(g.pops, ox + (r.b.x + r.b.w / 2) * s, sy(r.y) - BLOCK_H * s - 30, g.combo > 1 ? `${t('Perfect!')} ×${g.combo}` : t('Perfect!'), '#fff', 22);
        }
      }
    }
    drawEffects(ctx, g.sparks, g.pops, dt);
    ctx.restore();

    const prev = g.blocks[g.blocks.length - 1], st = (now - g.t0) / 1000, sp = speedAt(level(g) - 1);
    expose(root.current, {
      state: g.phase, score: g.blocks.length - 1, dx: (moverX(g) - prev.x).toFixed(1), w: prev.w.toFixed(1),
      v: g.phase === 'play' ? swingVelocity(st, g.w, sp, g.side).toFixed(0) : 0,
    });
  });

  const key = (e: KeyboardEvent) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) tap(); } };

  return (
    <div ref={root} className="relative h-full touch-none select-none overflow-hidden outline-none" role="application" aria-label={t('Stack Up')} tabIndex={0}
      onPointerDown={(e) => { if (e.button === 0 && !(e.target as HTMLElement).closest('button')) tap(); }} onKeyDown={key}>
      <canvas ref={canvas} className="absolute inset-0 size-full" aria-hidden />
      <Hud score={score} best={saved.best} />
      {phase === 'ready' && <TapToStart emoji="🧱" hint={t('Drop each block right on top of the last.')} />}
      {over && <GameOver score={over.score} best={over.best} isNew={over.isNew} onAgain={again} />}
    </div>
  );
}
