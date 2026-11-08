// Dart Spin: the wheel turns; tap to throw a dart into it. Darts stay in and turn with it; hit one
// and it's over. Throw them all to break the wheel and go on; fruit on the rim is extra, and every
// fifth wheel is a boss.
import { useRef, useState, type KeyboardEvent } from 'react';
import { t } from '@sanga/i18n';
import { newSeed, useSaved } from '../../kit';
import { beep, burst, drawEffects, expose, GameOver, Hud, popText, shakeOffset, TapToStart, useCanvasLoop, type Pop, type Spark } from '../stack/arcade';
import { angleAt, FLIGHT, hits, land, landsAt, POINTS, startStage, type Play } from './logic';

type Phase = 'ready' | 'play' | 'clear' | 'dying' | 'over';
interface World {
  phase: Phase; seed: number; play: Play; t0: number; left: number; flying: number[];
  now: number; endAt: number; shake: number; kick: number; sparks: Spark[]; pops: Pop[];
  bounce: { x: number; y: number; vx: number; vy: number; rot: number; vr: number } | null;
}

const FW = 360, FH = 640, CX = 180, CY = 230, R = 88, HAND = 560, LEN = 64;
const PRIZES = ['🍎', '🍊', '🍋', '🍇'];

function world(seed: number): World {
  const play = startStage(1, seed);
  return { phase: 'ready', seed, play, t0: 0, left: play.stage.darts, flying: [], now: 0, endAt: 0, shake: 0, kick: 0, sparks: [], pops: [], bounce: null };
}

/** A dart from its tip (at 0,0) back along +x. */
function dart(ctx: CanvasRenderingContext2D, color: string, dim = false) {
  ctx.globalAlpha = dim ? 0.55 : 1;
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(12, -2.2); ctx.lineTo(12, 2.2); ctx.fill();
  ctx.fillStyle = '#334155'; ctx.fillRect(12, -2.5, 34, 5);
  ctx.fillStyle = '#94a3b8'; ctx.fillRect(18, -3, 8, 6);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(44, 0); ctx.lineTo(LEN, -8); ctx.lineTo(LEN - 4, 0); ctx.lineTo(LEN, 8); ctx.fill();
  ctx.globalAlpha = 1;
}

