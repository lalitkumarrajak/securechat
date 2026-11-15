import { useEffect } from 'react';
import { onTease } from './store';
import { teaseOf } from './teases';
import { playSound } from './sounds';

const STAY = 3000; // ms it stays on their photo
const quiet = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The player's photo (or their whole panel): where things are thrown at. */
function centre(u: string) {
  const panel = `[data-player="${CSS.escape(u)}"]`;
  const el = document.querySelector<HTMLElement>(`${panel} [data-photo]`) ?? document.querySelector<HTMLElement>(panel);
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
  // It lands on their photo and stays a few seconds: what was thrown sticks there and wobbles, its
  // effect bursts out around it, and the photo shakes for the rough ones.
  const hit = () => {
    const at = (size: number, dx = 0, dy = 0, extra = '') => `translate(${end.x - size / 2 + dx}px, ${end.y - size / 2 + dy}px) ${extra}`;
    const stuck = float(t.emoji, 56);
    const pop = float(t.hit, 60);
    if (quiet()) {
      for (const [el, size] of [[stuck, 56], [pop, 60]] as const) {
        el.animate([{ transform: at(size, 0, size === 60 ? -40 : 0), opacity: 1 }, { transform: at(size, 0, size === 60 ? -40 : 0), opacity: 1, offset: 0.85 }, { transform: at(size, 0, size === 60 ? -40 : 0), opacity: 0 }], { duration: STAY }).onfinish = () => el.remove();
      }
      return;
    }
    stuck.animate([
      { transform: at(56, 0, 0, 'scale(1.6) rotate(0deg)'), opacity: 1 }, // i18n-ok
      { transform: at(56, 0, 0, 'scale(0.9, 1.1) rotate(-8deg)'), offset: 0.08 },
      { transform: at(56, 0, 0, 'scale(1.1, 0.9) rotate(8deg)'), offset: 0.18 }, // i18n-ok
      { transform: at(56, 0, 0, 'scale(1) rotate(-6deg)'), offset: 0.3 },
      { transform: at(56, 0, 0, 'scale(1.05) rotate(6deg)'), offset: 0.45 }, // i18n-ok
      { transform: at(56, 0, 0, 'scale(1) rotate(-4deg)'), offset: 0.6 },
      { transform: at(56, 0, 4, 'scale(1) rotate(3deg)'), opacity: 1, offset: 0.85 }, // i18n-ok
      { transform: at(56, 0, 22, 'scale(0.8) rotate(0deg)'), opacity: 0 }, // i18n-ok
    ], { duration: STAY, easing: 'ease-in-out' }).onfinish = () => stuck.remove();
    pop.animate([
      { transform: at(60, 0, -10, 'scale(0.3)'), opacity: 0 },
      { transform: at(60, 0, -46, 'scale(1.4)'), opacity: 1, offset: 0.12 },
      { transform: at(60, 0, -50, 'scale(1)'), opacity: 1, offset: 0.25 },
      { transform: at(60, 0, -56, 'scale(1.12)'), opacity: 1, offset: 0.5 },
      { transform: at(60, 0, -60, 'scale(1)'), opacity: 1, offset: 0.8 },
      { transform: at(60, 0, -100, 'scale(0.9)'), opacity: 0 },
    ], { duration: STAY, easing: 'ease-out' }).onfinish = () => pop.remove();
    for (let k = 0; k < 6; k++) { // little ones burst out around the photo
      const bit = float(t.hit, 22);
      const a = (k / 6) * Math.PI * 2 + Math.random() * 0.5, r = 46 + Math.random() * 20;
      bit.animate([
        { transform: at(22, 0, 0, 'scale(0.4)'), opacity: 1 },
        { transform: at(22, Math.cos(a) * r, Math.sin(a) * r, 'scale(1)'), opacity: 1, offset: 0.5 },
        { transform: at(22, Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3 + 20, 'scale(0.7)'), opacity: 0 },
      ], { duration: 1200, delay: 60 * k, easing: 'ease-out' }).onfinish = () => bit.remove();
    }
    const panel = end.el.closest<HTMLElement>('[data-player]') ?? end.el;
    if (t.shake) panel.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-7px) rotate(-2deg)' }, { transform: 'translateX(7px) rotate(2deg)' }, { transform: 'translateX(-5px) rotate(-1deg)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }], { duration: 650 }); // i18n-ok
    playSound('chat');
    navigator.vibrate?.(t.shake ? [30, 40, 30] : 25);
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
