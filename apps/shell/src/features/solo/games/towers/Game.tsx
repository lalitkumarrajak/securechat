// Tower Guard: pick a map, build towers on the spots beside the path, start waves. The board is SVG,
// drawn from the battle in logic.ts, which moves on in fixed steps each animation frame.
import { useEffect, useReducer, useRef, useState } from 'react';
import { ArrowUp, Coins, FastForward, Heart, Lock, Pause, Play, Swords, X } from 'lucide-react';
import { cn } from '@sanga/ui/utils';
import { t, tk } from '@sanga/i18n';
import { ResultCard, testMode, ToolButton, useSaved } from '../../kit';
import {
  COLS, DT, KINDS, MAPS, MAX_LEVEL, ROWS, TOWERS, WAVES, along, build, newTD, pathCells, sell, sellValue, startWave, stats, step, towerAt, upgrade,
  upgradeCost, type Foe, type Kind, type TD,
} from './logic';

const S = 10; // board units per cell
const MAP_NAMES = [tk('Meadow'), tk('Canyon'), tk('Fortress')];
const MAP_LOOK = [
  { grass: ['#3f7d3a', '#447f3e'], path: '#c8a96a', edge: '#a88a50' },
  { grass: ['#9a5b34', '#a1623a'], path: '#e3c48f', edge: '#b9955c' },
  { grass: ['#4b5563', '#525b69'], path: '#a8a29e', edge: '#78716c' },
];
const TOWER_NAMES: Record<Kind, string> = { fast: tk('Dart'), splash: tk('Cannon'), slow: tk('Frost'), sniper: tk('Longshot') };
const TOWER_TIPS: Record<Kind, string> = { fast: tk('Quick shots'), splash: tk('Hits a group'), slow: tk('Slows them down'), sniper: tk('Long range, big hit') };
const TOWER_COLOURS: Record<Kind, string> = { fast: '#38bdf8', splash: '#f59e0b', slow: '#a5f3fc', sniper: '#c084fc' };
const FOE_LOOK: Record<Foe, { r: number; fill: string }> = {
  walker: { r: 0.3, fill: '#ef4444' }, runner: { r: 0.22, fill: '#fb923c' }, brute: { r: 0.4, fill: '#7c3aed' }, boss: { r: 0.48, fill: '#111827' },
};

function TowerIcon({ kind, level, aim = -Math.PI / 2 }: { kind: Kind; level: number; aim?: number }) {
  const c = TOWER_COLOURS[kind], deg = (aim * 180) / Math.PI;
  const barrel = kind === 'sniper' ? 4.6 : kind === 'splash' ? 3 : 3.4;
  return (
    <g>
      <rect x={-4.2} y={-4.2} width={8.4} height={8.4} rx={2} fill="#1f2937" stroke="rgba(0,0,0,0.35)" strokeWidth={0.6} />
      <g transform={`rotate(${deg.toFixed(0)})`}>
        <rect x={0} y={kind === 'splash' ? -1.3 : -0.75} width={barrel} height={kind === 'splash' ? 2.6 : 1.5} rx={0.6} fill="#e5e7eb" />
      </g>
      <circle r={kind === 'splash' ? 2.9 : 2.5} fill={c} stroke="#0f172a" strokeWidth={0.6} />
      {kind === 'slow' && <path d="M0,-1.7V1.7M-1.5,-0.85L1.5,0.85M-1.5,0.85L1.5,-0.85" stroke="#0e7490" strokeWidth={0.5} strokeLinecap="round" />}
      {Array.from({ length: level }, (_, i) => <circle key={i} cx={-2.6 + i * 2.6} cy={4.2} r={0.75} fill="#fde047" stroke="#713f12" strokeWidth={0.3} />)}
    </g>
  );
}

