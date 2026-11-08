// The Account tab, in the middle of the bar: your Sanga account. Your photo and name, what the Chats
// screen's photo and ⋮ menu used to hold (new chat, new group, new story, friends, archived chats),
// every part of Settings, locking Sanga and signing out. Each opens over this page; closing it comes back here.
import { Archive, CirclePlus, Lock, LogOut, MessageSquarePlus, UserPlus, Users } from 'lucide-react';
import { confirm } from '@sanga/ui/confirm';
import { lockNow } from '../../lib/applock';
import { logout } from '../../lib/engine';
import { go } from '../../lib/nav';
import { openComposer } from '../../lib/stories';
import { setApp, useApp } from '../../state/app';
import { useSettings } from '../../state/settings';
import { AppTabs } from '../nav/AppTabs';
import { NavRow } from '../settings/settings-panel/NavRow';
import { ProfileRow, SettingsRows } from '../settings/settings-panel/Main';
import { Section } from '../settings/settings-panel/Section';
import type { Page } from '../settings/settings-panel/types';
import { t, tn } from '@sanga/i18n';

export function ProfilePage() {
  const incoming = useApp((s) => s.incoming.length);
  const archived = useApp((s) => s.chats.filter((c) => c.archived && c.ts).length);
  const appLock = useSettings((s) => !!s.appLock);
  const settings = (p: Page) => setApp({ panel: 'settings', settingsPage: p });

  return (
    <section aria-label={t('Account')} className="mx-auto flex h-[var(--app-h,100dvh)] max-w-[1600px] flex-col bg-bg md:border-x md:border-line">
      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
        <div className="mx-auto max-w-2xl">
          <h1 className="px-5 pt-5 pb-3 text-2xl font-bold tracking-tight">{t('Account')}</h1>
          <ProfileRow onClick={() => settings('profile')} />

          <Section title={t('Chats and friends')}>
            <NavRow icon={<MessageSquarePlus />} label={t('New chat')} onClick={() => setApp({ panel: 'friends', friendsTab: 'friends' })} />
            <NavRow icon={<Users />} label={t('New group')} onClick={() => setApp({ panel: 'newgroup' })} />
            <NavRow icon={<CirclePlus />} label={t('New story')} onClick={() => openComposer()} />
            <NavRow icon={<UserPlus />} label={t('Friends')} sub={incoming ? tn(incoming, '{n} friend request', '{n} friend requests') : t('Add a friend, see your friends')}
              onClick={() => setApp({ panel: 'friends', friendsTab: incoming ? 'requests' : 'friends' })} />
            <NavRow icon={<Archive />} label={t('Archived chats')} sub={archived ? String(archived) : undefined} onClick={() => { go('chat'); setApp({ panel: 'archived' }); }} />
          </Section>

          <Section title={t('Settings')}>
            <SettingsRows go={settings} />
          </Section>

          <Section>
            {appLock && <NavRow icon={<Lock />} label={t('Lock Sanga')} onClick={lockNow} />}
            <button onClick={async () => {
              if (await confirm({ title: t('Sign out?'), description: t('Messages stored on this device will be removed. You can sign in again any time.'), confirmText: t('Sign out'), destructive: true })) logout();
            }} className="flex w-full items-center gap-4 px-5 py-3.5 text-left text-danger hover:bg-hover"><LogOut className="size-5" /> {t('Sign out')}</button>
          </Section>
        </div>
      </div>
      <AppTabs />
    </section>
  );
}
