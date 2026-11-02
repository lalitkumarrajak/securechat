import { useEffect, useRef, useState } from 'react';
import { GOAL } from '@sanga/game-rules/snakes.js';
import { playSound } from '../sounds';
import type { Game, GameEvent } from '../store';

export interface SnakesState { pos: number[]; dice: number; sixes: number }
export interface Shown { pos: number[]; turn: number; dice: { s: number; d: number; rolling: boolean } | null; jumping: boolean }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Matches animMs in packages/game-rules/snakes.js, so computer players wait for the animations.
const PACE = { roll: 900, reveal: 300, step: 170, jump: 750, stay: 500, turn: 300 };

/** Plays each update's events (dice, steps, a ladder or snake) in order before showing the next update. */
export function useSnakesPlayback(g: Game<SnakesState>, me: number) {
  const [shown, setShown] = useState<Shown>(() => ({ pos: g.s.pos, turn: g.turn, dice: null, jumping: false }));
  const [busy, setBusy] = useState(false);
  const queue = useRef<Game<SnakesState>[]>([]);
  const lastV = useRef(g.v);
  const running = useRef(false);

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
        await play(f.ev, setShown, me);
        setShown((s) => ({ ...s, pos: f.s.pos, turn: f.turn, jumping: false }));
      }
      running.current = false;
      setBusy(false);
    })();
  }, [g, me]);

  return { shown, busy };
}

async function play(ev: GameEvent[], setShown: (fn: (s: Shown) => Shown) => void, me: number) {
  const put = (s: number, p: number, jumping = false) => setShown((x) => ({ ...x, jumping, pos: x.pos.map((q, i) => (i === s ? p : q)) }));
  for (const e of ev) {
    switch (e.k) {
      case 'roll':
        setShown((x) => ({ ...x, turn: e.s!, dice: { s: e.s!, d: e.d, rolling: true } }));
        playSound('roll');
        await sleep(PACE.roll);
        setShown((x) => ({ ...x, dice: { s: e.s!, d: e.d, rolling: false } }));
        await sleep(PACE.reveal);
        break;
      case 'move':
        for (let p = Math.max(e.from, 0) + 1; p <= e.to; p++) { put(e.s!, p); playSound('step'); await sleep(PACE.step); }
        if (e.to === GOAL && e.s === me) playSound('home');
        break;
      case 'jump':
        playSound(e.kind === 'ladder' ? 'zip' : 'capture');
        put(e.s!, e.to, true);
        await sleep(PACE.jump);
        break;
      case 'stay': case 'burn': await sleep(PACE.stay); break;
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
