// The More tab: Sanga's apps that don't have a tab of their own along the bottom, as big tiles in their
// own colours (the landing page's). Each opens with a Back button that returns here; More stays lit.
import type { ReactNode } from 'react';
import { ArrowRight, Gamepad2, Landmark, NotebookPen } from 'lucide-react';
import { go } from '../../lib/nav';
import { setApp } from '../../state/app';
import { AppTabs, useGamesDue } from './AppTabs';
import { t, tn } from '@sanga/i18n';

const DOTS = 'radial-gradient(circle, rgba(255,255,255,0.09) 0 1.5px, transparent 2px) 0 0 / 22px 22px';

export function MorePage() {
  const gamesDue = useGamesDue();
  const tile = (name: string, text: string, icon: ReactNode, bg: string, open: () => void, badge?: ReactNode) => (
    <li key={name}>
      <button onClick={open} style={{ background: `${DOTS}, ${bg}` }}
        className="group relative flex h-full min-h-44 w-full flex-col overflow-hidden rounded-3xl p-5 text-left text-white shadow-sm transition hover:shadow-lg active:scale-[0.98]">
        <span className="grid size-12 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur [&_svg]:size-6">{icon}</span>
        {badge}
        <span className="mt-auto pt-6 text-lg font-bold tracking-tight">{name}</span>
        <span className="text-sm text-white/80">{text}</span>
        <ArrowRight className="absolute right-5 bottom-5 size-5 text-white/70 transition group-hover:translate-x-0.5" aria-hidden />
      </button>
    </li>
  );
  return (
    <section aria-label={t('More')} className="mx-auto flex h-[var(--app-h,100dvh)] max-w-[1600px] flex-col bg-bg md:border-x md:border-line">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* <header className="mx-auto max-w-3xl px-4 pt-6 pb-2 md:px-8 md:pt-8">
          <h1 className="text-2xl font-bold tracking-tight">{t('More')}</h1>
          <p className="text-sm text-muted">{t('Your other Sanga apps')}</p>
        </header> */}
        <ul className="mx-auto grid max-w-3xl grid-cols-2 gap-3 px-4 py-4 md:gap-4 md:px-8">
          {tile(t('Games'), gamesDue > 0 ? tn(gamesDue, '{n} game waiting for you', '{n} games waiting for you') : t('Ludo, UNO and more'),
            <Gamepad2 />, 'linear-gradient(140deg, #6366f1, #312e81)', () => go('games'),
            gamesDue > 0 && <span className="absolute top-5 right-5 grid min-w-6 place-items-center rounded-full bg-white px-1.5 text-xs leading-6 font-bold text-indigo-700">{gamesDue}</span>)}
          {tile(t('Diary'), t('Notes and your daily diary'), <NotebookPen />, 'linear-gradient(140deg, #f59e0b, #92400e)',
            () => { setApp({ notesChat: null }); go('diary'); })}
          {tile(t('Accounts'), t('Banks, cards, cash and bills'), <Landmark />, 'linear-gradient(140deg, #0ea5e9, #1e3a8a)', () => go('accounts'))}
        </ul>
      </div>
      <AppTabs />
    </section>
  );
}
