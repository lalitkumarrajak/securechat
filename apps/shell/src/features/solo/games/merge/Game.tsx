// Monster Merge: the field, coins ticking up, Summon, and the collection book. Tap a monster then a
// twin to merge (or drag it there); every new level pops and goes into the book. Kept on this device.
import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { BookOpen, X } from 'lucide-react';
import { cn } from '@sanga/ui/utils';
import { locale, t, tn } from '@sanga/i18n';
import { newSeed, testMode, useSaved } from '../../kit';
import { canMerge, COLS, cost, drop, earn, income, newFarm, summon, TIERS, totalIncome, type Farm } from './logic';
import { Monster, NAMES } from './Monster';

const STYLE = /* CSS, i18n-ok */ `
@keyframes merge-pop { 0% { transform: scale(.3); } 55% { transform: scale(1.3); } 100% { transform: scale(1); } }
@keyframes merge-ring { from { transform: scale(.3); opacity: 1; } to { transform: scale(1.7); opacity: 0; } }
@keyframes merge-float { from { transform: translateY(0); opacity: 1; } to { transform: translateY(-34px); opacity: 0; } }
@keyframes merge-hatch { 0% { transform: translateY(-30px) scale(.5); opacity: 0; } 60% { transform: translateY(0) scale(1.1); opacity: 1; } 100% { transform: scale(1); } }
@keyframes merge-bob { 0%, 100% { transform: translateY(0) scaleY(1); } 50% { transform: translateY(-3%) scaleY(1.03); } }`;

