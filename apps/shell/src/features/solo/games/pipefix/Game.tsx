// Pipe Fix: tap a piece to turn it; the water runs from the tap as far as the pipes meet, and the
// flowers at the ends bloom when it gets there. Undo, start again, a hint; the level is kept on this device.
import { useEffect, useMemo, useState } from 'react';
import { Lightbulb, RotateCcw, Undo2 } from 'lucide-react';
import { cn } from '@sanga/ui/utils';
import { t } from '@sanga/i18n';
import { levelLabel, newSeed, ResultCard, testMode, ToolButton, useSaved } from '../../kit';
import { DOWN, LEFT, RIGHT, UP, flow, makeLevel, needed, step } from './logic';

const ENDS: [number, number, number][] = [[UP, 50, 0], [RIGHT, 100, 50], [DOWN, 50, 100], [LEFT, 0, 50]];
const bits = (m: number) => ENDS.filter(([d]) => m & d).length;

/** One piece, drawn the answer's way round; the button turns it. */
function Pipe({ mask, wet, delay, source }: { mask: number; wet: boolean; delay: number; source: boolean }) {
  const colour = wet ? '#38bdf8' : '#94a3b8';
  const style = { transition: `stroke 0.25s ${delay}ms, fill 0.25s ${delay}ms` };
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
      {ENDS.filter(([d]) => mask & d).map(([d, x, y]) => <line key={d} x1={50} y1={50} x2={x} y2={y} stroke="#0f172a" strokeOpacity={0.55} strokeWidth={30} strokeLinecap={source || bits(mask) === 1 ? 'round' : 'square'} />)}
      {ENDS.filter(([d]) => mask & d).map(([d, x, y]) => <line key={d} x1={50} y1={50} x2={x} y2={y} stroke={colour} strokeWidth={20} strokeLinecap="round" style={style} />)}
      {bits(mask) > 2 && <circle cx={50} cy={50} r={14} fill={colour} style={style} />}
    </svg>
  );
}

