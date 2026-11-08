// The Games page's "On your own": puzzles, arcade and card games, by category. Only names and
// pictures are here; a game's code downloads when you open it.
import { useState } from 'react';
import { cn } from '@sanga/ui/utils';
import { t, tk } from '@sanga/i18n';
import { SOLO } from './registry';
import { openSolo } from './store';
import type { SoloCategory } from './kit';

const CATEGORIES: SoloCategory[] = ['puzzle', 'arcade', 'brain', 'cards', 'strategy', 'casual', 'adventure'];
export const CATEGORY_NAMES: Record<SoloCategory, string> = {
  puzzle: tk('Puzzle'), arcade: tk('Arcade'), brain: tk('Brain'), cards: tk('Cards'), strategy: tk('Strategy'), casual: tk('Casual'), adventure: tk('Adventure'),
};

export function SoloGames() {
  const [cat, setCat] = useState<SoloCategory | 'all'>('all');
  if (!SOLO.length) return null;
  const cats = CATEGORIES.filter((c) => SOLO.some((g) => g.category === c));
  const shown = SOLO.filter((g) => cat === 'all' || g.category === cat);
  return (
    <section aria-label={t('On your own')} className="mt-8">
      <h2 className="mb-1 text-lg font-semibold">{t('On your own')}</h2>
      <p className="mb-3 text-sm text-muted">{t('Puzzles, arcade and card games. Each one downloads when you first play it.')}</p>
      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label={t('Kinds of game')}>
        {(['all', ...cats] as const).map((c) => (
          <button key={c} type="button" role="tab" aria-selected={cat === c} onClick={() => setCat(c)}
            className={cn('h-8 shrink-0 rounded-full px-3.5 text-sm font-medium transition', cat === c ? 'bg-accent/15 text-accent-ink' : 'bg-panel-2 text-muted hover:text-ink')}>
            {c === 'all' ? t('All') : t(CATEGORY_NAMES[c])}
          </button>
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((g) => (
          <li key={g.id} className="min-w-0">
            <button type="button" onClick={() => openSolo(g.id)} aria-label={t(g.name)}
              className="group w-full overflow-hidden rounded-2xl border border-line bg-panel text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <span className="grid h-24 place-items-center text-5xl transition group-hover:scale-105" style={{ background: g.background }} aria-hidden>{g.emoji}</span>
              <span className="block p-3">
                <span className="block truncate font-semibold">{t(g.name)}</span>
                <span className="block truncate text-xs text-muted">{t(CATEGORY_NAMES[g.category])} · {t(g.blurb)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
