// Colour Pour: the tubes, tap one then another to pour. Undo, restart, hint; levels get harder and
// the level you're on is kept on this device.
import { useMemo, useState } from 'react';
import { Lightbulb, RotateCcw, Undo2 } from 'lucide-react';
import { cn } from '@sanga/ui/utils';
import { t, tk } from '@sanga/i18n';
import { levelLabel, newSeed, ResultCard, ToolButton, useSaved } from '../../kit';
import { CAP, canPour, makeLevel, pour, solve, won, type Tubes } from './logic';

const COLOURS = ['#ef4444', '#3b82f6', '#22c55e', '#facc15', '#a855f7', '#f97316', '#ec4899', '#14b8a6', '#92400e', '#94a3b8'];
const NAMES = [tk('red'), tk('blue'), tk('green'), tk('yellow'), tk('purple'), tk('orange'), tk('pink'), tk('teal'), tk('brown'), tk('grey')];

export default function ColourPour() {
  const [saved, setSaved] = useSaved('watersort', { level: 1, seed: 0 });
  const seed = useMemo(() => saved.seed || newSeed(), [saved.seed]);
  const start = useMemo(() => makeLevel(saved.level, seed), [saved.level, seed]);
  const [history, setHistory] = useState<Tubes[]>([start]);
  const [picked, setPicked] = useState<number | null>(null);
  const [hint, setHint] = useState<[number, number] | null>(null);
  const [stuck, setStuck] = useState(false);
  const tubes = history[history.length - 1];
  const finished = won(tubes);

  const reset = (tb: Tubes) => { setHistory([tb]); setPicked(null); setHint(null); setStuck(false); };
  if (history[0] !== start) reset(start); // a new level

  const tap = (i: number) => {
    if (finished) return;
    setHint(null); setStuck(false);
    if (picked === null) { if (tubes[i].length) setPicked(i); return; }
    if (picked === i) { setPicked(null); return; }
    if (canPour(tubes, picked, i)) { setHistory((h) => [...h, pour(tubes, picked, i)]); setPicked(null); }
    else setPicked(tubes[i].length ? i : null);
  };
  const askHint = () => {
    const path = solve(tubes);
    if (path?.length) { setHint(path[0]); setPicked(null); } else setStuck(true);
  };
  const next = () => setSaved({ level: saved.level + 1, seed: 0 });
  const label = (i: number) => {
    const tb = tubes[i];
    const what = tb.length ? tb.map((c) => t(NAMES[c])).join(', ') : t('empty');
    return t('Tube {n}: {what}', { n: i + 1, what }) + (picked === i ? ` (${t('picked up')})` : '');
  };
  const cols = tubes.length > 8 ? Math.ceil(tubes.length / 2) : tubes.length;

  return (
    <div className="flex h-full flex-col items-center gap-4 px-3 py-3">
      <div className="flex w-full max-w-md items-center justify-between">
        <span className="rounded-full bg-black/25 px-3 py-1 text-sm font-semibold">{levelLabel(saved.level)}</span>
        <div className="flex gap-2">
          <ToolButton label={t('Undo')} onClick={() => { setHistory((h) => h.slice(0, -1)); setPicked(null); setHint(null); }} disabled={history.length < 2 || finished}><Undo2 className="size-4" /></ToolButton>
          <ToolButton label={t('Start again')} onClick={() => reset(start)} disabled={history.length < 2}><RotateCcw className="size-4" /></ToolButton>
          <ToolButton label={t('Hint')} onClick={askHint} disabled={finished}><Lightbulb className="size-4" />{t('Hint')}</ToolButton>
        </div>
      </div>

      <p className="min-h-6 text-center text-sm text-white/85" role="status">
        {stuck ? t('No way to finish from here. Undo or start again.')
          : hint ? t('Pour tube {a} into tube {b}.', { a: hint[0] + 1, b: hint[1] + 1 })
          : picked !== null ? t('Now tap where to pour.') : t('Tap a tube to pick it up.')}
      </p>

      <div className="grid flex-1 content-center gap-x-3 gap-y-8" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 3.25rem))` }} role="group" aria-label={t('Tubes')}>
        {tubes.map((tb, i) => (
          <button key={i} type="button" onClick={() => tap(i)} aria-label={label(i)} aria-pressed={picked === i}
            className={cn('relative flex h-44 w-full flex-col-reverse overflow-hidden rounded-b-[1.6rem] rounded-t-lg border-2 border-white/60 bg-white/10 p-1 transition',
              picked === i && '-translate-y-4 border-white shadow-[0_0_0_3px_rgba(255,255,255,0.35)]',
              hint && (hint[0] === i || hint[1] === i) && 'border-amber-300 shadow-[0_0_0_3px_rgba(252,211,77,0.6)]',
              tb.length === CAP && tb.every((c) => c === tb[0]) && 'border-emerald-300')}>
            {tb.map((c, k) => (
              <span key={k} className={cn('w-full shrink-0 transition-all', k === 0 && 'rounded-b-[1.2rem]')} style={{ height: `${100 / CAP}%`, background: COLOURS[c] }} />
            ))}
          </button>
        ))}
      </div>

      {finished && (
        <ResultCard emoji="🎉" title={t('Level {n} done!', { n: saved.level })} primary={{ label: t('Next level'), onClick: next }}
          secondary={{ label: t('Play again'), onClick: () => reset(start) }}>
          {t('In {n} pours.', { n: history.length - 1 })}
        </ResultCard>
      )}
    </div>
  );
}
