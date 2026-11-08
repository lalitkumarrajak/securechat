// What the arcade games (Stack Up, Flip It, Dart Spin) share: a sharp canvas with a frame loop that
// stops while the tab is hidden, a quiet sound, sparks and floating words, the score along the top,
// "Tap to start", and the game-over card. Time is the frame's own timestamp, so tests can drive it.
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { t } from '@sanga/i18n';
import { ResultCard, testMode, useSaved } from '../../kit';

export type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number, now: number, dt: number) => void;

/** A canvas filling its box at the screen's pixel density; draw() runs every frame (not while hidden). */
export function useCanvasLoop(draw: Draw) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const fn = useRef(draw);
  useLayoutEffect(() => { fn.current = draw; });
  useEffect(() => {
    const c = canvas.current!;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    let w = 0, h = 0, raf = 0, last = -1;
    const fit = () => {
      const r = c.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 3);
      w = r.width; h = r.height; c.width = Math.round(w * d); c.height = Math.round(h * d);
      ctx.setTransform(d, 0, 0, d, 0, 0);
    };
    const ro = new ResizeObserver(fit); ro.observe(c); fit();
    const frame = (now: number) => {
      const dt = last < 0 ? 0 : Math.max(0, Math.min((now - last) / 1000, 0.05));
      last = now;
      if (w && h) fn.current(ctx, w, h, now, dt);
      raf = requestAnimationFrame(frame);
    };
    const start = () => { cancelAnimationFrame(raf); last = -1; raf = requestAnimationFrame(frame); };
    const vis = () => { if (document.hidden) cancelAnimationFrame(raf); else start(); };
    document.addEventListener('visibilitychange', vis);
    start();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('visibilitychange', vis); };
  }, []);
  return canvas;
}

export const reducedMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

// ---- sound: tiny beeps, quiet, never an error ----
let ac: AudioContext | null = null;
let muted = false;
export function beep(freq: number, dur = 0.08, type: OscillatorType = 'sine', vol = 0.035, slide = 0) {
  if (muted || testMode()) return;
  try {
    ac ??= new AudioContext();
    if (ac.state === 'suspended') void ac.resume().catch(() => {});
    const o = ac.createOscillator(), g = ac.createGain(), at = ac.currentTime;
    o.type = type; o.frequency.setValueAtTime(freq, at);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), at + dur);
    g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(ac.destination); o.start(at); o.stop(at + dur + 0.02);
  } catch { /* no sound here */ }
}

/** Sound on or off, kept on this device for all the arcade games. */
export function SoundButton() {
  const [s, set] = useSaved('arcade', { sound: true });
  muted = !s.sound;
  return (
    <button type="button" aria-label={t('Sounds')} aria-pressed={s.sound} title={t('Sounds')}
      onPointerDown={(e) => e.stopPropagation()} onClick={() => set({ sound: !s.sound })}
      className="pointer-events-auto grid size-9 place-items-center rounded-full bg-black/25 text-white/90 hover:bg-black/40">
      {s.sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
    </button>
  );
}

// ---- sparks and floating words, in screen pixels ----
export interface Spark { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number }
export interface Pop { x: number; y: number; text: string; life: number; color: string; size: number }

export function burst(list: Spark[], x: number, y: number, color: string | string[], n = 14, speed = 220, size = 4) {
  if (reducedMotion()) n = Math.ceil(n / 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = speed * (0.35 + Math.random() * 0.65);
    const c = Array.isArray(color) ? color[i % color.length] : color;
    list.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, life: 0, max: 0.5 + Math.random() * 0.5, color: c, size: size * (0.6 + Math.random() * 0.8) });
  }
}
export function popText(list: Pop[], x: number, y: number, text: string, color = '#fff', size = 22) {
  list.push({ x, y, text, life: 0, color, size });
}
export function drawEffects(ctx: CanvasRenderingContext2D, sparks: Spark[], pops: Pop[], dt: number, gravity = 600) {
  for (let i = sparks.length - 1; i >= 0; i--) {
    const p = sparks[i];
    p.life += dt; p.vy += gravity * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.life >= p.max) { sparks.splice(i, 1); continue; }
    ctx.globalAlpha = 1 - p.life / p.max;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i];
    p.life += dt;
    if (p.life >= 1) { pops.splice(i, 1); continue; }
    const k = p.life < 0.15 ? 0.6 + (p.life / 0.15) * 0.5 : 1.1 - Math.min(0.1, (p.life - 0.15));
    ctx.globalAlpha = p.life > 0.6 ? (1 - p.life) / 0.4 : 1;
    ctx.font = `800 ${Math.round(p.size * k)}px system-ui, sans-serif`;
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    const y = p.y - p.life * 40;
    ctx.strokeText(p.text, p.x, y);
    ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, y);
  }
  ctx.globalAlpha = 1;
}

/** A small shake that fades: returns the offset for this frame. */
export function shakeOffset(amount: number) {
  if (amount <= 0 || reducedMotion()) return [0, 0];
  return [(Math.random() - 0.5) * amount * 2, (Math.random() - 0.5) * amount * 2];
}

/** Tests read the game's state off its root (only in test mode). */
export function expose(el: HTMLElement | null, data: Record<string, string | number>) {
  if (!el || !testMode()) return;
  for (const [k, v] of Object.entries(data)) { const s = String(v); if (el.dataset[k] !== s) el.dataset[k] = s; }
}

// ---- what's over the canvas ----
export function Hud({ score, best, children }: { score: number; best: number; children?: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-3">
      <SoundButton />
      <div className="flex flex-col items-center">
        <span key={score} className="animate-pop text-5xl font-black tabular-nums drop-shadow-[0_3px_0_rgba(0,0,0,0.25)]" aria-live="polite" aria-label={t('Score {n}', { n: score })}>{score}</span>
        {children}
      </div>
      <span className="rounded-full bg-black/25 px-3 py-1.5 text-xs font-bold tabular-nums">{t('Best {n}', { n: best })}</span>
    </div>
  );
}

export function TapToStart({ emoji, hint }: { emoji: string; hint: string }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[14%] z-10 flex flex-col items-center gap-2 px-6 text-center">
      <span className="text-4xl motion-safe:animate-bounce" aria-hidden>{emoji}</span>
      <span className="rounded-full bg-white px-6 py-2.5 text-lg font-extrabold text-slate-900 shadow-xl motion-safe:animate-pulse">{t('Tap to start')}</span>
      <span className="text-sm font-medium text-white/80">{hint}</span>
    </div>
  );
}

export function GameOver({ score, best, isNew, onAgain, children }: { score: number; best: number; isNew: boolean; onAgain: () => void; children?: ReactNode }) {
  return (
    <ResultCard emoji={isNew ? '🏆' : '💥'} title={t('Game over')} primary={{ label: t('Play again'), onClick: onAgain }}>
      <span className="block text-4xl font-black tabular-nums text-slate-900">{score}</span>
      <span className="block font-semibold">{t('Score {n}', { n: score })}</span>
      {children}
      <span className={isNew ? 'mt-2 block font-bold text-amber-600' : 'mt-2 block'}>{isNew ? t('New best!') : t('Best {n}', { n: best })}</span>
    </ResultCard>
  );
}
