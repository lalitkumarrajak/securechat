import { ArrowLeft } from 'lucide-react';
import { IconButton } from '@sanga/ui/button';
import { t } from '@sanga/i18n';
import { back } from '../../lib/nav';
import { AppTabs } from '../nav/AppTabs';

/** What the Games tab shows while its code downloads the first time: the same frame and the same tabs,
 *  so switching to Games doesn't blank the screen. */
export function GamesSkeleton() {
  return (
    <div className="flex h-[var(--app-h,100dvh)] flex-col bg-bg">
      <div className="min-h-0 flex-1 overflow-hidden">
        <header className="border-b border-line">
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4 md:h-16 md:px-8"><IconButton label={t('Back')} onClick={back} className="-ml-2"><ArrowLeft /></IconButton><h1 className="text-xl font-bold tracking-tight">{t('Games')}</h1></div>
        </header>
        <div className="mx-auto max-w-5xl animate-pulse px-4 md:px-8" aria-hidden>
          <div className="mt-5 h-44 rounded-3xl bg-panel-2" />
          <div className="mt-8 mb-3 h-6 w-40 rounded-lg bg-panel-2" />
          <div className="grid gap-4 sm:grid-cols-2"><div className="h-56 rounded-3xl bg-panel-2" /><div className="hidden h-56 rounded-3xl bg-panel-2 sm:block" /></div>
        </div>
      </div>
      <AppTabs />
    </div>
  );
}