type Note = { kind: 'merged' | 'new'; tier: number } | { kind: 'poor' | 'full' | 'top' } | { kind: 'away'; n: number } | null;
const fmt = (n: number) => new Intl.NumberFormat(locale(), { notation: n >= 10_000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(Math.floor(n));
const name = (tier: number) => t(NAMES[tier]);
const bob = (i: number) => `merge-bob ${2.2 + (i % 5) * 0.2}s ease-in-out infinite`; // i18n-ok

export default function MonsterMerge() {
  const init = useMemo(() => newFarm(newSeed(), Date.now()), []);
  const [farm, setFarm] = useSaved<Farm>('merge', init);
  const [picked, setPicked] = useState<number | null>(null);
  const [note, setNote] = useState<Note>(null);
  const [fx, setFx] = useState<{ at: number; tier: number; key: number; coins: number } | null>(null);
  const [hatched, setHatched] = useState(-1);
  const [book, setBook] = useState(false);
  const [drag, setDrag] = useState<{ from: number; x: number; y: number; x0: number; y0: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);
  const test = testMode();

  // coins: what was earned while away, then every second
  useEffect(() => {
    const away = earn(farm, Date.now());
    const gained = away.coins - farm.coins;
    if (gained > 0) setNote({ kind: 'away', n: gained });
    setFarm(away);
    const id = setInterval(() => setFarm((f) => earn(f, Date.now())), 1000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const act = (a: number, b: number) => {
    const before = farm;
    if (a === b) return;
    if (before.cells[a] === TIERS && before.cells[b] === TIERS) { setNote({ kind: 'top' }); return; }
    const merge = canMerge(before, a, b);
    const n = drop(before, a, b);
    setFarm(n);
    if (merge) {
      const tier = n.cells[b];
      setNote({ kind: tier > before.found ? 'new' : 'merged', tier });
      setFx({ at: b, tier, key: Date.now(), coins: n.coins - before.coins });
    } else setNote(null);
  };
  const tap = (i: number) => {
    if (justDragged.current) return;
    if (picked === null) { if (farm.cells[i]) setPicked(i); return; }
    if (picked === i) { setPicked(null); return; }
    act(picked, i);
    setPicked(null);
  };
  const doSummon = () => {
    const n = summon(farm);
    if (n === farm) { setNote({ kind: farm.cells.every(Boolean) ? 'full' : 'poor' }); return; }
    setHatched(n.cells.findIndex((c, i) => c && !farm.cells[i]));
    setFarm(n);
    setNote(null);
  };

  const onDown = (e: RPointerEvent, i: number) => {
    if (e.button !== 0 || !farm.cells[i]) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ from: i, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, moved: false });
  };
  const onMove = (e: RPointerEvent) => {
    if (!drag) return;
    const moved = drag.moved || Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 8;
    setDrag({ ...drag, x: e.clientX, y: e.clientY, moved });
  };
  const onUp = (e: RPointerEvent) => {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    if (!d.moved) return;
    justDragged.current = true;
    setTimeout(() => { justDragged.current = false; }, 0);
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-cell]');
    if (el) { act(d.from, Number(el.getAttribute('data-cell'))); setPicked(null); }
  };

  const price = cost(farm.summons);
  const status = note?.kind === 'new' ? t('New monster: {name}, level {n}!', { name: name(note.tier), n: note.tier })
    : note?.kind === 'merged' ? t('Merged into {name}, level {n}.', { name: name(note.tier), n: note.tier })
    : note?.kind === 'poor' ? t('Not enough coins yet. Your monsters earn more every second.')
    : note?.kind === 'full' ? t('No room. Merge some monsters first.')
    : note?.kind === 'top' ? t('That’s the biggest monster there is!')
    : note?.kind === 'away' ? t('While you were away your monsters earned {n} coins.', { n: fmt(note.n) })
    : picked !== null ? t('Now tap another {name} to merge, or an empty cell to move it.', { name: name(farm.cells[picked]) })
    : farm.cells.every((c) => !c) ? t('Tap Summon to hatch an egg.')
    : t('Drag a monster onto one just like it to merge them.');

  return (
    <div className="flex h-full flex-col items-center gap-2.5 px-3 py-2">
      <style>{STYLE}</style>
      <div className="flex w-full max-w-sm items-center justify-between gap-2">
        <div className="flex items-center gap-2 rounded-full bg-black/30 py-1 pl-1.5 pr-3" role="img" aria-label={tn(Math.floor(farm.coins), '{n} coin', '{n} coins')}>
          <span className="grid size-7 place-items-center rounded-full bg-amber-400 text-sm shadow-inner" aria-hidden>🪙</span>
          <span className="text-lg font-bold tabular-nums">{fmt(farm.coins)}</span>
          <span className="text-xs text-white/70">+{fmt(totalIncome(farm))}/s</span>
        </div>
        <button type="button" onClick={() => setBook(true)} className="flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-2 text-sm font-semibold hover:bg-white/25">
          <BookOpen className="size-4" />{t('Collection')} <span className="text-white/70">{farm.found}/{TIERS}</span>
        </button>
      </div>

      <p className="min-h-10 max-w-sm text-center text-sm leading-snug text-white/90" role="status">{status}</p>

      <div className="grid w-full max-w-[min(24rem,calc((100dvh-17rem)*5/6))] gap-1.5 rounded-3xl bg-black/20 p-2 select-none" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`, touchAction: 'none' }}
        role="group" aria-label={t('Field')} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}>
        {farm.cells.map((tier, i) => {
          const isDragged = drag?.moved && drag.from === i;
          const match = picked !== null && picked !== i && canMerge(farm, picked, i);
          return (
            <button key={i} type="button" data-cell={i} onClick={() => tap(i)} onPointerDown={(e) => onDown(e, i)}
              aria-label={tier ? t('{name}, level {n}', { name: name(tier), n: tier }) : t('Empty cell {n}', { n: i + 1 })} aria-pressed={tier ? picked === i : undefined}
              data-tier={test ? tier : undefined}
              className={cn('relative aspect-square rounded-2xl transition', tier ? 'bg-white/15 shadow-[inset_0_-4px_0_rgba(0,0,0,0.15)]' : 'bg-white/5',
                picked === i && 'bg-white/35 ring-2 ring-white', match && 'ring-2 ring-amber-300 bg-amber-200/25')}>
              {tier > 0 && !isDragged && (
                <span key={fx?.at === i ? fx.key : hatched === i ? `h${farm.summons}` : 'm'} className="absolute inset-[6%]"
                  style={{ animation: fx?.at === i ? 'merge-pop .45s cubic-bezier(.2,1.4,.5,1)' : hatched === i ? 'merge-hatch .45s ease-out' : undefined }}>
                  <span className="block size-full" style={{ animation: bob(i) }}><Monster tier={tier} className="size-full drop-shadow" /></span>
                </span>
              )}
              {tier > 0 && <span className="absolute bottom-0.5 right-1 text-[10px] font-bold text-white/80" aria-hidden>{tier}</span>}
              {fx?.at === i && (
                <span key={fx.key} className="pointer-events-none absolute inset-0" aria-hidden>
                  <span className="absolute inset-0 rounded-full border-4 border-amber-200" style={{ animation: 'merge-ring .5s ease-out forwards' }} />
                  <span className="absolute -top-2 left-0 right-0 text-center text-xs font-bold text-amber-200" style={{ animation: 'merge-float .9s ease-out forwards' }}>+{fx.coins}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      <button type="button" onClick={doSummon} aria-label={t('Summon an egg for {n} coins', { n: price })}
        className={cn('mt-auto flex w-full max-w-sm items-center justify-center gap-3 rounded-2xl px-5 py-3.5 text-lg font-bold shadow-lg transition active:scale-[.98]',
          farm.coins >= price && farm.cells.some((c) => !c) ? 'bg-gradient-to-b from-amber-300 to-orange-500 text-orange-950' : 'bg-white/15 text-white/60')}>
        <Monster tier={1} className="size-8" />{t('Summon')}<span className="rounded-full bg-black/15 px-2.5 py-0.5 text-sm">🪙 {fmt(price)}</span>
      </button>

      {drag?.moved && (
        <div className="pointer-events-none fixed z-40 size-20 -translate-x-1/2 -translate-y-1/2 drop-shadow-2xl" style={{ left: drag.x, top: drag.y }} aria-hidden>
          <Monster tier={farm.cells[drag.from]} className="size-full scale-110" />
        </div>
      )}

      {book && (
        <div className="absolute inset-0 z-20 flex flex-col bg-black/60 p-4 animate-fade-in" role="dialog" aria-label={t('Collection')}>
          <div className="mx-auto flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white text-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h2 className="text-lg font-bold">{t('Collection')} <span className="text-sm font-medium text-slate-500">· {t('{n} of {total} found', { n: farm.found, total: TIERS })}</span></h2>
              <button type="button" onClick={() => setBook(false)} aria-label={t('Close')} className="grid size-9 place-items-center rounded-full hover:bg-slate-100"><X className="size-5" /></button>
            </div>
            <ul className="grid grid-cols-3 gap-2 overflow-y-auto p-3">
              {Array.from({ length: TIERS }, (_, k) => k + 1).map((tier) => {
                const known = tier <= farm.found;
                return (
                  <li key={tier} className={cn('flex flex-col items-center rounded-2xl p-2 text-center', known ? 'bg-amber-50' : 'bg-slate-100')}>
                    <Monster tier={tier} className={cn('size-16', !known && 'opacity-25 brightness-0')} />
                    <span className="mt-1 text-sm font-semibold">{known ? name(tier) : '?'}</span>
                    <span className="text-[11px] text-slate-500">{t('Level {n}', { n: tier })}{known && income(tier) ? ` · +${fmt(income(tier))}/s` : ''}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
