import { useEffect } from 'react';
import { onTease } from './store';
import { teaseOf } from './teases';
import { playSound } from './sounds';

const quiet = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function centre(u: string) {
  const el = document.querySelector<HTMLElement>(`[data-player="${CSS.escape(u)}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { el, x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function float(emoji: string, size: number) {
  const d = document.createElement('div');
  d.textContent = emoji;
  d.setAttribute('aria-hidden', 'true');
  Object.assign(d.style, { position: 'fixed', left: '0', top: '0', zIndex: '70', pointerEvents: 'none', fontSize: size + 'px', lineHeight: '1', willChange: 'transform, opacity' }); // i18n-ok
  document.body.appendChild(d);
  return d;
}

/** Throws the thing from the sender's panel to the target's: it arcs across, lands with a bang and shakes them. */
function fly(f: string, to: string, k: string) {
  const t = teaseOf(k);
  const end = centre(to);
  if (!t || !end) return;
  const start = centre(f) ?? { x: innerWidth / 2, y: innerHeight, el: null };
  const hit = () => {
    const pop = float(t.hit, 64);
    if (quiet()) { pop.animate([{ transform: `translate(${end.x - 32}px, ${end.y - 32}px)`, opacity: 1 }, { transform: `translate(${end.x - 32}px, ${end.y - 32}px)`, opacity: 0 }], { duration: 900 }).onfinish = () => pop.remove(); return; }
    pop.animate([
      { transform: `translate(${end.x - 32}px, ${end.y - 32}px) scale(0.3)`, opacity: 1 },
      { transform: `translate(${end.x - 32}px, ${end.y - 44}px) scale(1.5)`, opacity: 1, offset: 0.35 },
      { transform: `translate(${end.x - 32}px, ${end.y - 90}px) scale(1.1)`, opacity: 0 },
    ], { duration: 1100, easing: 'ease-out' }).onfinish = () => pop.remove();
    if (t.shake) end.el.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-7px) rotate(-2deg)' }, { transform: 'translateX(7px) rotate(2deg)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(0)' }], { duration: 420 }); // i18n-ok
    playSound('chat');
    navigator.vibrate?.(25);
  };
  if (quiet()) return hit();
  const el = float(t.emoji, 44);
  const sx = start.x - 22, sy = start.y - 22, ex = end.x - 22, ey = end.y - 22;
  const mx = (sx + ex) / 2, my = Math.min(sy, ey) - 80 - Math.abs(ex - sx) * 0.1;
  const dur = 650 + Math.min(500, Math.hypot(ex - sx, ey - sy) * 0.6);
  el.animate([
    { transform: `translate(${sx}px, ${sy}px) scale(0.6) rotate(0deg)` },
    { transform: `translate(${mx}px, ${my}px) scale(1.35) rotate(200deg)`, offset: 0.5 },
    { transform: `translate(${ex}px, ${ey}px) scale(1) rotate(400deg)` },
  ], { duration: dur, easing: 'cubic-bezier(0.4, 0, 0.9, 0.7)', fill: 'forwards' }).onfinish = () => { el.remove(); hit(); };
}

/** Listens for teases in this game and plays them over the board. Draws nothing itself. */
export function TeaseLayer({ gid }: { gid: string }) {
  useEffect(() => onTease((m) => { if (m.id === gid) fly(m.f, m.to, m.k); }), [gid]);
  return null;
}
