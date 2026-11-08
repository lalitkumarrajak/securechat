import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { IconButton } from '@sanga/ui/button';
import { Panel } from '@sanga/ui/dialog';
import { getApp, setApp, useApp } from '../../state/app';
import { About } from './settings-panel/About';
import { Account } from './settings-panel/Account';
import { Appearance } from './settings-panel/Appearance';
import { Chats } from './settings-panel/Chats';
import { Language } from './settings-panel/Language';
import { Main } from './settings-panel/Main';
import { Notifications } from './settings-panel/Notifications';
import { Privacy } from './settings-panel/Privacy';
import { Profile } from './settings-panel/Profile';
import { Sessions } from './settings-panel/Sessions';
import type { Page } from './settings-panel/types';
import { t, tk } from '@sanga/i18n';

const TITLES: Record<Page, string> = {
  main: tk('Settings'), profile: tk('Profile'), appearance: tk('Appearance'), privacy: tk('Privacy'), notifications: tk('Notifications'),
  chats: tk('Chats'), account: tk('Sign-in and security'), sessions: tk('Active sessions'), about: tk('About Sanga'), language: tk('Language'),
};

export function SettingsPanel() {
  const open = useApp((s) => s.panel === 'settings');
  const [page, setPage] = useState<Page>('main');
  const [entry, setEntry] = useState<Page>('main'); // opened at one part (from the Account tab): Back from it closes
  useEffect(() => {
    if (!open) return;
    const first = (getApp().settingsPage as Page) || 'main';
    setPage(first); setEntry(first);
    setApp({ settingsPage: null });
  }, [open]);
  const close = () => setApp({ panel: null });

  return (
    <Panel open={open} onOpenChange={(o) => !o && close()} title={t('Settings')}>
      <header className="flex h-16 shrink-0 items-center gap-2 bg-panel px-3">
        <IconButton label={t('Back')} onClick={() => (page === 'main' || page === entry ? close() : setPage(page === 'sessions' ? 'account' : 'main'))}><ArrowLeft /></IconButton>
        <h2 className="text-lg font-semibold">{t(TITLES[page])}</h2>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto pb-8">
        {page === 'main' && <Main go={setPage} />}
        {page === 'profile' && <Profile />}
        {page === 'appearance' && <Appearance />}
        {page === 'privacy' && <Privacy />}
        {page === 'notifications' && <Notifications />}
        {page === 'chats' && <Chats />}
        {page === 'account' && <Account go={setPage} />}
        {page === 'sessions' && <Sessions />}
        {page === 'about' && <About />}
        {page === 'language' && <Language />}
      </div>
    </Panel>
  );
}
