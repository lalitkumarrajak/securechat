import { cn } from '@sanga/ui/utils';
import type { Game } from '../../store';
import { COLORS, DARK, LIGHT, poly, type Layout, type Pt } from '../geometry';
import { LudoState, Shown } from './types';
import { Token } from './Token';
import { Arrow } from './Arrow';
import { Star } from './Star';
import { Crown } from './Crown';

export function Board({ L, g, shown, home, movable, meIdx, onMove }: {
  L: Layout; g: Game<LudoState>; shown: Shown; home: number; movable: number[]; meIdx: number; onMove: (t: number) => void;
}) {
  const pad = 0.35;
  const vb = `${L.box.x - pad} ${L.box.y - pad} ${L.box.w + pad * 2} ${L.box.h + pad * 2}`;
  const used = new Set(g.s.arm);
  const colorOfArm = (a: number) => (used.has(a) ? COLORS[a] : '#cfd6e4');
  const fillOf = (a: number) => (used.has(a) ? `url(#fill-${a})` : 'url(#fill-off)');

  // Tokens grouped by spot, so several on one square sit side by side, smaller.
  const tokens: { i: number; t: number; at: Pt; key: string }[] = [];
  shown.tokens.forEach((row, i) => row.forEach((p, t) => {
    const at = L.at(g.s.arm[i], p, t);
    if (at) tokens.push({ i, t, at, key: p < 0 ? `y${i}/${t}` : p >= home ? `h${i}` : `${at.x.toFixed(2)},${at.y.toFixed(2)}` });
  }));
  const groups = new Map<string, number>();
  const placed = tokens.map((tk) => {
    const n = tokens.filter((o) => o.key === tk.key).length;
    const k = groups.get(tk.key) || 0;
    groups.set(tk.key, k + 1);
    if (n === 1) return { ...tk, x: tk.at.x, y: tk.at.y, scale: 1 };
    const spread = n === 2 ? [-0.2, 0.2] : [-0.27, -0.09, 0.09, 0.27, -0.18, 0.18, 0, 0.27].slice(0, n);
    return { ...tk, x: tk.at.x + spread[k % spread.length], y: tk.at.y + (n > 2 && k >= n / 2 ? 0.12 : -0.05), scale: n === 2 ? 0.8 : 0.66 };
  });
  // Current player's tokens drawn last, so they're on top and easy to tap.
  placed.sort((a, b) => Number(a.i === shown.turn) - Number(b.i === shown.turn));

  return (
    <svg viewBox={vb} className="ludo-board aspect-square max-h-full w-full max-w-[560px] select-none" style={{ aspectRatio: `${L.box.w + pad * 2} / ${L.box.h + pad * 2}` }}
      role="img" aria-label="Ludo board">
      <defs>
        <filter id="tok-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0.06" stdDeviation="0.05" floodOpacity="0.45" />
        </filter>
        <radialGradient id="tok-shine" cx="35%" cy="30%" r="70%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.75" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        {/* glossy colour fills: light top-left to deep bottom-right */}
        {COLORS.map((c, a) => (
          <linearGradient key={a} id={`fill-${a}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={LIGHT[a]} />
            <stop offset="0.55" stopColor={c} />
            <stop offset="1" stopColor={DARK[a]} />
          </linearGradient>
        ))}
        <linearGradient id="fill-off" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e4e9f2" /><stop offset="1" stopColor="#b9c2d3" /></linearGradient>
        <linearGradient id="frame" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f3d79a" /><stop offset="0.35" stopColor="#c48a3f" /><stop offset="0.7" stopColor="#8a5a22" /><stop offset="1" stopColor="#e3b968" />
        </linearGradient>
        <linearGradient id="cell" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#eef1f6" /></linearGradient>
        <filter id="board-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="0.25" stdDeviation="0.35" floodColor="#000" floodOpacity="0.55" />
        </filter>
        <filter id="inset" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0.05" stdDeviation="0.06" floodOpacity="0.35" />
        </filter>
      </defs>

      {/* board base */}
      {L.n === 4 ? (
        <rect x={L.box.x - 0.15} y={L.box.y - 0.15} width={L.box.w + 0.3} height={L.box.h + 0.3} rx="0.35" fill="#fdfcf8" stroke="url(#frame)" strokeWidth="0.3" filter="url(#board-shadow)" />
      ) : (
        <circle r={Math.max(L.box.w, L.box.h) / 2 + 0.1} fill="#fdfcf8" stroke="url(#frame)" strokeWidth="0.3" filter="url(#board-shadow)" />
      )}

      {/* yards */}
      {Array.from({ length: L.n }, (_, a) => {
        const y = L.yard(a);
        const h = y.size / 2;
        const c = fillOf(a);
        return (
          <g key={'y' + a}>
            {y.round ? <circle cx={y.c.x} cy={y.c.y} r={h} fill={c} stroke={used.has(a) ? DARK[a] : '#9aa5b8'} strokeWidth="0.06" />
              : <rect x={y.c.x - h} y={y.c.y - h} width={y.size} height={y.size} rx="0.2" fill={c} />}
            {y.round ? <circle cx={y.c.x} cy={y.c.y} r={h * 0.72} fill="#fff" filter="url(#inset)" />
              : <rect x={y.c.x - h * 0.66} y={y.c.y - h * 0.66} width={h * 1.32} height={h * 1.32} rx="0.45" fill="#fff" filter="url(#inset)" />}
            {y.spots.map((s, k) => (
              <g key={k} opacity={used.has(a) ? 1 : 0.5}>
                <circle cx={s.x} cy={s.y} r="0.42" fill={c} />
                <circle cx={s.x} cy={s.y} r="0.42" fill="none" stroke="#000" strokeOpacity="0.15" strokeWidth="0.05" />
              </g>
            ))}
          </g>
        );
      })}

      {/* track */}
      {L.track.map((c, sq) => <polygon key={'t' + sq} points={poly(c.poly)} fill="url(#cell)" stroke="#9aa3b2" strokeWidth="0.035" />)}
      {Array.from({ length: L.n }, (_, a) => (
        <g key={'a' + a}>
          {L.homeCol(a).map((c, k) => <polygon key={k} points={poly(c.poly)} fill={fillOf(a)} stroke="#9aa3b2" strokeWidth="0.035" />)}
          <polygon points={poly(L.startCell(a).poly)} fill={fillOf(a)} stroke="#9aa3b2" strokeWidth="0.035" />
          <Arrow at={L.startCell(a)} ang={L.armAng(a) + Math.PI} color="#fff" />
          <Arrow at={L.entryCell(a)} ang={L.armAng(a) + Math.PI} color={colorOfArm(a)} />
          <Star at={L.starCell(a)} />
        </g>
      ))}

      {/* centre */}
      {Array.from({ length: L.n }, (_, a) => <polygon key={'c' + a} points={poly(L.homeTri(a))} fill={fillOf(a)} stroke="#fff" strokeWidth="0.05" />)}
      <Crown />

      {/* tokens */}
      {placed.map((tk) => {
        const can = tk.i === meIdx && movable.includes(tk.t);
        return (
          <g key={`${tk.i}/${tk.t}`} className="ludo-token" style={{ transform: `translate(${tk.x}px, ${tk.y}px)` }}
            data-token={`${tk.i}/${tk.t}`} data-p={shown.tokens[tk.i][tk.t]}>
            <g style={{ transform: `scale(${tk.scale})` }} className={cn(can && 'cursor-pointer')}
              {...(can ? { role: 'button', 'aria-label': `Move token ${tk.t + 1}`, tabIndex: 0, onClick: () => onMove(tk.t),
                onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') onMove(tk.t); } } : {})}>
              {can && <circle r="0.7" fill="transparent" />}{/* still tap target; the token inside bounces */}
              {can && <circle r="0.62" fill="none" stroke="#fff" strokeWidth="0.08" className="ludo-ring" />}
              <g className={cn(can && 'ludo-token-can')}><Token color={COLORS[g.s.arm[tk.i]]} dark={DARK[g.s.arm[tk.i]]} /></g>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
