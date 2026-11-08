// Car Out: the lot, the cars, the gap on the right. Drag a car along its length, or tap it and then a
// dot; undo, start again, a hint from the solver. The level and the fewest moves are kept on this device.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ChevronsRight, Lightbulb, RotateCcw, Undo2 } from 'lucide-react';
import { cn } from '@sanga/ui/utils';
import { t } from '@sanga/i18n';
import { levelLabel, newSeed, ResultCard, ToolButton, useSaved } from '../../kit';
import { EXIT_ROW, N, cells, makeLevel, move, range, solve, won, type Move } from './logic';

const COLOURS = ['#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316', '#14b8a6', '#ec4899', '#64748b', '#84cc16', '#6366f1', '#06b6d4', '#d97706'];
const pct = (x: number) => `${(x * 100) / N}%`;

export default function CarOut() {
  const [saved, setSaved] = useSaved('carout', { level: 1, best: {} as Record<string, number> });
  const seed = useMemo(() => newSeed(), []);
  const lvl = useMemo(() => makeLevel(saved.level, seed), [saved.level, seed]);
  const { cars } = lvl;
  const [history, setHistory] = useState<number[][]>([lvl.start]);
  const [picked, setPicked] = useState<number | null>(null);
  const [hint, setHint] = useState<Move | null>(null);
  const [drag, setDrag] = useState<{ car: number; off: number } | null>(null);
  const [gone, setGone] = useState(false);
  const dragRef = useRef<{ car: number; x: number; y: number; size: number; lo: number; hi: number; moved: boolean } | null>(null);
  const board = useRef<HTMLDivElement>(null);
  const pos = history[history.length - 1];
  const out = won(cars, pos);
  const moves = history.length - 1;

  const reset = () => { setHistory([lvl.start]); setPicked(null); setHint(null); setGone(false); };
  if (history[0] !== lvl.start) reset(); // a new level

  useEffect(() => {
    if (!out) return;
    setSaved((s) => ({ ...s, best: { ...s.best, [s.level]: Math.min(s.best[s.level] ?? Infinity, moves) } }));
    const id = setTimeout(() => setGone(true), 650);
    return () => clearTimeout(id);
  }, [out]); // eslint-disable-line react-hooks/exhaustive-deps

  const slide = (car: number, to: number) => {
    if (to === pos[car] || out) return;
    setHistory((h) => [...h, move(pos, [car, to])]);
    setHint(null);
    setPicked(null);
  };

  const down = (e: PointerEvent<HTMLButtonElement>, car: number) => {
    if (out || !board.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const [lo, hi] = range(cars, pos, car);
    dragRef.current = { car, x: e.clientX, y: e.clientY, size: board.current.clientWidth / N, lo, hi, moved: false };
  };
  const moveDrag = (e: PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const c = cars[d.car];
    const px = c.horiz ? e.clientX - d.x : e.clientY - d.y;
    if (Math.abs(px) > 6) d.moved = true;
    if (!d.moved) return;
    const p = pos[d.car];
    setDrag({ car: d.car, off: Math.max(d.lo - p, Math.min(d.hi - p, px / d.size)) });
  };
  const up = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (!d.moved) { setPicked((p) => (p === d.car ? null : d.car)); return; }
    const to = pos[d.car] + Math.round(drag?.car === d.car ? drag.off : 0);
    setDrag(null);
    slide(d.car, to);
  };
  const key = (e: KeyboardEvent, car: number) => {
    const c = cars[car];
    const step = { ArrowLeft: c.horiz ? -1 : 0, ArrowRight: c.horiz ? 1 : 0, ArrowUp: c.horiz ? 0 : -1, ArrowDown: c.horiz ? 0 : 1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const [lo, hi] = range(cars, pos, car);
    slide(car, Math.max(lo, Math.min(hi, pos[car] + step)));
  };
  const askHint = () => { const path = solve(cars, pos); if (path?.length) { setHint(path[0]); setPicked(null); } };

  // Where the picked car can go: a dot on each free square along its line.
  const dots: { cell: number; to: number }[] = [];
  if (picked !== null && !out) {
    const c = cars[picked], p = pos[picked], [lo, hi] = range(cars, pos, picked);
    for (let to = lo; to <= hi; to++) if (to !== p) { const along = to < p ? to : to + c.len - 1; dots.push({ cell: c.horiz ? c.fixed * N + along : along * N + c.fixed, to }); }
  }
  const hintCell = hint && (() => { const c = cars[hint[0]], along = hint[1] < pos[hint[0]] ? hint[1] : hint[1] + c.len - 1; return c.horiz ? c.fixed * N + along : along * N + c.fixed; })();
  const name = (i: number) => (i === 0 ? t('Red car') : cars[i].len === 3 ? t('Truck {n}', { n: i }) : t('Car {n}', { n: i }));
  const best = saved.best[saved.level];

  return (
    <div className="flex h-full flex-col items-center gap-3 px-3 py-3">
      <div className="flex w-full max-w-md items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="w-fit rounded-full bg-black/25 px-3 py-1 text-sm font-semibold">{levelLabel(saved.level)}</span>
          <span className="mt-1 pl-1 text-xs text-white/70">{t('Moves: {n}', { n: moves })}{best !== undefined && ` · ${t('Best: {n}', { n: best })}`}</span>
        </div>
        <div className="flex gap-2">
          <ToolButton label={t('Undo')} onClick={() => { setHistory((h) => h.slice(0, -1)); setHint(null); setPicked(null); }} disabled={moves < 1 || out}><Undo2 className="size-4" /></ToolButton>
          <ToolButton label={t('Start again')} onClick={reset} disabled={moves < 1}><RotateCcw className="size-4" /></ToolButton>
          <ToolButton label={t('Hint')} onClick={askHint} disabled={out}><Lightbulb className="size-4" />{t('Hint')}</ToolButton>
        </div>
      </div>

      <p className="min-h-5 text-center text-sm text-white/85" role="status">
        {out ? t('Out! Well driven.')
          : hint ? t('Slide the glowing car to the marked spot.')
          : picked !== null ? t('Drag it, or tap a dot to slide it there.')
          : t('Clear a way for the red car to drive out on the right.')}
      </p>

      <div className="relative min-h-0 w-full flex-1" style={{ containerType: 'size' }}>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-slate-950/60 p-2.5 shadow-2xl ring-1 ring-white/10"
          style={{ width: 'min(100cqw - 1rem, 100cqh, 28rem)' }}>
          {/* the gap the red car drives out of */}
          <div className="absolute -right-0.5 flex w-3.5 items-center justify-center rounded-r-md bg-amber-400 text-slate-900"
            style={{ top: `calc(0.625rem + (100% - 1.25rem) * ${EXIT_ROW / N})`, height: `calc((100% - 1.25rem) / ${N})` }} aria-hidden>
            <ChevronsRight className="size-3.5" />
          </div>
          <div ref={board} className="relative aspect-square w-full touch-none select-none rounded-2xl bg-slate-700/80"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: `${100 / N}% ${100 / N}%` }}
            role="group" aria-label={t('Parking lot')}>
            {hint && hintCell !== null && (() => {
              const c = cars[hint[0]], xs = cells(c, hint[1]);
              return <div data-hint-spot="" className="pointer-events-none absolute rounded-xl border-2 border-dashed border-amber-300 bg-amber-300/15 transition-all"
                style={{ left: pct(xs[0] % N), top: pct(Math.floor(xs[0] / N)), width: pct(c.horiz ? c.len : 1), height: pct(c.horiz ? 1 : c.len) }} />;
            })()}
            {cars.map((c, i) => {
              const off = drag?.car === i ? drag.off : 0;
              const at = pos[i] + off;
              const leaving = i === 0 && out;
              return (
                <button key={i} type="button" aria-label={name(i)} aria-pressed={picked === i}
                  data-hint-car={hint?.[0] === i ? '' : undefined}
                  onPointerDown={(e) => down(e, i)} onPointerMove={moveDrag} onPointerUp={up} onPointerCancel={() => { dragRef.current = null; setDrag(null); }}
                  onKeyDown={(e) => key(e, i)} onClick={(e) => { if (e.detail === 0) setPicked((p) => (p === i ? null : i)); }}
                  className={cn('absolute p-[3px] outline-none', drag?.car === i ? 'z-10' : 'transition-all duration-200 ease-out', leaving && 'duration-700 ease-in')}
                  style={{
                    left: pct(c.horiz ? at : c.fixed), top: pct(c.horiz ? c.fixed : at), width: pct(c.horiz ? c.len : 1), height: pct(c.horiz ? 1 : c.len),
                    transform: leaving ? 'translateX(160%)' : undefined, opacity: leaving ? 0 : 1, cursor: out ? 'default' : c.horiz ? 'ew-resize' : 'ns-resize',
                  }}>
                  <span className={cn('relative block h-full w-full rounded-[0.7rem] shadow-[inset_0_-3px_0_rgba(0,0,0,0.25),0_3px_6px_rgba(0,0,0,0.35)] transition',
                    picked === i && 'ring-4 ring-white/80', hint?.[0] === i && 'ring-4 ring-amber-300 animate-pulse')}
                    style={{ background: i === 0 ? '#ef4444' : COLOURS[(i - 1) % COLOURS.length] }}>
                    <span className={cn('absolute rounded-md bg-slate-900/30', c.horiz ? 'inset-y-[22%] left-[18%] right-[28%]' : 'inset-x-[22%] top-[18%] bottom-[28%]')} />
                    <span className={cn('absolute rounded-sm bg-white/45', c.horiz ? 'inset-y-[26%] right-[12%] w-[8%]' : 'inset-x-[26%] bottom-[12%] h-[8%]')} />
                    {i === 0 && <ChevronsRight className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 text-white" />}
                  </span>
                </button>
              );
            })}
            {dots.map(({ cell, to }) => (
              <button key={cell} type="button" aria-label={t('Slide here: row {r}, column {c}', { r: Math.floor(cell / N) + 1, c: (cell % N) + 1 })}
                data-hint-target={hint && picked === hint[0] && hintCell === cell ? '' : undefined}
                onClick={() => slide(picked!, to)}
                className="absolute grid place-items-center animate-fade-in" style={{ left: pct(cell % N), top: pct(Math.floor(cell / N)), width: pct(1), height: pct(1) }}>
                <span className={cn('size-4 rounded-full bg-white/70 shadow', hint && hintCell === cell && 'bg-amber-300')} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {gone && (
        <ResultCard emoji="🚗" title={t('Level {n} done!', { n: saved.level })} primary={{ label: t('Next level'), onClick: () => setSaved((s) => ({ ...s, level: s.level + 1 })) }}
          secondary={{ label: t('Play again'), onClick: reset }}>
          {t('Out in {n} moves. The fewest it can be done in: {best}.', { n: moves, best: lvl.best })}
        </ResultCard>
      )}
    </div>
  );
}
