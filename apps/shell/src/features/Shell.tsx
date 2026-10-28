import { lazy, Suspense, useEffect } from 'react';
import { cn } from '@sanga/ui/utils';
import { useApp } from '../state/app';
import { Sidebar } from './sidebar/Sidebar';
import { ChatPane, EmptyPane } from './conversation/ChatPane';
import { ContactPanel } from './conversation/ContactPanel';
import { PhotoViewer } from './conversation/ChatDialogs';
import { ProfileCard } from './friends/ProfileCard';
import { PhotoGallery } from './conversation/PhotoGallery';
import { NewGameDialog } from './games/NewGameDialog';
import { useGames } from './games/store';
import { CallScreen } from './calls/CallScreen';
import { useStories } from '../lib/stories';

// Loaded when a game is opened, so the app starts faster.
const GameScreen = lazy(() => import('./games/GameScreen').then((m) => ({ default: m.GameScreen })));
const FriendsPanel = lazy(() => import('./friends/FriendsPanel').then((m) => ({ default: m.FriendsPanel })));
const SettingsPanel = lazy(() => import('./settings/SettingsPanel').then((m) => ({ default: m.SettingsPanel })));
const GroupInfoPanel = lazy(() => import('./groups/GroupInfoPanel').then((m) => ({ default: m.GroupInfoPanel })));
const NewGroupPanel = lazy(() => import('./groups/NewGroupPanel').then((m) => ({ default: m.NewGroupPanel })));
const StoryViewer = lazy(() => import('./stories/StoryViewer').then((m) => ({ default: m.StoryViewer })));
const StoryComposer = lazy(() => import('./stories/StoryComposer').then((m) => ({ default: m.StoryComposer })));
const GamesHub = lazy(() => import('./games/GamesHub').then((m) => ({ default: m.GamesHub })));
import { handleInvite } from '../lib/invite';
import { DiaryPage } from './notes/DiaryPage';
import { CalendarPage } from './calendar/CalendarPage';

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

/** Chat: two panes on desktop; on phones, the chat list or the open chat. */
function Shell() {
  const active = useApp((s) => s.active);
  return (
    <div className="mx-auto flex h-[var(--app-h,100dvh)] max-w-[1600px] overflow-hidden bg-panel md:border-x md:border-line">
      <aside className={cn('flex w-full flex-col border-line bg-panel md:w-[360px] md:shrink-0 md:border-r lg:w-[400px]', active && 'hidden md:flex')}>
        <Sidebar />
      </aside>
      <main className={cn('min-w-0 flex-1 flex-col', active ? 'flex' : 'hidden md:flex')}>
        {active ? <ChatPane key={active} peer={active} /> : <EmptyPane />}
      </main>
    </div>
  );
}

function Overlays() {
  const gameOpen = useGames((s) => !!s.open);
  const panel = useApp((s) => s.panel);
  const storyOpen = useStories((s) => !!s.viewer);
  const composing = useStories((s) => !!s.composer);
  return (
    <>
      <ContactPanel />
      <Suspense fallback={null}>
        {panel === 'friends' && <FriendsPanel />}
        {panel === 'settings' && <SettingsPanel />}
        {panel === 'group' && <GroupInfoPanel />}
        {panel === 'newgroup' && <NewGroupPanel />}
        {storyOpen && <StoryViewer />}
        {composing && <StoryComposer />}
      </Suspense>
      <NewGameDialog />
      <ProfileCard />
      <PhotoViewer />
      <PhotoGallery />
      {gameOpen && <Suspense fallback={null}><GameScreen /></Suspense>}
      <CallScreen />
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
