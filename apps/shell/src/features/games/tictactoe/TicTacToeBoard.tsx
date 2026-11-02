// Tic-Tac-Toe: X (player 1) and O (player 2) take turns; three in a row wins. The server checks every move.
import { cn } from '@sanga/ui/utils';
import { playSound } from '../sounds';
import type { Game } from '../store';
import type { GameBoardProps } from '../registry';
import { SeatCard } from '../common/SeatCard';
import { turnLine } from '../common/turnLine';
import { useEffect, useRef } from 'react';

interface State { cells: number[]; line: number[] | null; draw: boolean }
const COLOR = ['#fb7185', '#fbbf24'];

function Mark({ who, size = 56 }: { who: number; size?: number }) {
  return who === 0 ? (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-label="X" role="img" className="ttt-mark">
      <path d="M22 22 L78 78 M78 22 L22 78" stroke={COLOR[0]} strokeWidth="14" strokeLinecap="round" fill="none" pathLength={1} className="ttt-draw" />
    </svg>
  ) : (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-label="O" role="img" className="ttt-mark">
      <circle cx="50" cy="50" r="30" stroke={COLOR[1]} strokeWidth="14" fill="none" pathLength={1} className="ttt-draw" />
    </svg>
  );
}

export default function TicTacToeBoard({ g: game, me, act, bubble }: GameBoardProps) {
  const g = game as Game<State>;
  const s = g.s;
  const meIdx = g.players.findIndex((p) => p.u === me);
  const myTurn = g.status === 'play' && g.turn === meIdx;
  const placed = useRef(s.cells.filter((c) => c !== -1).length);
  useEffect(() => { // a click sound when a mark lands
    const n = s.cells.filter((c) => c !== -1).length;
    if (n > placed.current) playSound('step');
    placed.current = n;
    if (g.status === 'over' && s.line && s.line.every((c) => s.cells[c] === meIdx)) playSound('win');
  }, [s.cells, g.status, s.line, meIdx]);

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-between gap-3 px-3 py-3">
      <div className="flex w-full max-w-md gap-2">
        {g.players.map((p, i) => <SeatCard key={p.u} g={g} i={i} me={meIdx} color={COLOR[i]} mark={<span className="text-lg font-black" style={{ color: COLOR[i] }}>{i === 0 ? 'X' : 'O'}</span>}
          bubble={bubble(p.u)} align={i === 0 ? 'left' : 'right'} />)}
      </div>

      <div className="grid aspect-square w-full max-w-[min(92vw,420px)] grid-cols-3 gap-2.5 rounded-3xl bg-black/25 p-3 shadow-2xl" role="grid" aria-label="Tic-Tac-Toe board">
        {s.cells.map((who, c) => {
          const can = myTurn && who === -1;
          const win = s.line?.includes(c);
          return (
            <button key={c} type="button" disabled={!can} onClick={() => act({ a: 'place', c })} role="gridcell"
              aria-label={`Square ${c + 1}${who >= 0 ? (who === 0 ? ', X' : ', O') : ', empty'}`}
              className={cn('grid place-items-center rounded-2xl bg-white/12 transition', can && 'hover:bg-white/25 active:scale-95', win && 'ttt-win bg-white/35', s.line && !win && 'opacity-50')}>
              {who >= 0 && <Mark who={who} size={64} />}
              {who < 0 && can && <span className="text-3xl text-white/0 hover:text-white/25" aria-hidden>{g.turn === 0 ? '✕' : '○'}</span>}
            </button>
          );
        })}
      </div>

      <p className={cn('rounded-full px-4 py-1.5 text-center font-semibold text-white', myTurn ? 'bg-white/20 turn-bob' : 'bg-black/20')} role="status">{turnLine(g, meIdx, s.draw)}</p>
    </div>
  );
}
