// Metro Lines: the map (SVG), drawn from the simulation in logic.ts, which moves on in fixed steps
// each animation frame. Drag station to station to build; drag a line's round end to stretch it.
import { useEffect, useReducer, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { FastForward, Pause, Play, Plus, TrainFront, Trash2, Users } from 'lucide-react';
import { cn } from '@sanga/ui/utils';
import { t, tk, tn } from '@sanga/i18n';
import { newSeed, ResultCard, testMode, ToolButton, useSaved } from '../../kit';
import {
  CROWD, DT, H, W, addTrain, extendLine, gifts, chooseGift, lineOf, linesLeft, newGame, newLine, removeLine, station, step, trainAt,
  trainsLeft, tunnelsUsed, type BuildError, type Gift, type Metro, type Shape,
} from './logic';

const COLOURS = ['#ef4444', '#3b82f6', '#22c55e', '#facc15', '#a855f7', '#f97316', '#ec4899'];
const COLOUR_NAMES = [tk('red'), tk('blue'), tk('green'), tk('yellow'), tk('purple'), tk('orange'), tk('pink')];
const SHAPE_NAMES = [tk('circle'), tk('triangle'), tk('square'), tk('star'), tk('diamond')];
const GIFT_TEXT: Record<Gift, { title: string; text: string; icon: string }> = {
  line: { title: tk('New line'), text: tk('One more line, with a train'), icon: '🛤️' },
  train: { title: tk('New train'), text: tk('Add it to any line'), icon: '🚆' },
  tunnel: { title: tk('Two tunnels'), text: tk('Cross the river twice more'), icon: '🌉' },
};

/** A passenger or station shape, as a path centred on (x, y). */
function shapePath(s: Shape, x: number, y: number, r: number) {
  const poly = (ps: [number, number][]) => 'M' + ps.map(([a, b]) => `${(x + a).toFixed(1)},${(y + b).toFixed(1)}`).join('L') + 'Z';
  const ring = (n: number, rad: (i: number) => number, rot = -Math.PI / 2) =>
    poly(Array.from({ length: n }, (_, i) => [Math.cos(rot + (i * 2 * Math.PI) / n) * rad(i), Math.sin(rot + (i * 2 * Math.PI) / n) * rad(i)]));
  if (s === 0) return `M${x - r},${y}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0`;
  if (s === 1) return ring(3, () => r * 1.3);
  if (s === 2) return poly([[-r * 0.9, -r * 0.9], [r * 0.9, -r * 0.9], [r * 0.9, r * 0.9], [-r * 0.9, r * 0.9]]);
  if (s === 3) return ring(10, (i) => (i % 2 ? r * 0.6 : r * 1.35));
  return poly([[0, -r * 1.3], [r * 1.05, 0], [0, r * 1.3], [-r * 1.05, 0]]);
}

type Drag = { line: number | null; start: number; end: 'head' | 'tail' };

export default function MetroLines() {
  const [saved, setSaved] = useSaved('metro', { best: 0 });
  const game = useRef<Metro | null>(null);
  const [, redraw] = useReducer((x: number) => x + 1, 0);
  const [run, setRun] = useState(0);            // a new game each time
  const [paused, setPaused] = useState(false);
  const [fast, setFast] = useState(false);
  const [picked, setPicked] = useState<number | null>(null); // a line, from the chips below
  const [flash, setFlash] = useState<string | null>(null);
  const [ptr, setPtr] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<Drag | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const settings = useRef({ paused, fast });
  settings.current = { paused, fast };
  const m = game.current;

  // the clock: fixed steps from elapsed time, each animation frame
  useEffect(() => {
    if (!run) return;
    const cap = testMode() ? 900 : 0.25; // tests fast-forward the page clock by minutes at once
    let last = performance.now(), acc = 0, raf = 0;
    const frame = () => {
      const now = performance.now(), g = game.current;
      if (!g) return;
      const el = Math.min(cap, Math.max(0, (now - last) / 1000)); last = now;
      if (!settings.current.paused && g.phase === 'play') {
        acc += el * (settings.current.fast ? 2 : 1);
        let n = 0;
        while (acc >= DT && g.phase === 'play') { step(g, DT); acc -= DT; n++; }
        if (g.phase !== 'play') { acc = 0; drag.current = null; setPtr(null); }
        if (n) redraw();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const hide = () => { if (document.hidden) setPaused(true); };
    document.addEventListener('visibilitychange', hide);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', hide); };
  }, [run]);

  useEffect(() => { if (m?.phase === 'over' && m.score > saved.best) setSaved({ best: m.score }); }, [m?.phase, m?.score, saved.best, setSaved]);
  useEffect(() => { if (!flash) return; const id = setTimeout(() => setFlash(null), 2200); return () => clearTimeout(id); }, [flash]);

  const start = () => { game.current = newGame(newSeed()); setRun((r) => r + 1); setPaused(false); setPicked(null); redraw(); };
  const say = (e: BuildError | 'ok') => {
    if (e === 'tunnel') setFlash(t('No tunnels left to cross the river.'));
    else if (e === 'lines') setFlash(t('No lines left. Remove one, or wait for next week.'));
  };

  // --- drawing lines ---
  const toMap = (e: RPointerEvent) => {
    const el = svg.current!, p = el.createSVGPoint();
    p.x = e.clientX; p.y = e.clientY;
    const q = p.matrixTransform(el.getScreenCTM()!.inverse());
    return { x: q.x, y: q.y };
  };
  const stationNear = (g: Metro, p: { x: number; y: number }, r: number) => {
    let best: number | null = null, bd = r;
    for (const s of g.stations) { const d = Math.hypot(s.x - p.x, s.y - p.y); if (d < bd) { bd = d; best = s.id; } }
    return best;
  };
  const handles = (g: Metro) => g.lines.flatMap((l) => (['head', 'tail'] as const).map((end) => {
    const [a, b] = end === 'tail' ? [l.stops[l.stops.length - 1], l.stops[l.stops.length - 2]] : [l.stops[0], l.stops[1]];
    const A = station(g, a), B = station(g, b), d = Math.hypot(A.x - B.x, A.y - B.y) || 1;
    return { line: l.id, end, at: a, x: A.x + ((A.x - B.x) / d) * 24, y: A.y + ((A.y - B.y) / d) * 24, colour: l.colour };
  }));
  const down = (e: RPointerEvent<SVGSVGElement>) => {
    const g = game.current;
    if (!g || g.phase !== 'play') return;
    const p = toMap(e);
    const centre = stationNear(g, p, 12);
    const h = centre === null ? handles(g).find((x) => Math.hypot(x.x - p.x, x.y - p.y) < 17) : undefined;
    const s = centre ?? stationNear(g, p, 26);
    if (h) drag.current = { line: h.line, start: h.at, end: h.end };
    else if (s !== null) drag.current = { line: null, start: s, end: 'tail' };
    else return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setPtr(p);
  };
  const move = (e: RPointerEvent<SVGSVGElement>) => {
    const g = game.current, d = drag.current;
    if (!g || !d) return;
    const p = toMap(e);
    setPtr(p);
    const s = stationNear(g, p, 22);
    if (s === null) return;
    if (d.line === null) {
      if (s === d.start) return;
      const res = newLine(g, d.start, s);
      if (typeof res === 'object' && res) { d.line = res.id; d.end = 'tail'; setPicked(null); redraw(); } else { say(res); drag.current = null; }
    } else {
      const l = lineOf(g, d.line);
      if (!l || l.stops.includes(s)) return;
      const res = extendLine(g, d.line, d.end, s);
      if (res === 'ok') redraw(); else { say(res); drag.current = null; }
    }
  };
  const up = () => { drag.current = null; setPtr(null); };

  // --- what to show ---
  const d = drag.current;
  const dragFrom = m && d ? (d.line === null ? station(m, d.start) : (() => { const l = lineOf(m, d.line!)!; return station(m, d.end === 'tail' ? l.stops[l.stops.length - 1] : l.stops[0]); })()) : null;
  const crowded = m?.stations.some((s) => s.over > 0);
  const status = !m ? t('Build a metro and keep the city moving.')
    : flash ? flash
    : d ? t('Pass over stations to add them, then let go.')
    : !m.lines.length ? t('Drag from one station to another to build a line.')
    : crowded ? t('A station is overflowing! Put it on a line, or add a train.')
    : picked !== null ? t('Add a train to this line, or remove it.')
    : t('Drag a line’s round end to stretch it to more stations.');
  const sel = picked !== null && m ? lineOf(m, picked) : undefined;
  const test = testMode() && m ? { 'data-score': m.score, 'data-week': m.week + 1, 'data-stations': m.stations.length } : {};

  return (
    <div className="flex h-full flex-col items-center px-2 pb-2" data-state={m ? m.phase : 'start'} {...test}>
      <div className="flex w-full max-w-md items-center justify-between gap-2 py-1.5">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1 text-sm font-bold tabular-nums" aria-label={t('Delivered: {n}', { n: m?.score ?? 0 })}>
            <Users className="size-4" aria-hidden />{m?.score ?? 0}
          </span>
          {m && <span className="rounded-full bg-black/20 px-3 py-1 text-sm font-semibold">{t('Week {n}', { n: m.week + 1 })}</span>}
        </div>
        {m && (
          <div className="flex gap-2">
            <ToolButton label={paused ? t('Play') : t('Pause')} onClick={() => setPaused((p) => !p)} disabled={m.phase !== 'play'}>
              {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
            </ToolButton>
            <ToolButton label={fast ? t('Normal speed') : t('Double speed')} onClick={() => setFast((f) => !f)}>
              <FastForward className={cn('size-4', fast && 'fill-current')} />{fast ? '2×' : '1×'}
            </ToolButton>
          </div>
        )}
      </div>

      <p className="min-h-5 w-full max-w-md text-center text-sm leading-tight text-white/85" role="status">{paused && m?.phase === 'play' ? t('Paused') : status}</p>

      <div className="relative mt-1 min-h-0 w-full max-w-md flex-1">
        <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full touch-none select-none" role="group" aria-label={t('City map')}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <rect x="0" y="0" width={W} height={H} rx="18" fill="#0d1526" stroke="rgba(255,255,255,0.08)" />
          <defs>
            <pattern id="metro-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="rgba(255,255,255,0.035)" /></pattern>
          </defs>
          <rect x="0" y="0" width={W} height={H} rx="18" fill="url(#metro-grid)" />
          {m && (
            <>
              <polyline points={m.river.map((p) => p.join(',')).join(' ')} fill="none" stroke="#1d4ed8" strokeOpacity="0.35" strokeWidth="30" strokeLinejoin="round" strokeLinecap="round" />
              <polyline points={m.river.map((p) => p.join(',')).join(' ')} fill="none" stroke="#60a5fa" strokeOpacity="0.18" strokeWidth="12" strokeLinejoin="round" strokeLinecap="round" />
              {m.lines.map((l) => (
                <polyline key={l.id} points={l.stops.map((id) => { const s = station(m, id); return `${s.x},${s.y}`; }).join(' ')} fill="none"
                  stroke={COLOURS[l.colour]} strokeWidth={picked === l.id ? 9 : 7} strokeLinejoin="round" strokeLinecap="round" opacity={picked !== null && picked !== l.id ? 0.45 : 1} />
              ))}
              {handles(m).map((h) => {
                const s = station(m, h.at);
                return (
                  <g key={`${h.line}-${h.end}`} role="button" aria-label={t('End of the {colour} line', { colour: t(COLOUR_NAMES[h.colour]) })} data-x={h.x} data-y={h.y}>
                    <line x1={s.x} y1={s.y} x2={h.x} y2={h.y} stroke={COLOURS[h.colour]} strokeWidth="7" strokeLinecap="round" />
                    <circle cx={h.x} cy={h.y} r="7" fill="#0d1526" stroke={COLOURS[h.colour]} strokeWidth="3.5" />
                  </g>
                );
              })}
              {dragFrom && ptr && <line x1={dragFrom.x} y1={dragFrom.y} x2={ptr.x} y2={ptr.y} stroke="white" strokeOpacity="0.6" strokeWidth="4" strokeDasharray="6 7" strokeLinecap="round" />}
              {m.trains.map((tr) => {
                const p = trainAt(m, tr), l = lineOf(m, tr.line)!;
                return (
                  <g key={tr.id} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${((p.angle * 180) / Math.PI).toFixed(1)})`}>
                    <rect x="-13" y="-7.5" width="26" height="15" rx="4" fill={COLOURS[l.colour]} stroke="#0d1526" strokeWidth="1.5" />
                    {tr.load.map((w, i) => <path key={i} d={shapePath(w, -8 + (i % 3) * 8, -3.2 + Math.floor(i / 3) * 6.4, 2.2)} fill="white" />)}
                  </g>
                );
              })}
              {m.stations.map((s, i) => {
                const left = s.x > W - 80;
                return (
                  <g key={s.id} role="button" aria-label={t('Station {n}, {shape}', { n: i + 1, shape: t(SHAPE_NAMES[s.shape]) })} data-x={s.x} data-y={s.y} data-waiting={s.waiting.length}>
                    {s.over > 0 && (
                      <>
                        <circle cx={s.x} cy={s.y} r="21" fill="#f43f5e" fillOpacity={0.12 + s.over * 0.2} />
                        <circle cx={s.x} cy={s.y} r="21" fill="none" stroke="#fb7185" strokeWidth="4" pathLength="100" strokeDasharray={`${(s.over * 100).toFixed(1)} 100`}
                          transform={`rotate(-90 ${s.x} ${s.y})`} strokeLinecap="round" />
                      </>
                    )}
                    <path d={shapePath(s.shape, s.x, s.y, 9)} fill="#0d1526" stroke="white" strokeWidth="3.5" strokeLinejoin="round" />
                    {s.waiting.slice(0, 12).map((w, k) => (
                      <path key={k} d={shapePath(w, s.x + (left ? -1 : 1) * (19 + (k % 6) * 8.5), s.y - 5 + Math.floor(k / 6) * 9, 3)}
                        fill={k >= CROWD ? '#fda4af' : 'rgba(255,255,255,0.85)'} />
                    ))}
                    {s.waiting.length > 12 && <text x={s.x + (left ? -19 : 19)} y={s.y + 20} fontSize="9" fill="#fda4af" textAnchor={left ? 'end' : 'start'}>+{s.waiting.length - 12}</text>}
                  </g>
                );
              })}
            </>
          )}
        </svg>
      </div>

      {m && (
        <div className="mt-2 flex w-full max-w-md items-center justify-between gap-2">
          <div className="flex items-center gap-1.5" role="group" aria-label={t('Lines')}>
            {Array.from({ length: m.maxLines }, (_, i) => {
              const l = m.lines[i];
              if (!l) return <span key={i} className="size-8 rounded-full border-2 border-dashed border-white/30" aria-hidden />;
              return (
                <button key={l.id} type="button" aria-pressed={picked === l.id} aria-label={t('The {colour} line', { colour: t(COLOUR_NAMES[l.colour]) })}
                  onClick={() => setPicked((p) => (p === l.id ? null : l.id))}
                  className={cn('size-8 rounded-full border-[3px] transition', picked === l.id ? 'scale-110 border-white' : 'border-transparent')} style={{ background: COLOURS[l.colour] }} />
              );
            })}
          </div>
          {sel ? (
            <div className="flex gap-1.5">
              <ToolButton label={t('Add a train')} onClick={() => { addTrain(m, sel.id); redraw(); }} disabled={trainsLeft(m) <= 0}><Plus className="size-4" /><TrainFront className="size-4" /></ToolButton>
              <ToolButton label={t('Remove line')} onClick={() => { removeLine(m, sel.id); setPicked(null); redraw(); }}><Trash2 className="size-4" /></ToolButton>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-sm font-semibold">
              <span className="flex items-center gap-1" aria-label={t('Spare trains: {n}', { n: trainsLeft(m) })} title={t('Spare trains: {n}', { n: trainsLeft(m) })}>
                <TrainFront className="size-4" aria-hidden />{trainsLeft(m)}
              </span>
              <span className="flex items-center gap-1" aria-label={t('Tunnels left: {n}', { n: m.tunnels - tunnelsUsed(m) })} title={t('Tunnels left: {n}', { n: m.tunnels - tunnelsUsed(m) })}>
                <span aria-hidden>🌉</span>{m.tunnels - tunnelsUsed(m)}
              </span>
              {linesLeft(m) > 0 && <span className="sr-only">{tn(linesLeft(m), '{n} line left', '{n} lines left')}</span>}
            </div>
          )}
        </div>
      )}

      {!m && (
        <ResultCard emoji="🚇" title={t('Build a metro')} primary={{ label: t('Play'), onClick: start }}>
          {t('Link stations of different shapes so everyone gets where they’re going.')}
          {saved.best > 0 && <div className="mt-2 font-semibold text-slate-800">{t('Best: {n} delivered', { n: saved.best })}</div>}
        </ResultCard>
      )}
      {m?.phase === 'week' && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/55 p-5 animate-fade-in" role="dialog" aria-label={t('Week {n} done!', { n: m.week + 1 })}>
          <div className="w-full max-w-xs rounded-3xl bg-white p-5 text-center text-slate-900 shadow-2xl">
            <h2 className="text-xl font-bold">{t('Week {n} done!', { n: m.week + 1 })}</h2>
            <p className="mt-1 text-sm text-slate-600">{t('Pick one to help next week:')}</p>
            <div className="mt-4 grid gap-2">
              {gifts(m).map((g) => (
                <button key={g} type="button" onClick={() => { chooseGift(m, g); redraw(); }}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-left transition hover:border-emerald-400 hover:bg-emerald-50">
                  <span className="text-2xl" aria-hidden>{GIFT_TEXT[g].icon}</span>
                  <span><span className="block font-semibold">{t(GIFT_TEXT[g].title)}</span><span className="block text-xs text-slate-500">{t(GIFT_TEXT[g].text)}</span></span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {m?.phase === 'over' && (
        <ResultCard emoji="🚉" title={t('Game over')} primary={{ label: t('Play again'), onClick: start }}>
          {t('A station was crowded for too long.')}
          <div className="mt-2 text-base font-semibold text-slate-800">{tn(m.score, '{n} passenger delivered', '{n} passengers delivered')}</div>
          <div>{m.score >= saved.best && m.score > 0 ? t('Your best yet!') : t('Best: {n} delivered', { n: saved.best })}</div>
        </ResultCard>
      )}
    </div>
  );
}


