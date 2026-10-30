// Stories full screen: each plays for a few seconds, then the next, then the next friend's.
// Tap the right side for the next one, the left for the one before; hold to pause; swipe down to close.
// Friends' stories can be liked and commented on; on your own you see who viewed, liked and commented.
import * as D from '@radix-ui/react-dialog';
import { closeStories, useStories } from '../../lib/stories';
import { Player } from './story-viewer/Player';

export function StoryViewer() {
  const open = useStories((s) => !!s.viewer);
  return (
    <D.Root open={open} onOpenChange={(o) => !o && closeStories()}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black animate-fade-in" />
        <D.Content className="fixed inset-0 z-50 flex justify-center bg-black text-white outline-none" aria-describedby={undefined}>
          <D.Title className="sr-only">Stories</D.Title>
          {open && <Player />}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
