// Making a story: a photo with a caption, or a few words on a colour. Tag friends in it, and choose
// who sees it: all your friends, or only the ones you pick.
import * as D from '@radix-ui/react-dialog';
import { useStories } from '../../lib/stories';
import { Composer } from './story-composer/Composer';

export function StoryComposer() {
  const c = useStories((s) => s.composer);
  const close = () => useStories.setState({ composer: null });
  return (
    <D.Root open={!!c} onOpenChange={(o) => !o && close()}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black animate-fade-in" />
        <D.Content className="fixed inset-0 z-50 flex justify-center bg-black text-white outline-none" aria-describedby={undefined}
          onPointerDownOutside={(e) => e.preventDefault()} /* e.g. answering a call: keep the story being made */>
          <D.Title className="sr-only">New story</D.Title>
          {c && <Composer prefill={c.prefill} onClose={close} />}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
