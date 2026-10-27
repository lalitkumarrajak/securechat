// The Ludo table, styled after Ludo King: players in the corners with their dice, the board in
// the middle, tokens hopping square by square. Server updates arrive as events (roll, move,
// capture…) which are played back in order before the next update is shown.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar } from '../../../components/Avatar';
import { cn } from '../../../lib/utils';
import { homeAt } from '@sanga/game-rules/ludo.js';
import { playSound } from '../sounds';
import type { Game, GameEvent } from '../store';
import type { GameBoardProps } from '../registry';
import { MISSES_OUT } from '@sanga/game-rules/core.js';
import { Chances, TurnRing } from '../TurnRing';
import { COLORS, COLOR_NAMES, DARK, LIGHT, makeLayout, pathOf, poly, type Layout, type Pt } from './geometry';

interface LudoState { arms: number; arm: number[]; tokens: number[][]; phase: 'roll' | 'move'; dice: number; sixes: number; moves: number[] }
interface Shown { tokens: number[][]; turn: number; dice: { s: number; d: number; rolling: boolean } | null }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Ludo King's rhythm: the dice rattles for about a second, the result stays a moment, tokens hop
// a square at a time, and a captured token visibly zips back to its yard.
const PACE = { roll: 950, reveal: 450, step: 260, hit: 320, rewind: 38, settle: 300, burn: 900, turn: 350 };

// Plays each update's events (dice, hops, captures) before showing the next update.
function usePlayback(g: Game<LudoState>, me: number) {
  const [shown, setShown] = useState<Shown>(() => ({ tokens: g.s.tokens, turn: g.turn, dice: null }));
  const [busy, setBusy] = useState(false);
  const queue = useRef<Game<LudoState>[]>([]);
  const lastV = useRef(g.v);
  const running = useRef(false);
  const meRef = useRef(me);
  meRef.current = me;

  useEffect(() => {
    if (g.v <= lastV.current) return;
    lastV.current = g.v;
    queue.current.push(g);
    if (running.current) return;
    running.current = true;
    setBusy(true);
    (async () => {
      while (queue.current.length) {
        if (queue.current.length > 3) queue.current.splice(0, queue.current.length - 1); // fell behind: skip ahead
        const f = queue.current.shift()!;
        await playEvents(f.ev, homeAt(f.s.arms), setShown, meRef.current);
        setShown((s) => ({ tokens: f.s.tokens, turn: f.turn, dice: s.dice && s.dice.s === f.turn ? s.dice : null }));
      }
      running.current = false;
      setBusy(false);
    })();
  }, [g]);

  return { shown, busy };
}

async function playEvents(ev: GameEvent[], home: number, setShown: (fn: (s: Shown) => Shown) => void, me: number) {
  const setTok = (s: number, t: number, p: number) =>
    setShown((x) => ({ ...x, tokens: x.tokens.map((row, i) => (i === s ? row.map((q, j) => (j === t ? p : q)) : row)) }));
  for (const e of ev) {
    switch (e.k) {
      case 'roll':
        setShown((x) => ({ ...x, turn: e.s!, dice: { s: e.s!, d: e.d, rolling: true } }));
        playSound('roll');
        await sleep(PACE.roll);
        setShown((x) => ({ ...x, dice: { s: e.s!, d: e.d, rolling: false } }));
        await sleep(PACE.reveal);
        break;
      case 'move': {
        for (const p of pathOf(e.from, e.to)) { setTok(e.s!, e.t, p); playSound('step'); await sleep(PACE.step); }
        if (e.cap?.length) {
          playSound('capture');
          navigator.vibrate?.(60);
          await sleep(PACE.hit);
          playSound('zip');
          // Captured tokens rewind along the track to their yard, like Ludo King.
          const caps = e.cap as { s: number; t: number; from: number }[];
          const longest = Math.max(...caps.map((c) => c.from));
          for (let back = 1; back <= longest + 1; back++) {
            for (const c of caps) if (c.from - back >= -1) setTok(c.s, c.t, c.from - back);
            await sleep(PACE.rewind);
          }
        }
        if (e.to === home) playSound('home');
        await sleep(PACE.settle);
        break;
      }
      case 'burn': await sleep(PACE.burn); break;
      case 'turn':
        await sleep(PACE.turn);
        setShown((x) => ({ ...x, turn: e.s!, dice: null }));
        if (e.s === me) { playSound('turn'); navigator.vibrate?.(30); }
        break;
      case 'done': if (e.s === me) playSound('win'); break;
      case 'out': case 'left': playSound('out'); break;
    }
  }
}

