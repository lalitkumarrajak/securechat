import { useEffect, useState } from 'react';
import { cn } from '@sanga/ui/utils';

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[26, 26], [50, 50], [74, 74]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]],
  6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
};

export function Dice({ value, rolling, dim }: { value: number; rolling: boolean; dim?: boolean }) {
  const [face, setFace] = useState(value);
  useEffect(() => {
    if (!rolling) { setFace(value); return; }
    const t = setInterval(() => setFace(1 + Math.floor(Math.random() * 6)), 70);
    return () => clearInterval(t);
  }, [rolling, value]);
  return (
    <svg viewBox="0 0 100 100" className={cn('size-10 drop-shadow-md', rolling && 'ludo-dice-roll', dim && 'opacity-40')} aria-hidden data-face={rolling ? undefined : face}>
      <defs>
        <linearGradient id="dice-face" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#dfe3ea" /></linearGradient>
      </defs>
      <rect x="4" y="7" width="92" height="92" rx="22" fill="#9aa3b2" />
      <rect x="4" y="2" width="92" height="92" rx="22" fill="url(#dice-face)" stroke="#c9ced8" strokeWidth="2" />
      {PIPS[face].map(([x, y], k) => <circle key={k} cx={x} cy={y} r={face === 1 ? 12 : 9} fill={face === 1 ? '#e8322f' : '#1d2433'} />)}
    </svg>
  );
}
