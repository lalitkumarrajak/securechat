import { useState } from 'react';

const CONFETTI = ['#f5c518', '#e8322f', '#2fa24a', '#1f7fe0', '#9b3fd1', '#f5821f', '#ffffff'];

export function Confetti() {
  // Fixed per mount, so it doesn't reshuffle on re-render.
  const [pieces] = useState(() => Array.from({ length: 60 }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 0.8, dur: 2.2 + Math.random() * 1.8,
    color: CONFETTI[i % CONFETTI.length], tilt: Math.random() * 360,
  })));
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {pieces.map((p, i) => (
        <span key={i} className="confetti" style={{ left: `${p.left}%`, background: p.color, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, rotate: `${p.tilt}deg` }} />
      ))}
    </div>
  );
}
