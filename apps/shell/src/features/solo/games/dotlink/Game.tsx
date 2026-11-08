// Dot Link: drag from a dot to its twin (or tap square by square), fill every square. Undo, start
// again, a hint that draws one path; the level and the fewest moves are kept on this device.
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { Lightbulb, RotateCcw, Undo2 } from 'lucide-react';
import { cn } from '@sanga/ui/utils';
import { t, tk } from '@sanga/i18n';
import { levelLabel, newSeed, ResultCard, testMode, ToolButton, useSaved } from '../../kit';
import { begin, dotAt, extend, hint, joined, makeLevel, pathAt, won, type Paths } from './logic';

const COLOURS = ['#ef4444', '#3b82f6', '#22c55e', '#facc15', '#f97316', '#14b8a6', '#ec4899', '#a855f7', '#a16207', '#94a3b8'];
const NAMES = [tk('red'), tk('blue'), tk('green'), tk('yellow'), tk('orange'), tk('teal'), tk('pink'), tk('purple'), tk('brown'), tk('grey')];

export default function DotLink() {
  const [saved, setSaved] = useSaved('dotlink', { level: 1, best: {} as Record<string, number> });
  const seed = useMemo(() => newSeed(), []);
  const pz = useMemo(() => makeLevel(saved.level, seed), [saved.level, seed]);
  const { n } = pz;
  const empty = useMemo(() => pz.solution.map(() => [] as number[]), [pz]);
  const [paths, setPathsState] = useState<Paths>(empty);
  const [undo, setUndo] = useState<Paths[]>([]);
  const [moves, setMoves] = useState(0);
  const [shown, setShown] = useState(-1); // the colour a hint just drew
  const live = useRef(paths);
  const stroke = useRef<{ c: number; before: Paths; last: number } | null>(null);
  const lastColour = useRef(-1);
  const board = useRef<HTMLDivElement>(null);
  const [forPz, setForPz] = useState(pz);
  const setPaths = (p: Paths) => { live.current = p; setPathsState(p); };
  const [card, setCard] = useState(false);
  const reset = () => { setPaths(empty); setUndo([]); setMoves(0); setShown(-1); setCard(false); lastColour.current = -1; };
  if (forPz !== pz) { setForPz(pz); reset(); } // a new level

  const done = won(pz, paths);
  useEffect(() => { // a moment to see the full board before the card
    if (!done) return;
    const id = setTimeout(() => setCard(true), 700);
    return () => clearTimeout(id);
  }, [done]);
  const allJoined = paths.every((p, c) => joined(pz, p, c));
  const filled = paths.reduce((s, p) => s + p.length, 0);

  const cellAt = (e: PointerEvent) => {
    const r = board.current!.getBoundingClientRect();
    const col = Math.floor(((e.clientX - r.left) / r.width) * n), row = Math.floor(((e.clientY - r.top) / r.height) * n);
    return col < 0 || row < 0 || col >= n || row >= n ? -1 : row * n + col;
  };
  /** Towards a square the pointer jumped to, one neighbour at a time. */
  const reach = (p: Paths, c: number, target: number) => {
    for (let k = 0; k < 2 * n; k++) {
      const end = p[c][p[c].length - 1];
      if (end === undefined || end === target) break;
      const dr = Math.sign(Math.floor(target / n) - Math.floor(end / n)), dc = Math.sign((target % n) - (end % n));
      const step = dc && (!dr || Math.abs((target % n) - (end % n)) >= Math.abs(Math.floor(target / n) - Math.floor(end / n))) ? end + dc : end + dr * n;
      const q = extend(pz, p, c, step);
      if (q === p) break;
      p = q;
    }
    return p;
  };

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (done) return;
    const cell = cellAt(e);
    if (cell < 0) return;
    board.current!.setPointerCapture(e.pointerId);
    const before = live.current;
    const active = stroke.current?.c ?? lastColour.current;
    let p = before, c = -1;
    // tapping square by square: the next square after the colour you're drawing
    if (active >= 0 && pathAt(before, cell) < 0 && (dotAt(pz, cell) < 0 || dotAt(pz, cell) === active)) {
      const q = extend(pz, before, active, cell);
      if (q !== before) { p = q; c = active; }
    }
    if (c < 0) [p, c] = begin(pz, before, cell);
    if (c < 0) return;
    stroke.current = { c, before, last: cell };
    setShown(-1);
    setPaths(p);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const s = stroke.current;
    if (!s) return;
    const cell = cellAt(e);
    if (cell < 0 || cell === s.last) return;
    s.last = cell;
    const p = reach(live.current, s.c, cell);
    if (p !== live.current) setPaths(p);
  };
  const up = () => {
    const s = stroke.current;
    stroke.current = null;
    if (!s || live.current === s.before) return;
    setUndo((u) => [...u, s.before]);
    const m = moves + (s.c !== lastColour.current ? 1 : 0); // a move: drawing a different colour from last time
    setMoves(m);
    lastColour.current = s.c;
    if (won(pz, live.current)) setSaved((v) => ({ ...v, best: { ...v.best, [v.level]: Math.min(v.best[v.level] ?? Infinity, m) } }));
  };
  const askHint = () => {
    const [p, c] = hint(pz, live.current);
    if (c < 0) return;
    setUndo((u) => [...u, live.current]);
    setPaths(p);
    setShown(c);
    setMoves((m) => m + 1);
    lastColour.current = -1;
  };

  const owner = new Map<number, number>();
  paths.forEach((p, c) => p.forEach((x) => owner.set(x, c)));
  const centre = (x: number) => `${(x % n) + 0.5},${Math.floor(x / n) + 0.5}`;
  const label = (x: number) => {
    const where = t('Row {r}, column {c}', { r: Math.floor(x / n) + 1, c: (x % n) + 1 });
    const d = dotAt(pz, x), o = owner.get(x);
    return d >= 0 ? `${where}: ${t('{colour} dot', { colour: t(NAMES[d]) })}` : o !== undefined ? `${where}: ${t(NAMES[o])}` : `${where}: ${t('empty')}`;
  };

  return (
    <div className="flex h-full flex-col items-center gap-3 px-3 py-3">
      <div className="flex w-full max-w-md items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="w-fit rounded-full bg-black/25 px-3 py-1 text-sm font-semibold">{levelLabel(saved.level)}</span>
          <span className="mt-1 pl-1 text-xs text-white/70">{t('Moves: {n}', { n: moves })} · {t('Filled: {p}%', { p: Math.round((filled * 100) / (n * n)) })}
            {saved.best[saved.level] !== undefined && ` · ${t('Best: {n}', { n: saved.best[saved.level] })}`}</span>
        </div>
        <div className="flex gap-2">
          <ToolButton label={t('Undo')} onClick={() => { setPaths(undo[undo.length - 1]); setUndo((u) => u.slice(0, -1)); setShown(-1); }} disabled={!undo.length || done}><Undo2 className="size-4" /></ToolButton>
          <ToolButton label={t('Start again')} onClick={reset} disabled={!undo.length}><RotateCcw className="size-4" /></ToolButton>
          <ToolButton label={t('Hint')} onClick={askHint} disabled={done}><Lightbulb className="size-4" />{t('Hint')}</ToolButton>
        </div>
      </div>

      <p className="min-h-5 text-center text-sm text-white/85" role="status">
        {done ? t('Every pair joined, every square filled!')
          : shown >= 0 ? t('Here’s the {colour} path.', { colour: t(NAMES[shown]) })
          : allJoined ? t('Every pair is joined. Now fill every square.')
          : t('Drag from a dot to the other dot of its colour.')}
      </p>

      <div className="relative min-h-0 w-full flex-1" style={{ containerType: 'size' }}>
        <div className={cn('absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-slate-950/70 p-2 shadow-2xl ring-1 ring-white/10 transition', done && 'ring-4 ring-emerald-300/70')}
          style={{ width: 'min(100cqw - 0.5rem, 100cqh, 30rem)' }}>
          <div ref={board} className="relative grid aspect-square w-full touch-none select-none" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}
            role="group" aria-label={t('Board')} data-solution={testMode() ? JSON.stringify(pz.solution) : undefined}
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
            {Array.from({ length: n * n }, (_, x) => {
              const o = owner.get(x);
              return (
                <button key={x} type="button" aria-label={label(x)} tabIndex={-1}
                  className="m-[1px] rounded-md bg-white/[0.06] transition-colors duration-150"
                  style={o !== undefined ? { background: `${COLOURS[o]}${joined(pz, paths[o], o) ? '55' : '33'}` } : undefined} />
              );
            })}
            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${n} ${n}`} aria-hidden>
              {paths.map((p, c) => p.length > 1 && (
                <polyline key={c} points={p.map(centre).join(' ')} fill="none" stroke={COLOURS[c]} strokeWidth={0.3} strokeLinecap="round" strokeLinejoin="round" />
              ))}
              {pz.solution.map((s, c) => [s[0], s[s.length - 1]].map((x) => (
                <g key={x}>
                  {joined(pz, paths[c], c) && <circle cx={(x % n) + 0.5} cy={Math.floor(x / n) + 0.5} r={0.44} fill="none" stroke={COLOURS[c]} strokeOpacity={0.6} strokeWidth={0.05} />}
                  <circle cx={(x % n) + 0.5} cy={Math.floor(x / n) + 0.5} r={0.34} fill={COLOURS[c]} className={cn(shown === c && 'animate-pulse')} />
                </g>
              )))}
            </svg>
          </div>
        </div>
      </div>

      {card && (
        <ResultCard emoji="🔗" title={t('Level {n} done!', { n: saved.level })} primary={{ label: t('Next level'), onClick: () => setSaved((s) => ({ ...s, level: s.level + 1 })) }}
          secondary={{ label: t('Play again'), onClick: reset }}>
          {t('In {n} moves.', { n: moves })}
        </ResultCard>
      )}
    </div>
  );
}