export default function LudoBoard({ g: game, me, act, bubble }: GameBoardProps) {
  const g = game as Game<LudoState>;
  const meIdx = g.players.findIndex((p) => p.u === me);
  const myArm = g.s.arm[Math.max(0, meIdx)];
  const L = useMemo(() => makeLayout(g.s.arms, myArm), [g.s.arms, myArm]);
  const { shown, busy } = usePlayback(g, meIdx);
  const [asked, setAsked] = useState(0); // version when I tapped the dice: it spins until the result arrives
  const roll = () => { setAsked(g.v); act({ a: 'roll' }); };
  useEffect(() => { // no reply (e.g. connection dropped): stop spinning
    if (!asked) return;
    const t = setTimeout(() => setAsked(0), 5000);
    return () => clearTimeout(t);
  }, [asked]);
  const home = homeAt(g.s.arms);
  const myTurn = !busy && g.status === 'play' && g.turn === meIdx;
  const canRoll = myTurn && g.s.phase === 'roll' && asked !== g.v;
  const movable = myTurn && g.s.phase === 'move' ? g.s.moves : [];

  // Players around the board: those whose yard is in the top half go above it, sorted left to right.
  const seats = g.players.map((pl, i) => {
    const ang = L.yardAng(g.s.arm[i]);
    return { pl, i, top: Math.sin(ang) < 0, x: Math.cos(ang) };
  });
  const row = (top: boolean) => seats.filter((s) => s.top === top).sort((a, b) => a.x - b.x);

  const panel = (s: (typeof seats)[number]) => (
    <PlayerPanel key={s.pl.u} g={g} i={s.i} me={meIdx} shown={shown} canRoll={canRoll && s.i === meIdx}
      onRoll={roll} spinning={asked === g.v && s.i === meIdx} bubble={bubble(s.pl.u)} right={s.x > 0} below={!s.top} />
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col items-center justify-between gap-1 px-2 py-2">
      {meIdx >= 0 && g.players[meIdx].state === 'playing' && (g.players[meIdx].missed || 0) > 0 && (
        <div className="pointer-events-none absolute top-1/2 left-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-black/75 px-4 py-2 text-center text-sm font-medium text-white shadow-xl"
          role="status">
          You missed {g.players[meIdx].missed} turn{g.players[meIdx].missed === 1 ? '' : 's'} ·{' '}
          <span className="text-amber-300">{MISSES_OUT - (g.players[meIdx].missed || 0)} chance{MISSES_OUT - (g.players[meIdx].missed || 0) === 1 ? '' : 's'} left</span>
          <div className="text-xs text-white/70">Roll the dice to stay in the game</div>
        </div>
      )}
      <div className="flex w-full max-w-[560px] items-start justify-between gap-1">{row(true).map(panel)}</div>
      <div className="flex min-h-0 w-full flex-1 items-center justify-center">
        <Board L={L} g={g} shown={shown} home={home} movable={movable} meIdx={meIdx}
          onMove={(t) => act({ a: 'move', t })} />
      </div>
      <div className="flex w-full max-w-[560px] items-end justify-between gap-1">{row(false).map(panel)}</div>
    </div>
  );
}

