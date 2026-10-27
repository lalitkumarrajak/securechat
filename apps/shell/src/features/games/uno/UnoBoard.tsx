// The UNO table: opponents along the top, the draw pile and discard pile in the middle, your hand
// fanned at the bottom. The server only ever sends your own cards (and how many others hold).
import { useEffect, useRef, useState } from 'react';
import { Ban, Hand, Repeat2, RotateCcw, RotateCw } from 'lucide-react';
import { Avatar } from '../../../components/Avatar';
import { cn } from '@sanga/ui/utils';
import { card, COLORS, fits } from '@sanga/game-rules/uno.js';
import { playSound } from '../sounds';
import type { Game, GameEvent } from '../store';
import type { GameBoardProps } from '../registry';
import { Chances, TurnRing } from '../TurnRing';

interface UnoView { hand: number[]; counts: number[]; pile: number[]; deck: number; color: string; dir: number; drawn: number | null; uno: number | null; said: number | null }

export const HEX: Record<string, string> = { r: '#e5322d', y: '#f7c300', g: '#2fa84f', b: '#1e74d6', w: '#1c1c1c' };
const NAME: Record<string, string> = { r: 'Red', y: 'Yellow', g: 'Green', b: 'Blue' };

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

const nameOf = (g: Game<UnoView>, j: number) => g.players[j]?.n || g.players[j]?.u || '';

