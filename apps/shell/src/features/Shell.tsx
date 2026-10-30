import { lazy, Suspense, useEffect } from 'react';
import { useApp } from '../state/app';
import { handleInvite } from '../lib/invite';
import { DiaryPage } from './notes/DiaryPage';
import { CalendarPage } from './calendar/CalendarPage';
import { Overlays } from './shell/Overlays';
import { Shell } from './shell/Shell';

const GamesHub = lazy(() => import('./games/GamesHub').then((m) => ({ default: m.GamesHub })));

/** Signed in: Chat (Chats and Stories) or Games, with everything that can open over any of them. */
export function Main() {
  const section = useApp((s) => s.section);
  useEffect(() => { handleInvite(); }, []); // opened from someone's invite link
  usePrefetch();
  useKeyboardHeight();
  return (
    <>
      {(section === 'chat' || section === 'stories') && <Shell />}
      {section === 'diary' && <DiaryPage />}
      {section === 'calendar' && <CalendarPage />}
      {section === 'games' && <Suspense fallback={null}><GamesHub /></Suspense>}
      <Overlays />
    </>
  );
}

// Screens that load when first opened, fetched once the app has settled, so opening one is instant
// without slowing down the start.
function usePrefetch() {
  useEffect(() => {
    const bg = setTimeout(() => void import('../lib/apps').then((m) => m.runBackgrounds()), 6000);
    const t = setTimeout(() => {
      for (const load of [() => import('./settings/SettingsPanel'), () => import('./friends/FriendsPanel'), 
        () => import('./stories/StoryViewer'), () => import('./stories/StoryComposer'), () => import('./groups/GroupInfoPanel'), () => import('./games/GamesHub')]) load().catch(() => {});
    }, 4000);
    return () => { clearTimeout(t); clearTimeout(bg); };
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
