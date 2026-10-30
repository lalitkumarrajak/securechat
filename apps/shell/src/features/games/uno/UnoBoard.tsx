// The UNO table: opponents along the top, the draw pile and discard pile in the middle, your hand
// fanned at the bottom. The server only ever sends your own cards (and how many others hold).
import { useEffect, useRef, useState } from 'react';
import { Hand, RotateCcw, RotateCw } from 'lucide-react';
import { Avatar } from '../../../components/Avatar';
import { cn } from '@sanga/ui/utils';
import { card, COLORS, fits } from '@sanga/game-rules/uno.js';
import { playSound } from '../sounds';
import type { Game, GameEvent } from '../store';
import type { GameBoardProps } from '../registry';
import { TurnRing } from '../TurnRing';
import { Chances } from '../Chances';
import { UnoView } from './uno-board/types';
import { HEX, NAME, nameOf, describe } from './uno-board/helpers';
import { Opponent } from './uno-board/Opponent';
import { CardsInHand } from './uno-board/CardsInHand';
import { UnoCard } from './uno-board/UnoCard';
import { CardBack } from './uno-board/CardBack';

export default function UnoBoard({ g: game, me, act, bubble }: GameBoardProps) {
  const g = game as Game<UnoView>;
  const s = g.s;
  const meIdx = g.players.findIndex((p) => p.u === me);
  const myTurn = g.status === 'play' && g.turn === meIdx;
  const [wild, setWild] = useState<number | null>(null); // wild card waiting for a colour
  const banner = useBanner(g, meIdx);

  // Opponents in turn order, starting after me.
  const n = g.players.length;
  const others = Array.from({ length: n - 1 }, (_, k) => (meIdx + 1 + k) % n);

  const playable = (id: number) => myTurn && (s.drawn === null || s.drawn === id) && fits(s, id);
  const play = (id: number) => {
    if (!playable(id)) return;
    if (card(id).c === 'w') setWild(id);
    else act({ a: 'play', id });
  };
  const canDraw = myTurn && s.drawn === null;
  const canCallUno = g.status === 'play' && s.said !== meIdx && (s.uno === meIdx || (myTurn && s.hand.length === 2 && s.hand.some((id) => fits(s, id))));

  return (
    <div className="relative flex h-full min-h-0 flex-col justify-between gap-2 px-2 pt-1 pb-2">
      {/* opponents */}
      <div className="flex shrink-0 justify-center gap-2 overflow-x-auto pb-1">
        {others.map((j) => (
          <Opponent key={g.players[j].u} g={g} j={j} me={meIdx} bubble={bubble(g.players[j].u)} onCatch={() => act({ a: 'catch', s: j })} />
        ))}
      </div>

      {/* table */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center gap-6">
        <div className={cn('pointer-events-none absolute size-56 rounded-full border-4 border-dashed opacity-40', s.dir === 1 ? 'uno-spin' : 'uno-spin-rev')}
          style={{ borderColor: HEX[s.color] }} aria-hidden />
        <button type="button" onClick={() => canDraw && act({ a: 'draw' })} disabled={!canDraw} aria-label={`Draw a card (${s.deck} left)`}
          className={cn('relative', canDraw && 'uno-nudge')}>
          <span className="absolute top-1 left-1"><CardBack size="lg" /></span>
          <span className="absolute top-0.5 left-0.5"><CardBack size="lg" /></span>
          <span className="relative block"><CardBack size="lg" /></span>
          {canDraw && <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs font-semibold whitespace-nowrap text-white/90">Tap to draw</span>}
        </button>
        <div className="relative" aria-label={`Top card: ${describe(s.pile[s.pile.length - 1], s.color)}`} role="img">
          {s.pile.slice(-4, -1).map((id, k) => (
            <span key={id} className="absolute inset-0" style={{ rotate: `${(k - 1) * 12}deg` }}><UnoCard id={id} size="lg" /></span>
          ))}
          <span key={s.pile[s.pile.length - 1]} className="uno-land relative block"><UnoCard id={s.pile[s.pile.length - 1]} size="lg" /></span>
          <span className="absolute -right-3 -bottom-3 size-8 rounded-full border-4 border-white shadow-lg" style={{ background: HEX[s.color] }}
            title={`Colour: ${NAME[s.color]}`} />
        </div>
        <div className="absolute top-1 right-2 flex items-center gap-1 rounded-full bg-black/30 px-2 py-0.5 text-[11px] text-white/80">
          {s.dir === 1 ? <RotateCw className="size-3.5" /> : <RotateCcw className="size-3.5" />} {s.dir === 1 ? 'Clockwise' : 'Anticlockwise'}
        </div>
        {banner && (
          <div key={banner.key} className="uno-banner pointer-events-none absolute top-1/2 left-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-2xl px-5 py-2 text-center text-xl font-black text-white shadow-2xl"
            style={{ background: banner.color }} role="status">{banner.text}</div>
        )}
      </div>

      {/* me */}
      {meIdx >= 0 && (
        <div className="shrink-0">
          <div className="mb-1 flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2">
              <TurnRing active={myTurn} deadline={g.deadline} color="#fff">
                <div className="rounded-xl bg-white p-0.5"><Avatar u={me} name={g.players[meIdx].n} size={34} className="[&>*]:rounded-lg" /></div>
              </TurnRing>
              <div className="text-xs leading-tight text-white">
                <div className="font-semibold">{myTurn ? (s.drawn !== null ? 'Play it or keep it' : 'Your turn') : g.status === 'play' ? `${nameOf(g, g.turn)}’s turn` : ''}</div>
                <div className="text-white/70">{s.hand.length} card{s.hand.length === 1 ? '' : 's'}</div>
                {g.players[meIdx].state === 'playing' && <Chances missed={g.players[meIdx].missed || 0} />}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {myTurn && s.drawn !== null && (
                <button type="button" onClick={() => act({ a: 'keep' })} className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-2 text-sm font-semibold text-white hover:bg-white/25">
                  <Hand className="size-4" /> Keep
                </button>
              )}
              {canCallUno && (
                <button type="button" onClick={() => { act({ a: 'uno' }); playSound('uno'); }} aria-label="Call UNO"
                  className="uno-pulse grid size-14 place-items-center rounded-full border-4 border-yellow-300 bg-red-600 text-sm font-black text-yellow-300 italic shadow-xl">
                  UNO!
                </button>
              )}
            </div>
          </div>
          <CardsInHand cards={s.hand} playable={playable} drawn={s.drawn} onPlay={play} />
        </div>
      )}

      {wild !== null && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/60" role="dialog" aria-label="Choose a colour">
          <div className="rounded-3xl bg-white p-5 text-center shadow-2xl">
            <p className="mb-3 font-semibold text-slate-900">Choose a colour</p>
            <div className="grid grid-cols-2 gap-3">
              {COLORS.map((c) => (
                <button key={c} type="button" aria-label={NAME[c]} onClick={() => { act({ a: 'play', id: wild, color: c }); setWild(null); }}
                  className="size-20 rounded-2xl shadow-lg ring-white transition hover:scale-105 focus:ring-4" style={{ background: HEX[c] }} />
              ))}
            </div>
            <button type="button" onClick={() => setWild(null)} className="mt-3 text-sm text-slate-500 underline">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Big announcements for what just happened, one after another, with sounds.
function useBanner(g: Game<UnoView>, me: number) {
  const [banner, setBanner] = useState<{ key: number; text: string; color: string } | null>(null);
  const lastV = useRef(g.v);
  const queue = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    if (g.v <= lastV.current) return;
    lastV.current = g.v;
    const items: { text: string; color: string; sound: Parameters<typeof playSound>[0] }[] = [];
    const who = (j?: number) => (j === me ? 'You' : nameOf(g, j ?? -1));
    for (const e of g.ev as GameEvent[]) {
      if (e.k === 'play') {
        const k = card(e.id);
        playSound('card');
        if (k.c === 'w') items.push({ text: `${NAME[e.color]}!`, color: HEX[e.color], sound: 'skip' });
      } else if (e.k === 'draw') {
        playSound('draw');
        const n = e.ids?.length ?? e.n;
        if (e.why === 'd2' || e.why === 'w4') items.push({ text: `+${n} for ${who(e.s)}`, color: '#7c2d12', sound: 'plus' });
        if (e.why === 'caught') items.push({ text: `${who(e.s)} forgot UNO! +2`, color: '#7c2d12', sound: 'plus' });
      } else if (e.k === 'skip') items.push({ text: `${who(e.s)} ${e.s === me ? 'are' : 'is'} skipped`, color: '#334155', sound: 'skip' });
      else if (e.k === 'reverse') items.push({ text: 'Reverse!', color: '#334155', sound: 'skip' });
      else if (e.k === 'uno' && e.s !== me) items.push({ text: `${who(e.s)}: UNO!`, color: '#dc2626', sound: 'uno' });
      else if (e.k === 'turn' && e.s === me) { playSound('turn'); navigator.vibrate?.(30); }
      else if (e.k === 'start') playSound('shuffle');
    }
    for (const it of items) {
      queue.current = queue.current.then(async () => {
        playSound(it.sound);
        setBanner({ key: Math.random(), text: it.text, color: it.color });
        await new Promise((r) => setTimeout(r, 1100));
        setBanner(null);
      });
    }
  }, [g, me]);
  return banner;
}