function describe(id: number, color: string) {
  const k = card(id);
  const v = { skip: 'Skip', rev: 'Reverse', d2: 'Draw Two', wild: 'Wild', w4: 'Wild Draw Four' }[k.v] || k.v;
  return k.c === 'w' ? `${v}, ${NAME[color]}` : `${NAME[k.c]} ${v}`;
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

function Opponent({ g, j, me, bubble, onCatch }: { g: Game<UnoView>; j: number; me: number; bubble: string | null; onCatch: () => void }) {
  const pl = g.players[j];
  const s = g.s;
  const count = s.counts[j] ?? 0;
  const active = g.status === 'play' && g.turn === j;
  const gone = pl.state === 'left' || pl.state === 'out';
  return (
    <div className={cn('relative flex w-[76px] shrink-0 flex-col items-center gap-1 rounded-2xl border-2 bg-black/25 px-1 py-1.5', active ? 'border-white' : 'border-transparent', gone && 'opacity-40')}
      data-player={pl.u}>
      <TurnRing active={active} deadline={g.deadline} color="#fff">
        <div className="rounded-xl bg-white p-0.5"><Avatar u={pl.u} name={pl.n} size={34} className="[&>*]:rounded-lg" /></div>
      </TurnRing>
      <div className="w-full truncate text-center text-[11px] font-semibold text-white">{pl.n || pl.u}</div>
      <div className="relative h-7 w-full">
        {Array.from({ length: Math.min(count, 7) }, (_, k) => (
          <span key={k} className="absolute top-0" style={{ left: `calc(50% - 9px + ${(k - Math.min(count, 7) / 2 + 0.5) * 6}px)`, rotate: `${(k - 3) * 5}deg` }}>
            <CardBack size="xs" />
          </span>
        ))}
        <span className="absolute -right-1 -bottom-1 grid min-w-5 place-items-center rounded-full bg-white px-1 text-[11px] font-bold text-slate-900 shadow" aria-label={`${count} cards`}>{count}</span>
      </div>
      {pl.rank ? <span className="text-[10px] font-semibold text-amber-300">{pl.rank === 1 ? 'Winner!' : `#${pl.rank}`}</span>
        : s.uno === j && j !== me ? (
          <button type="button" onClick={onCatch} className="uno-pulse rounded-full bg-yellow-300 px-2 py-0.5 text-[11px] font-black text-red-700 shadow" aria-label={`Catch ${pl.n}: they didn't say UNO`}>Catch!</button>
        ) : count === 1 ? <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black text-yellow-300 italic">UNO</span>
        : pl.state === 'playing' && !pl.bot ? <Chances missed={pl.missed || 0} /> : null}
      {bubble && (
        <div className="ludo-bubble absolute top-full z-20 mt-1 max-w-[150px] rounded-2xl bg-white px-3 py-1.5 text-sm font-medium text-slate-900 shadow-lg">{bubble}</div>
      )}
    </div>
  );
}

// My cards, fanned; the ones I can play now are lifted.
function CardsInHand({ cards, playable, drawn, onPlay }: { cards: number[]; playable: (id: number) => boolean; drawn: number | null; onPlay: (id: number) => void }) {
  const sorted = [...cards].sort((a, b) => order(a) - order(b));
  const overlap = sorted.length > 7 ? Math.min(40, 64 - 300 / sorted.length) : 18;
  return (
    <div className="flex justify-center overflow-x-auto px-4 pt-4 pb-1" role="list" aria-label="Your cards">
      {sorted.map((id, k) => {
        const ok = playable(id);
        return (
          <button key={id} type="button" role="listitem" onClick={() => onPlay(id)} disabled={!ok}
            aria-label={`${describe(id, card(id).c)}${ok ? ', playable' : ''}`}
            className={cn('shrink-0 transition-transform duration-200 disabled:cursor-default', ok ? '-translate-y-3 hover:-translate-y-5' : 'brightness-75', id === drawn && 'ring-4 ring-yellow-300 rounded-xl')}
            style={{ marginLeft: k ? -overlap : 0, zIndex: k }}>
            <UnoCard id={id} size="md" />
          </button>
        );
      })}
    </div>
  );
}

const order = (id: number) => { const k = card(id); return 'rygbw'.indexOf(k.c) * 100 + (/\d/.test(k.v) ? +k.v : { skip: 10, rev: 11, d2: 12, wild: 13, w4: 14 }[k.v as 'skip']); };

const SIZES = { xs: 'h-[26px] w-[18px] rounded-[3px] border', md: 'h-24 w-16 rounded-xl border-[3px]', lg: 'h-[126px] w-[84px] rounded-2xl border-4' };

/** A card face, drawn with plain HTML so it's crisp at any size. */
export function UnoCard({ id, size }: { id: number; size: 'md' | 'lg' }) {
  const k = card(id);
  const big = size === 'lg' ? 'text-5xl' : 'text-4xl';
  const sym = (cls: string) => k.v === 'skip' ? <Ban className={cls} strokeWidth={3} />
    : k.v === 'rev' ? <Repeat2 className={cls} strokeWidth={3} />
    : k.v === 'd2' ? '+2' : k.v === 'w4' ? '+4' : k.v === 'wild' ? '' : k.v;
  return (
    <span className={cn('relative block overflow-hidden border-white shadow-[0_4px_10px_rgba(0,0,0,0.45)]', SIZES[size])} style={{ background: HEX[k.c] }}>
      <span className="absolute inset-[12%_6%] -rotate-[28deg] rounded-[50%] bg-white"
        style={k.c === 'w' ? { background: `conic-gradient(${HEX.r} 0 90deg, ${HEX.y} 0 180deg, ${HEX.g} 0 270deg, ${HEX.b} 0)` } : undefined} />
      <span className={cn('absolute inset-0 grid place-items-center font-black italic', big, k.c === 'w' ? 'text-white [text-shadow:0_2px_0_#000]' : '')}
        style={k.c === 'w' ? undefined : { color: HEX[k.c], WebkitTextStroke: '1px rgba(0,0,0,0.25)' }}>
        {typeof sym('') === 'string' ? sym('') : sym(size === 'lg' ? 'size-12' : 'size-9')}
      </span>
      <span className="absolute top-0.5 left-1 text-xs font-black text-white italic [text-shadow:0_1px_0_#0006]">{typeof sym('') === 'string' ? sym('') : sym('size-3')}</span>
    </span>
  );
}

export function CardBack({ size }: { size: 'xs' | 'md' | 'lg' }) {
  return (
    <span className={cn('relative block overflow-hidden border-white bg-[#1c1c1c] shadow-[0_3px_8px_rgba(0,0,0,0.45)]', SIZES[size])} aria-hidden>
      <span className="absolute inset-[14%_8%] -rotate-[28deg] rounded-[50%] bg-[#e5322d]" />
      {size !== 'xs' && (
        <span className={cn('absolute inset-0 grid -rotate-[20deg] place-items-center font-black text-[#f7c300] italic [text-shadow:2px_2px_0_#000]', size === 'lg' ? 'text-2xl' : 'text-lg')}>UNO</span>
      )}
    </span>
  );
}
