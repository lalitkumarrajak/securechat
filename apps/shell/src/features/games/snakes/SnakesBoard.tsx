// Snakes & Ladders on the classic 100-square board. The server rolls and moves; this plays the events back.
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@sanga/ui/utils';
import { GOAL, LADDERS, SNAKES } from '@sanga/game-rules/snakes.js';
import { useApp } from '../../../state/app';
import type { Game } from '../store';
import type { GameBoardProps } from '../registry';
import { Dice } from '../ludo/ludo-board/Dice';
import { COLORS } from '../ludo/geometry';
import { SeatCard } from '../common/SeatCard';
import { turnLine } from '../common/turnLine';
import { center, ladderParts, snakePath } from './geometry';
import { useSnakesPlayback, type SnakesState } from './useSnakesPlayback';

const SNAKE_COLORS = ['#16a34a', '#dc2626', '#9333ea', '#ea580c', '#0891b2', '#be185d'];

export default function SnakesBoard({ g: game, me, act, bubble }: GameBoardProps) {
  const g = game as Game<SnakesState>;
  const meIdx = g.players.findIndex((p) => p.u === me);
  const { shown, busy } = useSnakesPlayback(g, meIdx);
  const online = useApp((s) => s.conn === 'online');
  const [asked, setAsked] = useState(0); // version when I tapped the dice: it spins until the result arrives
  const myTurn = !busy && g.status === 'play' && g.turn === meIdx;
  const canRoll = myTurn && asked !== g.v;
  const roll = () => { if (act({ a: 'roll' }) !== false) setAsked(g.v); };
  useEffect(() => { if (!asked) return; const t = setTimeout(() => setAsked(0), 3000); return () => clearTimeout(t); }, [asked]);
  useEffect(() => { if (!online) setAsked(0); }, [online]);

  const spinning = asked === g.v;
  const dice = spinning ? { s: meIdx, d: 6, rolling: true } : shown.dice;
  const cells = useMemo(() => Array.from({ length: 100 }, (_, k) => k + 1), []);
  const snakes = useMemo(() => Object.entries(SNAKES).map(([h, t], i) => ({ ...snakePath(+h, t), color: SNAKE_COLORS[i % SNAKE_COLORS.length] })), []);
  const ladders = useMemo(() => Object.entries(LADDERS).map(([f, t]) => ladderParts(+f, t)), []);
  const waiting = shown.pos.map((p, i) => ({ p, i })).filter((x) => x.p <= 0 && g.players[x.i].state !== 'left' && g.players[x.i].state !== 'out');

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-between gap-2 px-2 py-2">
      <div className="grid w-full max-w-xl grid-cols-2 gap-1.5">
        {g.players.map((p, i) => <SeatCard key={p.u} g={g} i={i} me={meIdx} color={COLORS[i]} bubble={bubble(p.u)} align={i % 2 ? 'right' : 'left'}
          mark={<span className="size-3.5 rounded-full border-2 border-white" style={{ background: COLORS[i] }} aria-hidden />}
          status={p.rank ? undefined : shown.pos[i] > 0 ? `Square ${shown.pos[i]}` : 'Not started'} />)}
      </div>

      <div className="flex min-h-0 w-full flex-1 items-center justify-center">
        <svg viewBox="-1 -1 102 112" className="max-h-full w-full max-w-[520px] select-none" role="img" aria-label="Snakes and Ladders board">
          <rect x="-1" y="-1" width="102" height="102" rx="2.5" fill="#fdf6e3" stroke="#b7791f" strokeWidth="1.2" />
          {cells.map((n) => {
            const { x, y } = center(n);
            const alt = (Math.round((x - 5) / 10) + Math.round((95 - y) / 10)) % 2 === 0; // a checkerboard, by column and row
            return (
              <g key={n}>
                <rect x={x - 5} y={y - 5} width="10" height="10" fill={n === GOAL ? '#fde68a' : alt ? '#fff7d6' : '#f2dfa7'} />
                <text x={x - 4.2} y={y - 2.6} fontSize="2.8" fill="#8a6d1f" fontWeight="600">{n}</text>
              </g>
            );
          })}

          {ladders.map((l, i) => (
            <g key={'l' + i} stroke="#8b5a2b" strokeLinecap="round" opacity="0.92">
              {l.rails.map(([a, b], k) => <line key={k} x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth="1.1" />)}
              {l.rungs.map(([a, b], k) => <line key={k} x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth="0.8" />)}
            </g>
          ))}
          {snakes.map((s, i) => (
            <g key={'s' + i} opacity="0.93">
              <path d={s.d} fill="none" stroke="#000" strokeOpacity="0.2" strokeWidth="3.4" strokeLinecap="round" transform="translate(0.4 0.5)" />
              <path d={s.d} fill="none" stroke={s.color} strokeWidth="2.6" strokeLinecap="round" />
              <path d={s.d} fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="0.7" strokeDasharray="1 2.2" strokeLinecap="round" />
              <circle cx={s.a.x} cy={s.a.y} r="2.4" fill={s.color} />
              <circle cx={s.a.x - 0.9} cy={s.a.y - 0.7} r="0.6" fill="#fff" /><circle cx={s.a.x + 0.9} cy={s.a.y - 0.7} r="0.6" fill="#fff" />
              <circle cx={s.a.x - 0.9} cy={s.a.y - 0.7} r="0.28" fill="#000" /><circle cx={s.a.x + 0.9} cy={s.a.y - 0.7} r="0.28" fill="#000" />
            </g>
          ))}

          <rect x="0" y="101" width="100" height="9" rx="2" fill="#000" fillOpacity="0.12" />
          <text x="97" y="106.4" fontSize="2.8" textAnchor="end" fill="#fff" fillOpacity="0.7">start</text>
          {shown.pos.map((p, i) => {
            if (p < 0) return null;
            const slot = waiting.findIndex((w) => w.i === i);
            const at = center(p, Math.max(slot, 0));
            // Tokens on one square sit side by side, so none hides another.
            const mates = shown.pos.map((q, j) => ({ q, j })).filter((o) => o.q === p && o.q > 0);
            const k = mates.findIndex((o) => o.j === i);
            const off = mates.length > 1 ? (k - (mates.length - 1) / 2) * 3.4 : 0;
            return (
              <g key={i} data-token={i} style={{ transform: `translate(${at.x + off}px, ${at.y}px)`, transition: shown.jumping ? 'transform 0.7s ease-in-out' : 'transform 0.17s linear' }}>
                <circle r="3.1" fill="#000" fillOpacity="0.25" cy="0.7" />
                <circle r="3" fill={COLORS[i]} stroke="#fff" strokeWidth="0.8" className={cn(shown.turn === i && g.status === 'play' && 'snakes-active')} />
                <circle r="1.1" cx="-0.9" cy="-1" fill="#fff" fillOpacity="0.55" />
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex w-full max-w-md items-center justify-center gap-4">
        <button type="button" disabled={!canRoll} onClick={roll} aria-label={canRoll ? 'Roll dice' : dice ? `Rolled ${dice.d}` : 'Dice'}
          className={cn('grid size-20 place-items-center rounded-3xl bg-white/15 shadow-lg transition', canRoll && 'hover:bg-white/25 active:scale-95')}>
          <span className={cn('block scale-[1.6]', canRoll && 'ludo-roll-hint')}><Dice value={dice?.d || 6} rolling={!!dice?.rolling} dim={!dice && !canRoll} /></span>
        </button>
        <p className={cn('rounded-full px-4 py-1.5 font-semibold text-white', canRoll ? 'bg-white/20 turn-bob' : 'bg-black/20')} role="status">{turnLine(g, meIdx, false)}</p>
      </div>
    </div>
  );
}
