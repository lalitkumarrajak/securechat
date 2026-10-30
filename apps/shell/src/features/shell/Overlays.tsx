import { lazy, Suspense } from 'react';
import { useApp } from '../../state/app';
import { ContactPanel } from '../conversation/ContactPanel';
import { PhotoViewer } from '../conversation/PhotoViewer';
import { ProfileCard } from '../friends/ProfileCard';
import { PhotoGallery } from '../conversation/PhotoGallery';
import { NewGameDialog } from '../games/NewGameDialog';
import { useGames } from '../games/store';
import { CallScreen } from '../calls/CallScreen';
import { useStories } from '../../lib/stories';

// Loaded when a game is opened, so the app starts faster.
const GameScreen = lazy(() => import('../games/GameScreen').then((m) => ({ default: m.GameScreen })));
const FriendsPanel = lazy(() => import('../friends/FriendsPanel').then((m) => ({ default: m.FriendsPanel })));
const SettingsPanel = lazy(() => import('../settings/SettingsPanel').then((m) => ({ default: m.SettingsPanel })));
const GroupInfoPanel = lazy(() => import('../groups/GroupInfoPanel').then((m) => ({ default: m.GroupInfoPanel })));
const NewGroupPanel = lazy(() => import('../groups/NewGroupPanel').then((m) => ({ default: m.NewGroupPanel })));
const StoryViewer = lazy(() => import('../stories/StoryViewer').then((m) => ({ default: m.StoryViewer })));
const StoryComposer = lazy(() => import('../stories/StoryComposer').then((m) => ({ default: m.StoryComposer })));

export function Overlays() {
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
