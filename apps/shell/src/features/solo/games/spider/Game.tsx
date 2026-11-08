// Spider Solitaire: ten columns of narrow cards that fit a phone, tap a card to send it where it fits
// best or drag it, deal a row from the stock, undo, hint. The game in progress is kept on this device.
import { useLayoutEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { Lightbulb, Plus, Undo2 } from 'lucide-react';
import { cn } from '@sanga/ui/utils';
import { t, tk, tn } from '@sanga/i18n';
import { newSeed, ResultCard, testMode, ToolButton, useSaved } from '../../kit';
import { bestTarget, canDeal, canMove, deal, hint, move, newGame, RUNS, runStart, won, type Card, type Move, type Spider } from './logic';

const SUIT = ['♠', '♥', '♦', '♣'];
const SUIT_NAMES = [tk('spades'), tk('hearts'), tk('diamonds'), tk('clubs')];
const RANK = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const RANK_NAMES: Record<number, string> = { 1: tk('Ace'), 11: tk('Jack'), 12: tk('Queen'), 13: tk('King') };
const red = (s: number) => s === 1 || s === 2;
const cardName = (c: Card) => t('{rank} of {suit}', { rank: RANK_NAMES[c.r] ? t(RANK_NAMES[c.r]) : c.r, suit: t(SUIT_NAMES[c.s]) });
const LEVELS: { suits: 1 | 2 | 4; name: string }[] = [{ suits: 1, name: tk('Easy') }, { suits: 2, name: tk('Medium') }, { suits: 4, name: tk('Hard') }];

interface Saved { game: Spider | null; wins: Record<string, number> }
type Note = { kind: 'hint'; h: Move | 'deal' | null } | { kind: 'cant'; card: string } | { kind: 'empty' } | { kind: 'run' } | null;

const STYLE = /* CSS, i18n-ok */ `
@keyframes spider-in { from { transform: translateY(46px) scale(.85); opacity: 0; } }
@keyframes spider-glow { 50% { box-shadow: 0 0 0 3px #fcd34d, 0 0 14px 3px #fcd34daa; } }
.spider-card { transition: left .2s cubic-bezier(.2,.8,.3,1), top .2s cubic-bezier(.2,.8,.3,1); }
.spider-back { background: repeating-linear-gradient(45deg, #ffffff22 0 3px, transparent 3px 7px), linear-gradient(160deg, #4f46e5, #312e81); }`;

function useSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

export default function SpiderSolitaire() {
  const [saved, setSaved] = useSaved<Saved>('spider', { game: null, wins: {} });
  const [history, setHistory] = useState<Spider[]>([]);
  const [picking, setPicking] = useState(!saved.game);
  const [note, setNote] = useState<Note>(null);
  const [drag, setDrag] = useState<{ from: number; idx: number; x0: number; y0: number; dx: number; dy: number; moved: boolean } | null>(null);
  const [shake, setShake] = useState(-1);
  const justDragged = useRef(false);
  const [boardRef, size] = useSize();
  const g = saved.game;

  const commit = (n: Spider) => {
    if (!g || n === g) return;
    setHistory((h) => [...h.slice(-199), g]);
    setNote(n.done.length > g.done.length ? { kind: 'run' } : null);
    setSaved((s) => ({ ...s, game: n, wins: won(n) ? { ...s.wins, [n.suits]: (s.wins[n.suits] ?? 0) + 1 } : s.wins }));
  };
  const start = (suits: 1 | 2 | 4) => { setSaved((s) => ({ ...s, game: newGame(newSeed(), suits) })); setHistory([]); setNote(null); setPicking(false); };
  const undo = () => { const prev = history[history.length - 1]; if (!prev) return; setHistory((h) => h.slice(0, -1)); setNote(null); setSaved((s) => ({ ...s, game: prev })); };

  const tap = (from: number, idx: number) => {
    if (!g) return;
    const to = bestTarget(g, from, idx);
    if (to < 0) { setNote({ kind: 'cant', card: cardName(g.cols[from][idx]) }); setShake(g.cols[from][idx].id); setTimeout(() => setShake(-1), 400); return; }
    commit(move(g, from, idx, to));
  };
  const dealRow = () => { if (!g) return; if (!canDeal(g)) { setNote({ kind: 'empty' }); return; } commit(deal(g)); };

  // card size and where each card sits: ten columns across, overlaps squeezed when a column is long
  const gap = size.w < 500 ? 3 : 8;
  const cw = Math.max(20, (size.w - gap * 9) / 10);
  const ch = Math.round(cw * 1.5);
  const pos = useMemo(() => {
    const out = new Map<number, { x: number; y: number; col: number; idx: number }>();
    if (!g) return out;
    g.cols.forEach((col, ci) => {
      const steps = col.slice(0, -1).map((c) => (c.up ? Math.max(16, ch * 0.4) : Math.max(5, ch * 0.13)));
      const total = steps.reduce((a, b) => a + b, 0);
      const f = total > 0 && total + ch > size.h ? Math.max(0.2, (size.h - ch) / total) : 1;
      let y = 0;
      col.forEach((c, i) => { out.set(c.id, { x: ci * (cw + gap), y, col: ci, idx: i }); y += (steps[i] ?? 0) * f; });
    });
    return out;
  }, [g, cw, ch, gap, size.h]);

  const hinted = note?.kind === 'hint' && note.h && note.h !== 'deal' ? note.h : null;
  const onDown = (e: RPointerEvent, from: number, idx: number) => {
    if (e.button !== 0 || !g) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ from, idx, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, moved: false });
  };
  const onMove = (e: RPointerEvent) => {
    if (!drag) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (drag.moved || Math.hypot(dx, dy) > 8) setDrag({ ...drag, dx, dy, moved: true });
  };
  const onUp = (e: RPointerEvent) => {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    if (!d.moved || !g || !boardRef.current) return;
    justDragged.current = true;
    setTimeout(() => { justDragged.current = false; }, 0);
    const left = boardRef.current.getBoundingClientRect().left;
    const to = Math.max(0, Math.min(9, Math.floor((e.clientX - left + gap / 2) / (cw + gap))));
    if (canMove(g, d.from, d.idx, to)) commit(move(g, d.from, d.idx, to));
  };


  const status = !g ? t('Choose how hard a game you want.')
    : won(g) ? t('All eight runs done!')
    : note?.kind === 'hint' ? (note.h === 'deal' ? t('Deal a row from the stock.') : note.h ? t('Move the {card} from column {a} to column {b}.', { card: cardName(g.cols[note.h.from][note.h.idx]), a: note.h.from + 1, b: note.h.to + 1 }) : t('No useful moves left. Undo or start a new game.'))
    : note?.kind === 'cant' ? t('The {card} can’t move anywhere.', { card: note.card })
    : note?.kind === 'empty' ? t('Fill every empty column before dealing.')
    : note?.kind === 'run' ? t('A full run! {n} of {total} done.', { n: g.done.length, total: RUNS })
    : t('Tap a card to move it, or drag it. Build King to Ace in one suit.');

  const level = LEVELS.find((l) => l.suits === g?.suits) ?? LEVELS[0];
  const test = testMode();

  return (
    <div className="flex h-full flex-col gap-2 px-1.5 pb-2 pt-1 sm:px-4">
      <style>{STYLE}</style>
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-2 px-1">
        <div className="flex min-w-0 gap-1.5 text-xs font-semibold">
          <span className="truncate rounded-full bg-black/25 px-2.5 py-1">{t(level.name)}</span>
          {g && <span className="rounded-full bg-black/25 px-2.5 py-1" aria-label={t('Score {n}', { n: g.score })}>★ {g.score}</span>}
          {g && <span className="whitespace-nowrap rounded-full bg-black/25 px-2.5 py-1">{tn(g.moves, '{n} move', '{n} moves')}</span>}
        </div>
        <div className="flex shrink-0 gap-1.5">
          <ToolButton label={t('Undo')} onClick={undo} disabled={!history.length || !g || won(g)}><Undo2 className="size-4" /></ToolButton>
          <ToolButton label={t('Hint')} onClick={() => g && setNote({ kind: 'hint', h: hint(g) })} disabled={!g || won(g)}><Lightbulb className="size-4" /></ToolButton>
          <ToolButton label={t('New game')} onClick={() => setPicking(true)}><Plus className="size-4" /></ToolButton>
        </div>
      </div>

      <p className="min-h-5 px-2 text-center text-[13px] leading-tight text-white/85" role="status">{status}</p>

      <div ref={boardRef} className="relative mx-auto min-h-0 w-full max-w-2xl flex-1 select-none" style={{ touchAction: 'none' }}
        onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}>
        {g && size.w > 0 && g.cols.map((col, ci) => (
          <div key={ci} className={cn('absolute rounded-md border border-dashed border-white/25', hinted?.to === ci && 'border-amber-300 border-solid')}
            style={{ left: ci * (cw + gap), top: 0, width: cw, height: ch }} aria-label={col.length ? undefined : t('Empty column {n}', { n: ci + 1 })} role={col.length ? undefined : 'img'} />
        ))}
        {g && size.w > 0 && g.cols.flatMap((col, ci) => {
          const rs = runStart(col);
          return col.map((c, i) => {
            const p = pos.get(c.id)!;
            const dragging = drag?.moved && drag.from === ci && i >= drag.idx;
            const isHint = hinted && hinted.from === ci && i >= hinted.idx;
            const style = { left: p.x, top: p.y, width: cw, height: ch, zIndex: dragging ? 100 + i : i, transform: dragging ? `translate(${drag!.dx}px, ${drag!.dy}px) scale(1.04)` : undefined, transition: dragging ? 'none' : undefined, animationDelay: `${ci * 25}ms` };
            if (!c.up) return <div key={c.id} aria-hidden className="spider-card spider-back absolute rounded-[5px] border border-white/40 shadow-sm" style={style} />;
            const movable = i >= rs;
            const fs = Math.max(10, Math.min(18, cw * 0.32));
            return (
              <button key={c.id} type="button" disabled={!movable}
                aria-label={t('{card}, column {n}', { card: cardName(c), n: ci + 1 })}
                data-col={test ? ci : undefined} data-idx={test ? i : undefined} data-hint={test && hinted && hinted.from === ci && hinted.idx === i ? 'card' : undefined}
                onPointerDown={movable ? (e) => onDown(e, ci, i) : undefined}
                onClick={() => { if (!justDragged.current && movable) tap(ci, i); }}
                className={cn('spider-card absolute overflow-hidden rounded-[5px] border bg-white text-left shadow-[0_1px_3px_rgba(0,0,0,0.35)] [animation:spider-in_.3s_ease-out_backwards] disabled:opacity-100',
                  red(c.s) ? 'text-red-600' : 'text-slate-900', movable ? 'border-slate-300' : 'border-slate-300 brightness-[.93]',
                  isHint && '[animation:spider-glow_1s_ease-in-out_infinite]', dragging && 'shadow-2xl', shake === c.id && 'animate-shake')}
                style={style}>
                <span className="absolute left-[3px] top-[1px] flex items-baseline font-bold leading-none tracking-tighter" style={{ fontSize: fs }}>
                  {RANK[c.r]}<span style={{ fontSize: fs * 0.82 }}>{SUIT[c.s]}</span>
                </span>
                <span className="absolute bottom-[2px] right-[3px] leading-none" style={{ fontSize: cw * 0.55 }} aria-hidden>{c.r > 10 ? RANK[c.r] : SUIT[c.s]}</span>
              </button>
            );
          });
        })}
      </div>

      {g && (
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-2 px-1">
          <div className="flex gap-1" aria-label={t('Runs done: {n} of {total}', { n: g.done.length, total: RUNS })} role="img">
            {Array.from({ length: RUNS }, (_, i) => (
              <span key={i} className={cn('grid h-8 w-6 place-items-center rounded border text-sm font-bold', i < g.done.length ? 'animate-pop border-white bg-white' : 'border-dashed border-white/30')}>
                {i < g.done.length && <span className={red(g.done[i]) ? 'text-red-600' : 'text-slate-900'}>{SUIT[g.done[i]]}</span>}
              </span>
            ))}
          </div>
          <button type="button" onClick={dealRow} disabled={!g.stock.length || won(g)}
            aria-label={t('Deal a row ({n} left)', { n: g.stock.length / 10 })}
            className={cn('relative h-12 w-20 shrink-0 rounded-lg disabled:opacity-30', note?.kind === 'hint' && note.h === 'deal' && '[animation:spider-glow_1s_ease-in-out_infinite]')}>
            {Array.from({ length: Math.max(1, g.stock.length / 10) }, (_, i) => (
              <span key={i} className="spider-back absolute top-0 h-12 w-9 rounded-[5px] border border-white/50 shadow" style={{ left: i * 8 }} />
            ))}
            <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-amber-400 text-[11px] font-bold text-slate-900">{g.stock.length / 10}</span>
          </button>
        </div>
      )}

      {picking && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/55 p-5 animate-fade-in" role="dialog" aria-label={t('New game')}>
          <div className="w-full max-w-xs rounded-3xl bg-white p-6 text-center text-slate-900 shadow-2xl">
            <div className="text-4xl" aria-hidden>🕷️</div>
            <h2 className="mt-2 text-xl font-bold">{t('New game')}</h2>
            <p className="mt-1 text-sm text-slate-600">{t('More suits make it harder.')}</p>
            <div className="mt-4 grid gap-2">
              {LEVELS.map((l) => (
                <button key={l.suits} type="button" onClick={() => start(l.suits)}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-left font-semibold hover:bg-slate-50">
                  <span>{t(l.name)} <span className="text-sm font-normal text-slate-500">· {tn(l.suits, '{n} suit', '{n} suits')}</span></span>
                  <span className="text-lg" aria-hidden>{SUIT.slice(0, l.suits).join('')}</span>
                </button>
              ))}
            </div>
            {g && <button type="button" onClick={() => setPicking(false)} className="mt-3 text-sm font-medium text-slate-500 hover:text-slate-800">{t('Cancel')}</button>}
          </div>
        </div>
      )}

      {g && won(g) && !picking && (
        <ResultCard emoji="🏆" title={t('You won! 🎉')} primary={{ label: t('Play again'), onClick: () => start(g.suits) }} secondary={{ label: t('New game'), onClick: () => setPicking(true) }}>
          {t('Score {n}', { n: g.score })} · {tn(g.moves, '{n} move', '{n} moves')}
          <br />{tn(saved.wins[g.suits] ?? 0, '{n} win at this level', '{n} wins at this level')}
        </ResultCard>
      )}
    </div>
  );
}