export default function PipeFix() {
  const [saved, setSaved] = useSaved('pipefix', { level: 1, best: {} as Record<string, number> });
  const seed = useMemo(() => newSeed(), []);
  const lv = useMemo(() => makeLevel(saved.level, seed), [saved.level, seed]);
  const [history, setHistory] = useState<number[][]>([lv.start]);
  const [hinted, setHinted] = useState(-1);
  const [show, setShow] = useState(false);
  const turns = history[history.length - 1];
  const dist = flow(lv, turns);
  const done = dist.every((d) => d >= 0);
  const taps = history.length - 1;

  const reset = () => { setHistory([lv.start]); setHinted(-1); setShow(false); };
  if (history[0] !== lv.start) reset(); // a new level

  useEffect(() => {
    if (!done) return;
    setSaved((s) => ({ ...s, best: { ...s.best, [s.level]: Math.min(s.best[s.level] ?? Infinity, taps) } }));
    const id = setTimeout(() => setShow(true), 300 + Math.max(...dist) * 40);
    return () => clearTimeout(id);
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  const tap = (i: number, k = 1) => { if (!done) { setHistory((h) => [...h, turns.map((x, j) => (j === i ? x + k : x))]); setHinted(-1); } };
  const askHint = () => {
    const wrong = turns.map((_, i) => i).filter((i) => needed(lv, turns, i) > 0);
    const byWater = wrong.find((i) => [UP, RIGHT, DOWN, LEFT].some((d) => { const j = step(lv.w, lv.h, i, d); return j >= 0 && dist[j] >= 0; }));
    const i = byWater ?? wrong[0];
    if (i === undefined) return;
    tap(i, needed(lv, turns, i));
    setHinted(i);
  };
  const best = saved.best[saved.level];

  return (
    <div className="flex h-full flex-col items-center gap-3 px-3 py-3">
      <div className="flex w-full max-w-md items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="w-fit rounded-full bg-black/25 px-3 py-1 text-sm font-semibold">{levelLabel(saved.level)}</span>
          <span className="mt-1 pl-1 text-xs text-white/70">{t('Moves: {n}', { n: taps })}{best !== undefined && ` · ${t('Best: {n}', { n: best })}`}</span>
        </div>
        <div className="flex gap-2">
          <ToolButton label={t('Undo')} onClick={() => { setHistory((h) => h.slice(0, -1)); setHinted(-1); }} disabled={taps < 1 || done}><Undo2 className="size-4" /></ToolButton>
          <ToolButton label={t('Start again')} onClick={reset} disabled={taps < 1}><RotateCcw className="size-4" /></ToolButton>
          <ToolButton label={t('Hint')} onClick={askHint} disabled={done}><Lightbulb className="size-4" />{t('Hint')}</ToolButton>
        </div>
      </div>

      <p className="min-h-5 text-center text-sm text-white/85" role="status">
        {done ? t('The water reaches every pipe!')
          : hinted >= 0 ? t('That pipe is the right way round now.')
          : t('Tap pipes to turn them. Water reaches {n} of {all}.', { n: dist.filter((d) => d >= 0).length, all: dist.length })}
      </p>

      <div className="relative min-h-0 w-full flex-1" style={{ containerType: 'size' }}>
        <div className={cn('absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 gap-1 rounded-3xl bg-black/30 p-2 shadow-2xl ring-1 ring-white/10 transition', done && 'ring-4 ring-sky-300/60')}
          style={{ width: `min(100cqw - 0.5rem, (100cqh - 1rem) * ${lv.w / lv.h} + 1rem, ${lv.w * 4.75}rem)`, gridTemplateColumns: `repeat(${lv.w}, 1fr)` }}
          role="group" aria-label={t('Pipes')}>
          {lv.pipes.map((mask, i) => {
            const source = i === lv.source, outlet = !source && bits(mask) === 1, wet = dist[i] >= 0;
            const kind = source ? t('Tap') : outlet ? t('Flower') : t('Pipe');
            return (
              <button key={i} type="button" onClick={() => tap(i)} data-need={testMode() ? needed(lv, turns, i) : undefined}
                aria-label={`${kind}: ${t('Row {r}, column {c}', { r: Math.floor(i / lv.w) + 1, c: (i % lv.w) + 1 })}${wet ? `, ${t('water reaches it')}` : ''}`}
                className={cn('relative aspect-square overflow-hidden rounded-lg transition-colors active:scale-95', wet ? 'bg-sky-300/15' : 'bg-white/[0.07]', hinted === i && 'ring-2 ring-amber-300')}>
                <span className="absolute inset-0 transition-transform duration-200 ease-out" style={{ transform: `rotate(${turns[i] * 90}deg)` }}>
                  <Pipe mask={mask} wet={wet} delay={Math.max(0, dist[i]) * 40} source={source} />
                </span>
                {(source || outlet) && (
                  <span className={cn('absolute inset-[22%] grid place-items-center rounded-full leading-none shadow-md transition-all duration-300', source ? 'bg-sky-500' : wet ? 'scale-110 bg-pink-200' : 'bg-slate-300')}
                    style={{ transitionDelay: `${Math.max(0, dist[i]) * 40}ms`, fontSize: `calc(min(100cqw, 100cqh * ${lv.w / lv.h}, ${lv.w * 4.75}rem) / ${lv.w} * 0.3)` }} aria-hidden>
                    {source ? '💧' : wet ? '🌸' : '🌱'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {show && (
        <ResultCard emoji="🌸" title={t('Level {n} done!', { n: saved.level })} primary={{ label: t('Next level'), onClick: () => setSaved((s) => ({ ...s, level: s.level + 1 })) }}
          secondary={{ label: t('Play again'), onClick: reset }}>
          {t('In {n} moves.', { n: taps })}
        </ResultCard>
      )}
    </div>
  );
}
