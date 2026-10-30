// The Ludo table, styled after Ludo King: players in the corners with their dice, the board in
// the middle, tokens hopping square by square. Server updates arrive as events (roll, move,
// capture…) which are played back in order before the next update is shown.
import { useEffect, useMemo, useRef, useState } from 'react';
import { homeAt } from '@sanga/game-rules/ludo.js';
import { playSound } from '../sounds';
import type { Game, GameEvent } from '../store';
import type { GameBoardProps } from '../registry';
import { MISSES_OUT } from '@sanga/game-rules/core.js';
import { makeLayout, pathOf } from './geometry';
import { LudoState, Shown } from './ludo-board/types';
import { Board } from './ludo-board/Board';
import { PlayerPanel } from './ludo-board/PlayerPanel';

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
