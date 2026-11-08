// Connect Four: drop discs into a 7 × 6 grid; four in a row wins. The server checks every move.
import { useEffect, useRef, useState } from 'react';
import { cn } from '@sanga/ui/utils';
import { t } from '@sanga/i18n';
import { COLS, ROWS, advice, landing } from '@sanga/game-rules/connect4.js';
import { Lightbulb } from 'lucide-react';
import { playSound } from '../sounds';
import type { Game } from '../store';
import type { GameBoardProps } from '../registry';
import { SeatCard } from '../common/SeatCard';
import { turnLine } from '../common/turnLine';

interface State { cells: number[]; line: number[] | null; draw: boolean }
const COLOR = ['#ef4444', '#facc15'];
const TIPS = 'sanga-c4-tips';

export default function ConnectFourBoard({ g: game, me, act, bubble }: GameBoardProps) {
  const g = game as Game<State>;
  const s = g.s;
  const meIdx = g.players.findIndex((p) => p.u === me);
  const myTurn = g.status === 'play' && g.turn === meIdx;
  const [hover, setHover] = useState<number | null>(null);
  const last = [...g.ev].reverse().find((e) => e.k === 'drop');
  const count = s.cells.filter((c) => c !== -1).length;
  const before = useRef(count);
  useEffect(() => {
    if (count > before.current) playSound('step');
    before.current = count;
    if (g.status === 'over' && s.line && s.cells[s.line[0]] === meIdx) playSound('win');
  }, [count, g.status, s.line, s.cells, meIdx]);

  const open = (c: number) => myTurn && landing(s.cells, c) >= 0;
  // Tips for a new player: where to win, where to block, which columns hand the other player a win.
  const [tips, setTipsState] = useState(() => { try { return localStorage.getItem(TIPS) !== 'off'; } catch { return true; } });
  const setTips = (on: boolean) => { setTipsState(on); try { localStorage.setItem(TIPS, on ? 'on' : 'off'); } catch { /* this visit only */ } };
  const tip = myTurn && tips && meIdx >= 0 ? advice(s.cells, meIdx) as { why: 'win' | 'block' | 'middle'; c: number; traps: number[] } | null : null;
  const them = meIdx === 0 ? t('Yellow') : t('Red');
  const tipText = !tip ? '' : tip.why === 'win' ? t('You can win! Drop in column {n}.', { n: tip.c + 1 })
    : tip.why === 'block' ? t('Careful: {them} wins next in column {n}. Drop there to block it.', { them, n: tip.c + 1 })
    : count < 2 ? t('Start in the middle (column {n}): it’s part of the most lines.', { n: tip.c + 1 })
    : t('Try column {n}: build towards four, near the middle.', { n: tip.c + 1 });
  const trapText = tip?.traps.length ? t('Avoid column {list}: {them} could drop on top of yours and win.', { list: tip.traps.map((c) => c + 1).join(', '), them }) : '';
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-between gap-3 px-3 py-3">
      <div className="flex w-full max-w-md gap-2">
        {g.players.map((p, i) => <SeatCard key={p.u} g={g} i={i} me={meIdx} color={COLOR[i]} mark={<span className="size-4 rounded-full" style={{ background: COLOR[i] }} aria-label={i === 0 ? t('red') : t('yellow')} />}
          bubble={bubble(p.u)} align={i === 0 ? 'left' : 'right'} />)}
      </div>

      <div className="w-full max-w-[min(94vw,440px)]">
        {/* column buttons: a preview disc hovers over the column you'd drop in */}
        <div className="grid grid-cols-7 gap-1 px-2 pb-1" role="group" aria-label={t('Drop a disc')}>
          {Array.from({ length: COLS }, (_, c) => (
            <button key={c} type="button" disabled={!open(c)} onClick={() => act({ a: 'drop', c })} aria-label={t('Drop in column {n}', { n: c + 1 })}
              onMouseEnter={() => setHover(c)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(c)} onBlur={() => setHover(null)}
              className="grid h-9 place-items-center rounded-lg transition hover:bg-white/10 disabled:pointer-events-none">
              {tip?.traps.includes(c) && hover !== c ? <span className="text-sm font-bold text-amber-300" aria-hidden>✕</span>
                : <span className={cn('size-6 rounded-full transition', open(c) && hover === c ? 'opacity-80' : tip?.c === c ? 'animate-pulse opacity-70 ring-2 ring-white' : 'opacity-0')} style={{ background: COLOR[meIdx] ?? '#fff' }} />}
            </button>
          ))}
        </div>
        <div className="relative rounded-2xl bg-blue-600 p-2 shadow-2xl ring-4 ring-blue-800" role="grid" aria-label={t('Connect Four board')}>
          <div className="grid grid-cols-7 gap-1.5">
            {s.cells.map((who, k) => {
              const r = Math.floor(k / COLS);
              const win = s.line?.includes(k);
              const fresh = last && last.r * COLS + last.c === k;
              return (
                <div key={k} className="relative aspect-square rounded-full bg-blue-900/80 shadow-inner" role="gridcell"
                  aria-label={who === 0 ? t('Row {r}, column {c}, red', { r: r + 1, c: (k % COLS) + 1 }) : who === 1 ? t('Row {r}, column {c}, yellow', { r: r + 1, c: (k % COLS) + 1 }) : t('Row {r}, column {c}', { r: r + 1, c: (k % COLS) + 1 })}>
                  {who >= 0 && (
                    <span className={cn('c4-disc absolute inset-[7%] rounded-full', win && 'c4-win')}
                      style={{ background: `radial-gradient(circle at 35% 30%, #fff8, transparent 45%), ${COLOR[who]}`, ...(fresh ? { ['--fall' as string]: r + 1, animation: 'c4-drop 0.45s cubic-bezier(.5,0,.9,.6) both' } : {}) }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex w-full max-w-md flex-col items-center gap-2">
        {tip && (
          <div className="w-full rounded-2xl bg-black/30 px-3 py-2 text-sm text-white" role="note" aria-label={t('Tip')}>
            <p className="flex gap-2"><Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-300" />{tipText}</p>
            {trapText && <p className="mt-1 pl-6 text-white/80">{trapText}</p>}
          </div>
        )}
        <div className="flex items-center gap-2">
          <p className={cn('rounded-full px-4 py-1.5 text-center font-semibold text-white', myTurn ? 'bg-white/20 turn-bob' : 'bg-black/20')} role="status">{turnLine(g, meIdx, s.draw)}</p>
          {meIdx >= 0 && g.status === 'play' && (
            <button type="button" role="switch" aria-checked={tips} onClick={() => setTips(!tips)}
              className={cn('flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold', tips ? 'bg-amber-300 text-amber-950' : 'bg-white/15 text-white/80')}>
              <Lightbulb className="size-3.5" />{t('Tips')}
            </button>
          )}
        </div>
      </div>
      <span className="sr-only">{t('{rows} rows by {cols} columns', { rows: ROWS, cols: COLS })}</span>
    </div>
  );
}
