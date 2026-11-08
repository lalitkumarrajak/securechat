// Picture Cross: the clues, the grid; tap to fill, press and hold (or Mark) for ✕, drag along a line to
// do several. A clue fades when its line is right; all right and the picture shows in colour.
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { Lightbulb, RotateCcw, Square, Undo2, X } from 'lucide-react';
import { cn } from '@sanga/ui/utils';
import { t, tk } from '@sanga/i18n';
import { levelLabel, ResultCard, testMode, ToolButton, useSaved } from '../../kit';
import { clues, colOf, lineOk, puzzleFor, rowOf, won } from './logic';

const EMPTY = 0, FILLED = 1, MARKED = 2;
const STATES = [tk('empty'), tk('filled'), tk('marked')];

export default function PictureCross() {
  const [saved, setSaved] = useSaved('nonogram', { level: 1, best: {} as Record<string, number> });
  const pz = useMemo(() => puzzleFor(saved.level), [saved.level]);
  const clue = useMemo(() => clues(pz), [pz]);
  const { w, h } = pz;
  const blank = useMemo(() => Array.from({ length: w * h }, () => EMPTY), [w, h, pz]); // eslint-disable-line react-hooks/exhaustive-deps
  const [history, setHistory] = useState<number[][]>([blank]);
  const [mode, setMode] = useState<'fill' | 'mark'>('fill');
  const [hinted, setHinted] = useState(-1);
  const grid = useRef<HTMLDivElement>(null);
  const press = useRef<{ start: number; value: number; from: number; pending: boolean; timer: number; cells: number[] } | null>(null);
  const [live, setLive] = useState<number[] | null>(null); // the cells while a press or drag is going on
  const cells = live ?? history[history.length - 1];
  const filled = cells.map((v) => v === FILLED);
  const done = won(pz, filled);

  const [show, setShow] = useState(false);
  const reset = () => { setHistory([blank]); setLive(null); setHinted(-1); setShow(false); };
  if (history[0] !== blank) reset(); // a new level
  useEffect(() => { // let the picture show before the card covers it
    if (!done) return;
    const id = setTimeout(() => setShow(true), 1400);
    return () => clearTimeout(id);
  }, [done]);

  const cellAt = (e: PointerEvent) => {
    const r = grid.current!.getBoundingClientRect();
    const c = Math.floor(((e.clientX - r.left) / r.width) * w), row = Math.floor(((e.clientY - r.top) / r.height) * h);
    return c < 0 || row < 0 || c >= w || row >= h ? -1 : row * w + c;
  };
  /** Paint one square: fill or ✕ only empty squares; clear only squares like the first one pressed. */
  const paint = (p: NonNullable<typeof press.current>, i: number) => {
    const v = p.cells[i];
    if (p.value === EMPTY ? v === p.from : v === EMPTY || i === p.start) p.cells = p.cells.map((x, k) => (k === i ? p.value : x));
    setLive(p.cells);
  };
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (done) return;
    const i = cellAt(e);
    if (i < 0) return;
    grid.current!.setPointerCapture(e.pointerId);
    const now = history[history.length - 1], from = now[i];
    const want = mode === 'fill' ? FILLED : MARKED;
    const p = { start: i, from, value: from === want ? EMPTY : want, pending: true, timer: 0, cells: now };
    p.timer = window.setTimeout(() => { // press and hold: ✕ instead
      if (!p.pending) return;
      p.pending = false;
      p.value = from === MARKED ? EMPTY : MARKED;
      navigator.vibrate?.(12);
      paint(p, i);
    }, 420);
    press.current = p;
    setHinted(-1);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    if (!p) return;
    const i = cellAt(e);
    if (i < 0 || i === p.start && p.pending) return;
    const sameRow = Math.floor(i / w) === Math.floor(p.start / w), sameCol = i % w === p.start % w;
    if (!sameRow && !sameCol) return; // along one line only
    if (p.pending) { p.pending = false; clearTimeout(p.timer); paint(p, p.start); }
    const [a, b] = [Math.min(i, p.start), Math.max(i, p.start)];
    for (let k = a; k <= b; k += sameRow ? 1 : w) paint(p, k);
  };
  const up = () => {
    const p = press.current;
    press.current = null;
    if (!p) return;
    clearTimeout(p.timer);
    if (p.pending) paint(p, p.start);
    setLive(null);
    const before = history[history.length - 1];
    if (p.cells.some((v, k) => v !== before[k])) {
      setHistory((hs) => [...hs, p.cells]);
      if (won(pz, p.cells.map((v) => v === FILLED))) setSaved((s) => ({ ...s, best: { ...s.best, [s.level]: Math.min(s.best[s.level] ?? Infinity, history.length) } }));
    }
  };
  const askHint = () => {
    const wrong = cells.findIndex((v, i) => (v === FILLED) !== pz.cells[i] && (v === FILLED || pz.cells[i]));
    if (wrong < 0) return;
    setHistory((hs) => [...hs, cells.map((v, i) => (i === wrong ? (pz.cells[i] ? FILLED : MARKED) : v))]);
    setHinted(wrong);
  };

  const rowsOk = clue.rows.map((k, r) => lineOk(rowOf(filled, w, r), k));
  const colsOk = clue.cols.map((k, c) => lineOk(colOf(filled, w, c), k));
  const mr = Math.max(...clue.rows.map((k) => Math.max(1, k.length))), mc = Math.max(...clue.cols.map((k) => Math.max(1, k.length)));
  const s = `min(100cqw / ${w + mr * 0.62 + 0.4}, 100cqh / ${h + mc * 0.62 + 0.4}, 3.4rem)`;
  const steps = history.length - 1;

  return (
    <div className="flex h-full flex-col items-center gap-3 px-3 py-3">
      <div className="flex w-full max-w-md items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="w-fit rounded-full bg-black/25 px-3 py-1 text-sm font-semibold">{levelLabel(saved.level)}</span>
          <span className="mt-1 pl-1 text-xs text-white/70">{w} × {h} · {t('Moves: {n}', { n: steps })}</span>
        </div>
        <div className="flex gap-2">
          <ToolButton label={t('Undo')} onClick={() => { setHistory((hs) => hs.slice(0, -1)); setHinted(-1); }} disabled={steps < 1 || done}><Undo2 className="size-4" /></ToolButton>
          <ToolButton label={t('Start again')} onClick={reset} disabled={steps < 1}><RotateCcw className="size-4" /></ToolButton>
          <ToolButton label={t('Hint')} onClick={askHint} disabled={done}><Lightbulb className="size-4" />{t('Hint')}</ToolButton>
        </div>
      </div>

      <p className="min-h-5 text-center text-sm text-white/85" role="status">
        {done ? t('It’s a picture of: {name}!', { name: t(pz.name) })
          : hinted >= 0 ? t('One square put right for you.')
          : mode === 'mark' ? t('Tap squares you know are empty to mark them ✕.')
          : t('Tap to fill. Press and hold to mark ✕.')}
      </p>

      <div className="relative min-h-0 w-full flex-1" style={{ containerType: 'size' }}>
        <div className="absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 select-none"
          style={{ ['--s' as string]: s, gridTemplateColumns: `calc(var(--s) * ${mr * 0.62}) calc(var(--s) * ${w})`, gridTemplateRows: `calc(var(--s) * ${mc * 0.62}) calc(var(--s) * ${h})` }}>
          <span />
          <div className="grid items-end" style={{ gridTemplateColumns: `repeat(${w}, 1fr)` }} aria-label={t('Column clues')} role="list">
            {clue.cols.map((k, c) => (
              <span key={c} role="listitem" className={cn('flex flex-col items-center pb-1 font-bold leading-[1.15] transition-opacity', colsOk[c] ? 'text-white/35' : 'text-white')}
                style={{ fontSize: 'max(0.62rem, calc(var(--s) * 0.48))' }}>
                {(k.length ? k : [0]).map((x, j) => <span key={j}>{x}</span>)}
              </span>
            ))}
          </div>
          <div className="grid" style={{ gridTemplateRows: `repeat(${h}, 1fr)` }} aria-label={t('Row clues')} role="list">
            {clue.rows.map((k, r) => (
              <span key={r} role="listitem" className={cn('flex items-center justify-end gap-[0.3em] pr-1.5 font-bold transition-opacity', rowsOk[r] ? 'text-white/35' : 'text-white')}
                style={{ fontSize: 'max(0.62rem, calc(var(--s) * 0.48))' }}>
                {(k.length ? k : [0]).map((x, j) => <span key={j}>{x}</span>)}
              </span>
            ))}
          </div>
          <div ref={grid} className={cn('grid touch-none overflow-hidden rounded-md bg-slate-400 shadow-2xl ring-2 transition', done ? 'ring-white' : 'ring-slate-900/50')}
            style={{ gridTemplateColumns: `repeat(${w}, 1fr)` }} role="group" aria-label={t('Picture grid')}
            data-solution={testMode() ? pz.cells.map(Number).join('') : undefined}
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onContextMenu={(e) => e.preventDefault()}>
            {cells.map((v, i) => {
              const r = Math.floor(i / w), c = i % w;
              return (
                <button key={i} type="button" tabIndex={-1} aria-label={`${t('Row {r}, column {c}', { r: r + 1, c: c + 1 })}: ${t(STATES[v])}`}
                  className={cn('grid place-items-center transition-colors duration-300', hinted === i && 'animate-pulse')}
                  style={{
                    background: done ? (v === FILLED ? pz.colour : '#fff') : v === FILLED ? '#1e293b' : '#f8fafc',
                    transitionDelay: done ? `${(r + c) * 25}ms` : undefined,
                    borderRight: c < w - 1 ? `${c % 5 === 4 ? 2 : 1}px solid ${done ? 'transparent' : '#94a3b8'}` : undefined,
                    borderBottom: r < h - 1 ? `${r % 5 === 4 ? 2 : 1}px solid ${done ? 'transparent' : '#94a3b8'}` : undefined,
                  }}>
                  {v === MARKED && !done && <X className="size-[60%] text-slate-400" strokeWidth={2.5} />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex rounded-full bg-black/30 p-1" role="group" aria-label={t('What a tap does')}>
        {(['fill', 'mark'] as const).map((m) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}
            className={cn('flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition', mode === m ? 'bg-white text-slate-900 shadow' : 'text-white/80 hover:text-white')}>
            {m === 'fill' ? <Square className="size-4 fill-current" /> : <X className="size-4" strokeWidth={3} />}
            {m === 'fill' ? t('Fill') : t('Mark')}
          </button>
        ))}
      </div>

      {show && (
        <ResultCard emoji="🖼️" title={t('Level {n} done!', { n: saved.level })} primary={{ label: t('Next level'), onClick: () => setSaved((s) => ({ ...s, level: s.level + 1 })) }}
          secondary={{ label: t('Play again'), onClick: reset }}>
          {t('It’s a picture of: {name}!', { name: t(pz.name) })}
        </ResultCard>
      )}
    </div>
  );
}