function Board({ L, g, shown, home, movable, meIdx, onMove }: {
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

function Token({ color, dark }: { color: string; dark: string }) {
  return (
    <g filter="url(#tok-shadow)" transform="translate(0 -0.12)">
      <ellipse cx="0" cy="0.4" rx="0.26" ry="0.08" fill="#000" opacity="0.25" />
      <path d="M0 0.4 C-0.1 0.2 -0.34 0.06 -0.34 -0.16 A0.34 0.34 0 1 1 0.34 -0.16 C0.34 0.06 0.1 0.2 0 0.4 Z" fill={color} stroke="#fff" strokeWidth="0.07" />
      <circle cx="0" cy="-0.16" r="0.15" fill="#fff" />
      <circle cx="0" cy="-0.16" r="0.09" fill={dark} />
      <path d="M0 0.4 C-0.1 0.2 -0.34 0.06 -0.34 -0.16 A0.34 0.34 0 1 1 0.34 -0.16 C0.34 0.06 0.1 0.2 0 0.4 Z" fill="url(#tok-shine)" />
    </g>
  );
}

function Arrow({ at, ang, color }: { at: Pt; ang: number; color: string }) {
  const deg = (ang * 180) / Math.PI;
  return <path d="M-0.28 -0.18 L0.12 -0.18 L0.12 -0.3 L0.34 0 L0.12 0.3 L0.12 0.18 L-0.28 0.18 Z" fill={color} opacity="0.95"
    transform={`translate(${at.x} ${at.y}) rotate(${deg}) scale(0.85)`} />;
}

function Star({ at }: { at: Pt }) {
  const pts = Array.from({ length: 10 }, (_, k) => {
    const r = k % 2 ? 0.16 : 0.36, a = -Math.PI / 2 + (k * Math.PI) / 5;
    return { x: at.x + Math.cos(a) * r, y: at.y + Math.sin(a) * r };
  });
  return <polygon points={poly(pts)} fill="#d7dce5" stroke="#8f99a8" strokeWidth="0.05" strokeLinejoin="round" />;
}

// A small gold crown in the middle of the board, where tokens finish.
function Crown() {
  return (
    <g transform="translate(0 0.05) scale(0.55)" opacity="0.95">
      <circle r="0.95" fill="#fff" fillOpacity="0.92" stroke="#e1b448" strokeWidth="0.1" />
      <path d="M-0.55 0.3 L-0.62 -0.32 L-0.28 -0.05 L0 -0.45 L0.28 -0.05 L0.62 -0.32 L0.55 0.3 Z" fill="#f2b81b" stroke="#b9820a" strokeWidth="0.06" strokeLinejoin="round" />
    </g>
  );
}

function PlayerPanel({ g, i, me, shown, canRoll, onRoll, spinning, bubble, right, below }: {
  g: Game<LudoState>; i: number; me: number; shown: Shown; canRoll: boolean; onRoll: () => void; spinning: boolean;
  bubble: string | null; right: boolean; below: boolean;
}) {
  const pl = g.players[i];
  const arm = g.s.arm[i];
  const color = COLORS[arm];
  const active = g.status === 'play' && shown.turn === i && pl.state === 'playing';
  const gone = pl.state === 'left' || pl.state === 'out';
  const dice = spinning ? { s: i, d: 6, rolling: true } : shown.dice?.s === i ? shown.dice : null;
  const homeCount = g.s.tokens[i].filter((p) => p === homeAt(g.s.arms)).length;
  const missed = pl.missed || 0;
  const away = pl.state === 'playing' && missed > 0; // the server has been playing for them

  const avatar = (
    <div className="relative">
      <TurnRing active={active} deadline={g.deadline} color={color}>
        <div className={cn('rounded-xl border-[3px] bg-white p-0.5', gone && 'opacity-40 grayscale')} style={{ borderColor: color }}>
          <Avatar u={pl.u} name={pl.n} size={40} className="[&>*]:rounded-lg" />
        </div>
      </TurnRing>
      {pl.rank ? <span className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-amber-400 text-xs font-bold text-amber-950 shadow">{pl.rank}</span> : null}
      {bubble && (
        <div className={cn('ludo-bubble absolute z-20 max-w-[160px] rounded-2xl bg-white px-3 py-1.5 text-sm font-medium text-slate-900 shadow-lg',
          below ? 'bottom-full mb-2' : 'top-full mt-2', right ? 'right-0' : 'left-0',
          /^\p{Extended_Pictographic}+$/u.test(bubble.replace(/\s/g, '')) && 'text-3xl px-2 py-0.5')}>
          {bubble}
        </div>
      )}
    </div>
  );

  const diceBox = (
    <div className={cn('relative grid size-12 place-items-center rounded-xl', active ? 'bg-white/15 shadow-[0_0_18px_rgba(255,255,255,0.25)]' : 'bg-transparent')}>
      {active && (canRoll || dice) ? (
        <button type="button" disabled={!canRoll} onClick={onRoll} aria-label={canRoll ? 'Roll dice' : `Rolled ${dice?.d ?? ''}`}
          className="rounded-lg">
          <span className={cn('block', canRoll && 'ludo-roll-hint')}><Dice value={dice?.d || 6} rolling={!!dice?.rolling} /></span>
          {canRoll && (
            <span className={cn('ludo-your-turn pointer-events-none absolute z-10 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-bold whitespace-nowrap text-amber-950 shadow-lg',
              below ? 'bottom-full mb-1' : 'top-full mt-1')}>Your turn!</span>
          )}
        </button>
      ) : active ? <Dice value={6} rolling={false} dim /> : null}
    </div>
  );

  return (
    <div className={cn('flex min-w-0 flex-col gap-1 rounded-2xl border-2 bg-black/25 p-1.5 shadow-lg backdrop-blur-sm transition-colors',
      right ? 'items-end' : 'items-start', active ? '' : 'border-transparent')} style={active ? { borderColor: color } : undefined} data-player={pl.u}>
      <div className={cn('flex items-center gap-1.5', right && 'flex-row-reverse')}>
        {avatar}
        {diceBox}
      </div>
      <div className={cn('min-w-0 px-0.5 text-[11px] leading-tight text-white/90', right && 'text-right')}>
        <div className="max-w-[100px] truncate font-semibold">{i === me ? 'You' : pl.n || pl.u}</div>
        <div className={cn(away ? 'font-medium text-amber-300' : 'text-white/60')}>
          {away ? 'Auto-playing' : gone ? (pl.state === 'out' ? 'Removed' : 'Left') : pl.rank ? ordinal(pl.rank) : `${COLOR_NAMES[arm]}${homeCount ? ` · ${homeCount}/4 home` : ''}`}
        </div>
        {pl.state === 'playing' && !pl.bot && <Chances missed={missed} right={right} />}
      </div>
    </div>
  );
}

const ordinal = (n: number) => n + (['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]) + ' place';

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[26, 26], [50, 50], [74, 74]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]],
  6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
};

function Dice({ value, rolling, dim }: { value: number; rolling: boolean; dim?: boolean }) {
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
