// Dungeon Deck: the 3×3 grid, your health, weapon, gold and floor. Tap (or use the arrow keys) to step
// onto a card next to you. The run in progress and your best gold are kept on this device.
import { useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { cn } from '@sanga/ui/utils';
import { t, tk } from '@sanga/i18n';
import { newSeed, ResultCard, testMode, ToolButton, useSaved } from '../../kit';
import { adjacent, newRun, over, step, type DCard, type Dungeon } from './logic';

const MONSTERS: [string, string][] = [
  ['🐀', tk('Rat')], ['🦇', tk('Bat')], ['🦠', tk('Slime')], ['👺', tk('Goblin')], ['💀', tk('Skeleton')], ['🐺', tk('Wolf')], ['👹', tk('Ogre')],
  ['👻', tk('Ghost')], ['🧌', tk('Troll')], ['🧙', tk('Witch')], ['🗿', tk('Golem')], ['😈', tk('Demon')], ['🐉', tk('Dragon')],
];
const weaponArt = (v: number): [string, string] => (v <= 3 ? ['🗡️', tk('Dagger')] : v <= 6 ? ['🪓', tk('Axe')] : ['⚔️', tk('Sword')]);
const ART: Record<DCard['kind'], (c: DCard) => [string, string]> = {
  monster: (c) => MONSTERS[c.v - 1], weapon: (c) => weaponArt(c.v), potion: () => ['🧪', tk('Potion')], gold: () => ['🪙', tk('Gold')],
  trap: () => ['🪤', tk('Trap')], chest: () => ['🧰', tk('Chest')], stairs: () => ['🪜', tk('Stairs')],
};
const LOOK: Record<DCard['kind'], string> = {
  monster: 'from-rose-500 to-red-900 ring-rose-300/40', weapon: 'from-sky-400 to-slate-700 ring-sky-200/40', potion: 'from-fuchsia-400 to-pink-800 ring-pink-200/40',
  gold: 'from-amber-300 to-yellow-700 ring-amber-100/50', trap: 'from-zinc-400 to-zinc-800 ring-zinc-200/30', chest: 'from-orange-400 to-amber-900 ring-orange-200/40',
  stairs: 'from-teal-300 to-cyan-900 ring-teal-100/50',
};

function label(c: DCard) {
  const name = t(ART[c.kind](c)[1]);
  switch (c.kind) {
    case 'monster': return t('{name}: monster, strength {n}', { name, n: c.v });
    case 'weapon': return t('{name}: weapon, blocks {n}', { name, n: c.v });
    case 'potion': return t('Potion: heals {n}', { n: c.v });
    case 'gold': return t('Gold: {n}', { n: c.v });
    case 'trap': return t('Trap: {n} damage', { n: c.v });
    case 'chest': return t('Chest: something inside');
    case 'stairs': return t('Stairs down to floor {n}', { n: c.v });
  }
}

function story(d: Dungeon) {
  const e = d.last;
  switch (e.kind) {
    case 'start': return t('Step onto a card next to you. Monsters hurt unless your weapon blocks them.');
    case 'monster': {
      const name = t(MONSTERS[e.v - 1][1]);
      const lost = e.dmg ? t('You beat the {name}, lost {n} health and took {g} gold.', { name, n: e.dmg, g: e.gold }) : t('You beat the {name} without a scratch and took {g} gold.', { name, g: e.gold });
      return e.chest ? t('The chest was a monster!') + ' ' + lost : lost;
    }
    case 'weapon': return t('You picked up a {name} that blocks {n}.', { name: t(weaponArt(e.v)[1]), n: e.v });
    case 'potion': return e.chest ? t('The chest held a potion: +{n} health.', { n: e.v }) : t('You drank a potion: +{n} health.', { n: e.v });
    case 'gold': return e.chest ? t('The chest held {n} gold.', { n: e.v }) : t('+{n} gold.', { n: e.v });
    case 'trap': return t('A trap! −{n} health.', { n: e.v });
    case 'stairs': return t('Down to floor {n}. Monsters get stronger.', { n: e.floor });
  }
}

export default function DungeonDeck() {
  const [saved, setSaved] = useSaved<{ run: Dungeon | null; best: number }>('dungeon', { run: null, best: 0 });
  const [run, setRun] = useState<Dungeon>(() => saved.run && !over(saved.run) ? saved.run : newRun(newSeed()));
  const [hurt, setHurt] = useState(false);
  const prevBest = useRef(saved.best);
  const test = testMode();

  const go = (to: number) => {
    if (over(run) || !adjacent(run.hero, to)) return;
    const n = step(run, to);
    if (n.hp < run.hp) { setHurt(true); setTimeout(() => setHurt(false), 420); }
    setRun(n);
    setSaved((s) => ({ run: n, best: Math.max(s.best, n.gold) }));
  };
  const restart = () => { prevBest.current = saved.best; const n = newRun(newSeed()); setRun(n); setSaved((s) => ({ ...s, run: n })); };

  useEffect(() => {
    const keys: Record<string, number> = { ArrowUp: -3, ArrowDown: 3, ArrowLeft: -1, ArrowRight: 1 };
    const onKey = (e: KeyboardEvent) => {
      const d = keys[e.key];
      if (d === undefined) return;
      const to = run.hero + d;
      if (to >= 0 && to < 9 && adjacent(run.hero, to)) { e.preventDefault(); go(to); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const dead = over(run);
  const hearts = Math.max(0, run.hp) / run.maxHp;

  return (
    <div className="flex h-full flex-col items-center gap-3 px-3 py-3">
      <div className="flex w-full max-w-md items-center justify-between gap-2">
        <span className="rounded-full bg-black/30 px-3 py-1 text-sm font-semibold">{t('Floor {n}', { n: run.floor })}</span>
        <span className="truncate text-xs text-white/70">{t('Best: {n} gold', { n: saved.best })}</span>
        <ToolButton label={t('Start again')} onClick={restart}><RotateCcw className="size-4" /></ToolButton>
      </div>

      <div className="grid w-full max-w-md grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-black/30 px-2 py-2" aria-label={t('Health {n} of {max}', { n: run.hp, max: run.maxHp })} role="img">
          <div className="text-lg font-bold">❤️ {run.hp}<span className="text-xs font-medium text-white/60">/{run.maxHp}</span></div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/15"><div className={cn('h-full rounded-full transition-all duration-300', hearts > 0.5 ? 'bg-emerald-400' : hearts > 0.25 ? 'bg-amber-400' : 'bg-red-500')} style={{ width: `${hearts * 100}%` }} /></div>
        </div>
        <div className="rounded-2xl bg-black/30 px-2 py-2" aria-label={t('Weapon blocks {n}', { n: run.weapon })} role="img">
          <div className="text-lg font-bold">{run.weapon ? weaponArt(run.weapon)[0] : '✊'} {run.weapon}</div>
          <div className="text-[11px] text-white/60">{t('Weapon')}</div>
        </div>
        <div className="rounded-2xl bg-black/30 px-2 py-2" aria-label={t('Gold: {n}', { n: run.gold })} role="img">
          <div className="text-lg font-bold">🪙 {run.gold}</div>
          <div className="text-[11px] text-white/60">{t('Gold')}</div>
        </div>
      </div>

      <p className="min-h-10 max-w-md text-center text-sm leading-snug text-white/90" role="status">{story(run)}</p>

      <div className={cn('grid aspect-square w-full max-w-[min(28rem,calc(100dvh-20rem))] grid-cols-3 gap-2.5', hurt && 'animate-shake')} role="group" aria-label={t('Dungeon')}>
        {run.cells.map((c, i) => {
          if (i === run.hero) return (
            <div key={`hero-${run.turns}`} className={cn('relative grid place-items-center rounded-2xl bg-gradient-to-b from-indigo-400 to-indigo-800 shadow-lg ring-4 ring-white/70 animate-pop', dead && 'grayscale')} role="img" aria-label={t('You: {n} health', { n: run.hp })}>
              <span className="text-[min(3.2rem,12vw)] leading-none" aria-hidden>{dead ? '🪦' : '🦸'}</span>
              <span className="absolute bottom-1.5 left-0 right-0 text-center text-xs font-semibold">{t('You')}</span>
            </div>
          );
          const near = !dead && adjacent(run.hero, i);
          const [emoji, name] = ART[c.kind](c);
          return (
            <button key={c.id} type="button" onClick={() => go(i)} disabled={!near} aria-label={label(c)}
              data-kind={test ? c.kind : undefined} data-v={test ? c.v : undefined}
              className={cn('relative grid place-items-center overflow-hidden rounded-2xl bg-gradient-to-b shadow-lg ring-2 transition duration-200 animate-pop disabled:cursor-default',
                LOOK[c.kind], near ? 'hover:-translate-y-0.5 hover:ring-4 active:scale-95' : 'opacity-55 saturate-50')}>
              <span className="absolute left-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-black/40 text-sm font-bold">{c.kind === 'chest' ? '?' : c.v}</span>
              <span className="text-[min(3rem,11vw)] leading-none drop-shadow" aria-hidden>{emoji}</span>
              <span className="absolute bottom-1.5 left-0 right-0 truncate px-1 text-xs font-semibold">{t(name)}</span>
            </button>
          );
        })}
      </div>

      {dead && (
        <ResultCard emoji="💀" title={t('Game over')} primary={{ label: t('Play again'), onClick: restart }}>
          {t('Floor {n} · {g} gold', { n: run.floor, g: run.gold })}
          <br />{run.gold > prevBest.current ? t('A new best!') : t('Best: {n} gold', { n: saved.best })}
        </ResultCard>
      )}
    </div>
  );
}
