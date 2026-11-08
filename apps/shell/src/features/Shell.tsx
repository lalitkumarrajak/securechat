import { lazy, Suspense, useEffect } from 'react';
import { handleInvite } from '../lib/invite';
import { DiaryPage } from './notes/DiaryPage';
import { CalendarPage } from './calendar/CalendarPage';
import { SplitPage } from './split/SplitPage';
import { AccountsPage } from './accounts/AccountsPage';
import { getApp, setApp, useApp } from '../state/app';
import { go } from '../lib/nav';
import { MorePage } from './nav/MorePage';
import { GamesSkeleton } from './games/GamesSkeleton';
import { Overlays } from './shell/Overlays';
import { Shell } from './shell/Shell';

const GamesHub = lazy(() => import('./games/GamesHub').then((m) => ({ default: m.GamesHub })));

/** Signed in: Chat (Chats and Stories) or Games, with everything that can open over any of them. */
export function Main() {
  const section = useApp((s) => s.section);
  useEffect(() => { handleInvite(); }, []); // opened from someone's invite link
  useEffect(() => { takeShare(); }, []); // opened by Share → Sanga
  usePrefetch();
  useKeyboardHeight();
  return (
    <>
      {(section === 'chat' || section === 'stories') && <Shell />}
      {section === 'diary' && <DiaryPage />}
      {section === 'calendar' && <CalendarPage />}
      {section === 'split' && <SplitPage />}
      {section === 'accounts' && <AccountsPage />}
      {section === 'more' && <MorePage />}
      {section === 'games' && <Suspense fallback={<GamesSkeleton />}><GamesHub /></Suspense>}
      <Overlays />
    </>
  );
}

// Share → Sanga with a statement PDF or a bank SMS: the service worker kept it and opened /?share=1.
// Accounts reads it (and lets it go); the address goes back to plain.
function takeShare() {
  if (new URLSearchParams(location.search).get('share') !== '1') return;
  history.replaceState(null, '', location.pathname);
  setApp({ appParams: { ...getApp().appParams, accounts: { import: 'share' } } });
  setApp({ section: 'chat' });
  go('accounts');
}

// Nothing is downloaded ahead of use: Settings, Friends, Stories, Games and the other apps load when
// you open them. Only apps you've already used and that work in the background (the calendar's
// reminders) start once Sanga has settled; nothing is downloaded for the others.
function usePrefetch() {
  useEffect(() => {
    const bg = setTimeout(() => void import('../lib/apps').then((m) => m.runBackgrounds()), 6000);
    return () => clearTimeout(bg);
  }, []);
}

// iPhones don't shrink the page when the keyboard opens (Android does, see index.html); they slide
// the page up instead, hiding the header and the newest messages. Size the app to the part of the
// screen above the keyboard, so the chat shrinks like it does on Android.
function useKeyboardHeight() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const fit = () => {
      if (vv.scale > 1.05) return; // zoomed in with two fingers: leave the page alone
      document.documentElement.style.setProperty('--app-h', `${vv.height}px`);
      if (window.scrollY) window.scrollTo(0, 0);
    };
    fit();
    vv.addEventListener('resize', fit);
    vv.addEventListener('scroll', fit);
    return () => { vv.removeEventListener('resize', fit); vv.removeEventListener('scroll', fit); document.documentElement.style.removeProperty('--app-h'); };
  }, []);
}