export default function DartSpin() {
  const [saved, setSaved] = useSaved('dartspin', { best: 0, stage: 0 });
  const [phase, setPhase] = useState<Phase>('ready');
  const [score, setScore] = useState(0);
  const [stage, setStage] = useState({ n: 1, boss: false });
  const [over, setOver] = useState<{ score: number; best: number; isNew: boolean; stage: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const W = useRef<World>(null as unknown as World);
  if (!W.current) W.current = world(newSeed());
  const bestRef = useRef(saved);
  bestRef.current = saved;

  const finish = (g: World) => {
    g.phase = 'over';
    const b = bestRef.current, s = g.play.score, n = g.play.stage.n, isNew = s > b.best;
    if (isNew || n > b.stage) setSaved({ best: Math.max(s, b.best), stage: Math.max(n, b.stage) });
    setOver({ score: s, best: Math.max(s, b.best), isNew, stage: n });
    setPhase('over');
  };

  const tap = () => {
    const g = W.current;
    if (g.phase === 'ready') { g.phase = 'play'; g.t0 = g.now; setPhase('play'); return; }
    if (g.phase !== 'play' || g.left <= 0) return;
    g.left--; g.flying.push(g.now);
    beep(700, 0.05, 'triangle', 0.02, -300);
  };

  const again = () => {
    const g = world(newSeed());
    g.phase = 'play'; g.now = W.current.now; g.t0 = g.now;
    W.current = g;
    setScore(0); setStage({ n: 1, boss: false }); setOver(null); setPhase('play');
  };

  const canvas = useCanvasLoop((ctx, w, h, now, dt) => {
    const g = W.current, st = g.play.stage;
    g.now = now;
    if (g.phase === 'ready') g.t0 = now;
    const s = Math.min(w / FW, h / FH, 1.5), ox = (w - FW * s) / 2, oy = Math.max(0, (h - FH * s) / 2);
    const X = (x: number) => ox + x * s, Y = (y: number) => oy + y * s;

    // darts reaching the wheel, at exactly when they arrive
    while (g.phase === 'play' && g.flying.length && now >= g.flying[0] + FLIGHT * 1000) {
      const f = g.flying.shift()!, a = landsAt(st.spin, (f - g.t0) / 1000), r = land(g.play, a);
      if (r.result === 'hit') {
        g.phase = 'dying'; g.endAt = now + 900; g.flying = []; g.shake = 10;
        g.bounce = { x: CX, y: CY + R + 2, vx: (Math.random() - 0.5) * 260, vy: 160, rot: Math.PI / 2, vr: (Math.random() < 0.5 ? -1 : 1) * 14 };
        burst(g.sparks, X(CX), Y(CY + R), ['#fde047', '#fff'], 12, 200, 3);
        beep(150, 0.3, 'square', 0.025, -80);
        break;
      }
      g.play = r.play; g.kick = 7;
      setScore(r.play.score);
      burst(g.sparks, X(CX), Y(CY + R), st.boss ? ['#94a3b8', '#e2e8f0'] : ['#d6a064', '#8b5a2b'], 7, 150, 3);
      beep(520, 0.05, 'square', 0.015);
      if (r.prize >= 0) {
        burst(g.sparks, X(CX), Y(CY + R + 14), ['#ef4444', '#fde047', '#22c55e', '#fff'], 18, 260, 4);
        popText(g.pops, X(CX + 50), Y(CY + R + 20), `+${POINTS.prize}`, '#fde047', 22);
        beep(880, 0.12, 'triangle', 0.025, 400);
      }
      if (r.result === 'clear') {
        g.phase = 'clear'; g.endAt = now + 1100;
        burst(g.sparks, X(CX), Y(CY), st.boss ? ['#475569', '#94a3b8', '#ef4444'] : ['#d6a064', '#8b5a2b', '#5c3a1a'], 40, 420, 9);
        popText(g.pops, X(CX), Y(CY), st.boss ? `${t('Wheel broken!')} +${POINTS.boss}` : t('Wheel broken!'), '#fff', 26);
        beep(392, 0.1, 'triangle', 0.03); beep(587, 0.2, 'triangle', 0.025, 200);
      }
    }
    if (g.phase === 'clear' && now >= g.endAt) {
      g.play = startStage(st.n + 1, g.seed, g.play.score);
      g.left = g.play.stage.darts; g.t0 = now; g.phase = 'play';
      const ns = g.play.stage;
      setStage({ n: ns.n, boss: ns.boss });
      popText(g.pops, X(CX), Y(CY - R - 40), ns.boss ? t('Boss wheel!') : t('Stage {n}', { n: ns.n }), ns.boss ? '#fca5a5' : '#fff', 28);
    }
    if (g.phase === 'dying' && now >= g.endAt) finish(g);

    // background
    const bg = ctx.createRadialGradient(X(CX), Y(CY), 10, X(CX), Y(CY), Math.max(w, h));
    bg.addColorStop(0, st.boss ? '#4c0519' : '#3b2f2a'); bg.addColorStop(0.5, st.boss ? '#1c0a12' : '#1c1917'); bg.addColorStop(1, '#0c0a09');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

    const [kx, ky] = shakeOffset(g.shake);
    g.shake = Math.max(0, g.shake - dt * 30);
    g.kick = Math.max(0, g.kick - dt * 60);
    ctx.save(); ctx.translate(kx, ky);

    const cur = g.play, sp = cur.stage, tt = (now - g.t0) / 1000;
    const theta = angleAt(sp.spin, tt);
    const appear = g.phase === 'play' ? Math.min(1, tt / 0.25) : 1;
    const wx = X(CX), wy = Y(CY) - g.kick * s, wr = R * s * (0.6 + 0.4 * appear);

    if (g.phase !== 'clear') {
      // darts in the wheel, then the wheel over their tips
      for (const [i, a] of cur.stuck.entries()) {
        const phi = theta + a;
        ctx.save(); ctx.translate(wx + Math.cos(phi) * (wr - 10 * s), wy + Math.sin(phi) * (wr - 10 * s)); ctx.rotate(phi); ctx.scale(s, s);
        dart(ctx, i < sp.stuck.length ? '#64748b' : '#f43f5e');
        ctx.restore();
      }
      ctx.save(); ctx.translate(wx, wy); ctx.rotate(theta);
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 24 * s;
      const face = ctx.createRadialGradient(0, 0, 4, 0, 0, wr);
      if (sp.boss) { face.addColorStop(0, '#64748b'); face.addColorStop(1, '#1e293b'); }
      else { face.addColorStop(0, '#e2b07a'); face.addColorStop(0.7, '#b07840'); face.addColorStop(1, '#7c4a1e'); }
      ctx.fillStyle = face; ctx.beginPath(); ctx.arc(0, 0, wr, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 2 * s; ctx.strokeStyle = sp.boss ? 'rgba(255,255,255,0.12)' : 'rgba(60,30,10,0.25)';
      for (const k of [0.32, 0.55, 0.78]) { ctx.beginPath(); ctx.arc(0, 0, wr * k, 0.3, Math.PI * 2 - 0.6); ctx.stroke(); }
      if (sp.boss) {
        ctx.fillStyle = '#cbd5e1';
        for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; ctx.beginPath(); ctx.arc(Math.cos(a) * wr * 0.88, Math.sin(a) * wr * 0.88, 3.2 * s, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = '#ef4444';
      } else ctx.fillStyle = '#5c3a1a';
      ctx.beginPath(); ctx.arc(0, 0, 13 * s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(-3 * s, -3 * s, 4 * s, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.font = `${Math.round(24 * s)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      cur.prizes.forEach((a, i) => {
        const phi = theta + a, d = wr + 14 * s;
        ctx.fillText(PRIZES[(i + sp.n) % PRIZES.length], wx + Math.cos(phi) * d, wy + Math.sin(phi) * d);
      });
    }

    // darts in flight, and the next one in hand
    for (const f of g.flying) {
      const k = Math.min(1, (now - f) / (FLIGHT * 1000));
      ctx.save(); ctx.translate(X(CX), Y(HAND - (HAND - (CY + R - 10)) * k)); ctx.rotate(Math.PI / 2); ctx.scale(s, s); dart(ctx, '#f43f5e'); ctx.restore();
    }
    if ((g.phase === 'play' || g.phase === 'ready') && g.left > 0 && !(g.flying.length && now - g.flying[g.flying.length - 1] < 60)) {
      const bob = Math.sin(now / 300) * 3;
      ctx.save(); ctx.translate(X(CX), Y(HAND) + bob * s); ctx.rotate(Math.PI / 2); ctx.scale(s, s); dart(ctx, '#f43f5e'); ctx.restore();
    }
    if (g.bounce) {
      const b = g.bounce; b.vy += 1400 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt;
      if (Y(b.y) > h + 100) g.bounce = null;
      else { ctx.save(); ctx.translate(X(b.x), Y(b.y)); ctx.rotate(b.rot); ctx.scale(s, s); dart(ctx, '#f43f5e'); ctx.restore(); }
    }

    // darts still to throw
    for (let i = 0; i < sp.darts; i++) {
      const thrown = i >= g.left;
      ctx.save(); ctx.translate(X(16 + i * 11), Y(HAND + 34)); ctx.rotate(Math.PI / 2); ctx.scale(s * 0.36, s * 0.36);
      dart(ctx, thrown ? '#57534e' : '#f43f5e', thrown);
      ctx.restore();
    }

    drawEffects(ctx, g.sparks, g.pops, dt);
    ctx.restore();

    const inFlight = g.flying.map((f) => landsAt(sp.spin, (f - g.t0) / 1000));
    expose(root.current, {
      state: g.phase, score: cur.score, stage: sp.n, left: g.left,
      safe: g.phase === 'play' && g.left > 0 && !hits([...cur.stuck, ...inFlight], landsAt(sp.spin, tt)) ? 1 : 0,
    });
  });

  const key = (e: KeyboardEvent) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) tap(); } };

  return (
    <div ref={root} className="relative h-full touch-none select-none overflow-hidden outline-none" role="application" aria-label={t('Dart Spin')} tabIndex={0}
      onPointerDown={(e) => { if (e.button === 0 && !(e.target as HTMLElement).closest('button')) tap(); }} onKeyDown={key}>
      <canvas ref={canvas} className="absolute inset-0 size-full" aria-hidden />
      <Hud score={score} best={saved.best}>
        <span className={stage.boss ? 'mt-1 rounded-full bg-rose-600 px-3 py-0.5 text-xs font-bold' : 'mt-1 rounded-full bg-black/30 px-3 py-0.5 text-xs font-bold'}>
          {stage.boss ? t('Boss wheel!') : t('Stage {n}', { n: stage.n })}
        </span>
      </Hud>
      {phase === 'ready' && <TapToStart emoji="🎯" hint={t('Tap to throw. Don’t hit another dart.')} />}
      {over && (
        <GameOver score={over.score} best={over.best} isNew={over.isNew} onAgain={again}>
          <span className="block">{t('Reached stage {n}', { n: over.stage })}</span>
        </GameOver>
      )}
    </div>
  );
}