export default function TowerGuard() {
  const [saved, setSaved] = useSaved('towers', { unlocked: 1, best: [0, 0, 0] as number[] });
  const game = useRef<TD | null>(null);
  const [, redraw] = useReducer((x: number) => x + 1, 0);
  const [run, setRun] = useState(0);
  const [paused, setPaused] = useState(false);
  const [fast, setFast] = useState(false);
  const [spot, setSpot] = useState<number | null>(null);
  const settings = useRef({ paused, fast });
  settings.current = { paused, fast };
  const g = game.current;

  useEffect(() => {
    if (!run) return;
    const cap = testMode() ? 900 : 0.25;
    let last = performance.now(), acc = 0, raf = 0;
    const frame = () => {
      const now = performance.now(), s = game.current;
      if (!s) return; // back to the maps: this loop is done
      const el = Math.min(cap, Math.max(0, (now - last) / 1000)); last = now;
      if (!settings.current.paused && (s.phase === 'wave' || s.shots.length)) {
        acc += el * (settings.current.fast ? 2 : 1);
        let n = 0;
        while (acc >= DT) { step(s, DT); acc -= DT; n++; if (s.phase !== 'wave' && !s.shots.length) { acc = 0; break; } }
        if (n) redraw();
      } else acc = 0;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const hide = () => { if (document.hidden) setPaused(true); };
    document.addEventListener('visibilitychange', hide);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', hide); };
  }, [run]);

  const phase = g?.phase;
  useEffect(() => {
    const s = game.current;
    if (!s || phase !== 'won') return;
    setSaved((o) => ({ unlocked: Math.max(o.unlocked, Math.min(MAPS.length, s.map + 2)), best: o.best.map((b, i) => (i === s.map ? Math.max(b, s.lives) : b)) }));
  }, [phase, setSaved]);

  const begin = (map: number) => { game.current = newTD(map); setSpot(null); setPaused(false); setRun((r) => r + 1); redraw(); };
  const quit = () => { game.current = null; setSpot(null); redraw(); };
  const act = (ok: boolean) => { if (ok) redraw(); };

  const tw = g && spot !== null ? towerAt(g, spot) : undefined;
  const status = !g ? t('Choose a map.')
    : phase === 'lost' ? t('Game over') : phase === 'won' ? t('Map cleared!')
    : paused && phase === 'wave' ? t('Paused')
    : spot !== null && !tw ? t('Pick a tower to build here.')
    : tw ? t('Upgrade or sell this tower.')
    : phase === 'wave' ? t('Wave {n} is coming!', { n: g.wave })
    : !g.towers.length ? t('Tap a spot beside the path to build a tower.')
    : t('Build or upgrade, then start the next wave.');
  const test = testMode() && g ? { 'data-wave': g.wave, 'data-lives': g.lives, 'data-coins': g.coins } : {};

  if (!g) {
    return (
      <div className="flex h-full flex-col items-center gap-3 overflow-y-auto px-4 py-4" data-state="pick">
        <p className="text-center text-sm text-white/85" role="status">{status}</p>
        <div className="grid w-full max-w-sm gap-3">
          {MAPS.map((_, i) => {
            const open = i < saved.unlocked;
            return (
              <button key={i} type="button" disabled={!open} onClick={() => begin(i)} aria-label={t(MAP_NAMES[i])}
                className="flex items-center gap-4 rounded-2xl bg-white/10 p-3 text-left transition hover:bg-white/15 disabled:opacity-50">
                <MiniMap map={i} />
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-bold">{t(MAP_NAMES[i])}</span>
                  <span className="block text-sm text-white/75">
                    {!open ? t('Clear the map before it to unlock') : saved.best[i] ? t('Cleared with {n} lives left', { n: saved.best[i] }) : t('{n} waves', { n: WAVES })}
                  </span>
                </span>
                {open ? <Play className="size-5 shrink-0" aria-hidden /> : <Lock className="size-5 shrink-0" aria-hidden />}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const look = MAP_LOOK[g.map];
  const cells = pathCells(g.map);
  const preview = tw ? stats(tw.kind, tw.level).range : null;
  const pts = g.path.map((p) => `${p.x * S},${p.y * S}`).join(' ');

  return (
    <div className="flex h-full flex-col items-center px-2 pb-2" data-state={g.phase} {...test}>
      <div className="flex w-full max-w-md items-center justify-between gap-2 py-1.5">
        <div className="flex items-center gap-1.5 text-sm font-bold tabular-nums">
          <span className="flex items-center gap-1 rounded-full bg-black/30 px-2.5 py-1" aria-label={t('Lives: {n}', { n: g.lives })}><Heart className="size-4 fill-rose-400 text-rose-400" aria-hidden />{g.lives}</span>
          <span className="flex items-center gap-1 rounded-full bg-black/30 px-2.5 py-1" aria-label={t('Coins: {n}', { n: g.coins })}><Coins className="size-4 text-amber-300" aria-hidden />{g.coins}</span>
          <span className="rounded-full bg-black/20 px-2.5 py-1 font-semibold">{t('Wave {n} of {total}', { n: Math.max(1, g.wave), total: WAVES })}</span>
        </div>
        <div className="flex gap-1.5">
          <ToolButton label={paused ? t('Play') : t('Pause')} onClick={() => setPaused((p) => !p)}>{paused ? <Play className="size-4" /> : <Pause className="size-4" />}</ToolButton>
          <ToolButton label={fast ? t('Normal speed') : t('Double speed')} onClick={() => setFast((f) => !f)}>
            <FastForward className={cn('size-4', fast && 'fill-current')} />{fast ? '2×' : '1×'}
          </ToolButton>
        </div>
      </div>
      <p className="min-h-5 w-full max-w-md text-center text-sm leading-tight text-white/85" role="status">{status}</p>

      <div className="relative mt-1 min-h-0 w-full max-w-md flex-1">
        <svg viewBox={`0 0 ${COLS * S} ${ROWS * S}`} className="absolute inset-0 size-full touch-none select-none" role="group" aria-label={t('Battlefield')}>
          <defs><clipPath id="td-board"><rect width={COLS * S} height={ROWS * S} rx={3} /></clipPath></defs>
          <g clipPath="url(#td-board)">
            {Array.from({ length: ROWS * COLS }, (_, i) => {
              const c = i % COLS, r = Math.floor(i / COLS);
              return <rect key={i} x={c * S} y={r * S} width={S} height={S} fill={cells.has(`${c},${r}`) ? look.path : look.grass[(c + r) % 2]} />;
            })}
            <polyline points={pts} fill="none" stroke={look.edge} strokeOpacity={0.5} strokeWidth={1} strokeDasharray="1.5 2.5" />
            {g.spots.map((p, i) => {
              const here = towerAt(g, i);
              return (
                <g key={i} role="button" aria-label={here ? t('{tower} tower, level {n}', { tower: t(TOWER_NAMES[here.kind]), n: here.level }) : t('Build spot {n}', { n: i + 1 })}
                  aria-pressed={spot === i} onClick={() => setSpot((x) => (x === i ? null : i))} className="cursor-pointer">
                  <rect x={p.x * S + 0.6} y={p.y * S + 0.6} width={S - 1.2} height={S - 1.2} rx={1.6}
                    fill={spot === i ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.07)'} stroke={spot === i ? 'white' : 'rgba(255,255,255,0.22)'} strokeWidth={spot === i ? 0.7 : 0.4}
                    strokeDasharray={here || spot === i ? undefined : '1.4 1.2'} />
                  {here && <g transform={`translate(${(p.x + 0.5) * S} ${(p.y + 0.5) * S})`}><TowerIcon kind={here.kind} level={here.level} aim={here.aim} /></g>}
                </g>
              );
            })}
            {preview && spot !== null && (
              <circle cx={(g.spots[spot].x + 0.5) * S} cy={(g.spots[spot].y + 0.5) * S} r={preview * S} fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.6)" strokeWidth={0.4} strokeDasharray="1.5 1" pointerEvents="none" />
            )}
            {g.enemies.map((e) => {
              const p = along(g, e.d), f = FOE_LOOK[e.foe];
              return (
                <g key={e.id} transform={`translate(${(p.x * S).toFixed(2)} ${(p.y * S).toFixed(2)})`} pointerEvents="none">
                  <circle r={f.r * S} fill={f.fill} stroke={e.slow > 0 ? '#a5f3fc' : 'rgba(0,0,0,0.5)'} strokeWidth={e.slow > 0 ? 0.9 : 0.5} />
                  {e.foe === 'boss' && <path d="M-2.6,-2.2L-2.6,-4.4L-1.3,-3.2L0,-4.8L1.3,-3.2L2.6,-4.4L2.6,-2.2Z" fill="#facc15" />}
                  <circle cx={-f.r * S * 0.35} cy={-f.r * S * 0.2} r={0.55} fill="white" /><circle cx={f.r * S * 0.35} cy={-f.r * S * 0.2} r={0.55} fill="white" />
                  {e.hp < e.max && (
                    <g transform={`translate(${-f.r * S} ${-f.r * S - 2.2})`}>
                      <rect width={f.r * S * 2} height={1.1} fill="rgba(0,0,0,0.55)" rx={0.5} />
                      <rect width={Math.max(0, (f.r * S * 2 * e.hp) / e.max)} height={1.1} fill="#4ade80" rx={0.5} />
                    </g>
                  )}
                </g>
              );
            })}
            {g.shots.map((sh, i) => sh.kind === 'splash'
              ? <circle key={i} cx={sh.to.x * S} cy={sh.to.y * S} r={(1.1 - sh.ttl * 2) * S} fill="rgba(251,191,36,0.35)" stroke="#fbbf24" strokeWidth={0.5} pointerEvents="none" />
              : <line key={i} x1={sh.from.x * S} y1={sh.from.y * S} x2={sh.to.x * S} y2={sh.to.y * S} stroke={TOWER_COLOURS[sh.kind]} strokeWidth={sh.kind === 'sniper' ? 0.8 : 0.5} strokeLinecap="round" pointerEvents="none" />)}
          </g>
        </svg>
      </div>

      <div className="mt-2 flex min-h-[4.75rem] w-full max-w-md items-stretch gap-2">
        {spot !== null && !tw && KINDS.map((k) => (
          <button key={k} type="button" disabled={g.coins < TOWERS[k].cost || (phase !== 'build' && phase !== 'wave')}
            onClick={() => { if (build(g, spot, k)) { setSpot(null); redraw(); } }}
            aria-label={t('Build {tower} for {n} coins', { tower: t(TOWER_NAMES[k]), n: TOWERS[k].cost })} title={t(TOWER_TIPS[k])}
            className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-2xl bg-white/12 px-1 py-1.5 transition hover:bg-white/20 disabled:opacity-40">
            <svg viewBox="-6 -6 12 12" className="size-8" aria-hidden><TowerIcon kind={k} level={0} /></svg>
            <span className="truncate text-xs font-semibold">{t(TOWER_NAMES[k])}</span>
            <span className="flex items-center gap-0.5 text-xs text-amber-200"><Coins className="size-3" aria-hidden />{TOWERS[k].cost}</span>
          </button>
        ))}
        {tw && (
          <>
            <div className="flex min-w-0 flex-1 flex-col justify-center rounded-2xl bg-black/20 px-3">
              <span className="truncate font-semibold">{t(TOWER_NAMES[tw.kind])} · {t('Level {n}', { n: tw.level })}</span>
              <span className="truncate text-xs text-white/70">{t(TOWER_TIPS[tw.kind])}</span>
            </div>
            <button type="button" disabled={tw.level >= MAX_LEVEL || g.coins < upgradeCost(tw)} onClick={() => act(upgrade(g, tw.id))}
              aria-label={tw.level >= MAX_LEVEL ? t('Fully upgraded') : t('Upgrade for {n} coins', { n: upgradeCost(tw) })}
              className="flex w-20 flex-col items-center justify-center rounded-2xl bg-emerald-500/80 text-sm font-semibold transition hover:bg-emerald-500 disabled:opacity-40">
              <ArrowUp className="size-5" aria-hidden />{tw.level >= MAX_LEVEL ? t('Max') : <span className="flex items-center gap-0.5"><Coins className="size-3" aria-hidden />{upgradeCost(tw)}</span>}
            </button>
            <button type="button" onClick={() => { if (sell(g, tw.id)) { setSpot(null); redraw(); } }} aria-label={t('Sell for {n} coins', { n: sellValue(tw) })}
              className="flex w-20 flex-col items-center justify-center rounded-2xl bg-rose-500/70 text-sm font-semibold transition hover:bg-rose-500">
              <span>{t('Sell')}</span><span className="flex items-center gap-0.5 text-xs"><Coins className="size-3" aria-hidden />+{sellValue(tw)}</span>
            </button>
          </>
        )}
        {spot !== null && (
          <button type="button" onClick={() => setSpot(null)} aria-label={t('Close')} className="grid w-10 shrink-0 place-items-center rounded-2xl bg-white/10 hover:bg-white/20"><X className="size-5" /></button>
        )}
        {spot === null && (
          <button type="button" disabled={phase !== 'build'} onClick={() => act(startWave(g))}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-amber-500 text-lg font-bold text-slate-900 shadow-lg transition hover:bg-amber-400 disabled:bg-white/15 disabled:text-white/70">
            <Swords className="size-5" aria-hidden />
            {phase === 'wave' ? t('{n} enemies left', { n: g.enemies.length + g.queue.length }) : t('Start wave {n}', { n: g.wave + 1 })}
          </button>
        )}
      </div>

      {phase === 'won' && (
        <ResultCard emoji="🏆" title={t('Map cleared!')} primary={g.map + 1 < MAPS.length ? { label: t('Next map'), onClick: () => begin(g.map + 1) } : { label: t('Play again'), onClick: () => begin(g.map) }}
          secondary={{ label: t('Maps'), onClick: quit }}>
          {t('All {n} waves held off with {lives} lives left.', { n: WAVES, lives: g.lives })}
        </ResultCard>
      )}
      {phase === 'lost' && (
        <ResultCard emoji="🏰" title={t('Game over')} primary={{ label: t('Play again'), onClick: () => begin(g.map) }} secondary={{ label: t('Maps'), onClick: quit }}>
          {t('They broke through on wave {n}.', { n: g.wave })}
        </ResultCard>
      )}
    </div>
  );
}

function MiniMap({ map }: { map: number }) {
  const cells = pathCells(map), look = MAP_LOOK[map];
  return (
    <svg viewBox={`0 0 ${COLS} ${ROWS}`} className="h-16 w-11 shrink-0 overflow-hidden rounded-lg" aria-hidden>
      <rect width={COLS} height={ROWS} fill={look.grass[0]} />
      {[...cells].map((k) => { const [c, r] = k.split(',').map(Number); return <rect key={k} x={c} y={r} width={1} height={1} fill={look.path} />; })}
    </svg>
  );
}
