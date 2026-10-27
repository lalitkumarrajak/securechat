// Friends' stories as a row of photos at the top of the chat list, like Instagram and WhatsApp.
// A coloured ring means there's something you haven't seen yet.
import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import { displayName } from '../../lib/types';
import { cn } from '../../lib/utils';
import { openComposer, openStories, rings, useStories } from '../../lib/stories';
import { useApp } from '../../state/app';

export function StoriesStrip() {
  const list = useStories((s) => s.list);
  const me = useApp((s) => s.me!);
  const friends = useApp((s) => s.friends);
  const all = useMemo(() => rings(list, me.u), [list, me.u]);
  const mine = all.find((r) => r.u === me.u);
  const others = all.filter((r) => r.u !== me.u);

  return (
    <div className="flex gap-1 overflow-x-auto border-b border-line px-2 pt-1 pb-2" role="list" aria-label="Stories">
      <div role="listitem" className="relative flex w-[72px] shrink-0 flex-col items-center gap-1">
        <button onClick={() => (mine ? openStories(me.u) : openComposer())} aria-label={mine ? 'Your story' : 'Add to your story'} className="rounded-full">
          <StoryRing state={mine ? 'seen' : 'none'}><Avatar u={me.u} name={me.name} size={56} /></StoryRing>
        </button>
        <button onClick={() => openComposer()} aria-label="New story"
          className="absolute top-[42px] right-1.5 grid size-6 place-items-center rounded-full border-2 border-panel bg-accent text-white">
          <Plus className="size-3.5" strokeWidth={3} />
        </button>
        <span className="w-full truncate text-center text-xs text-muted">Your story</span>
      </div>
      {others.map((r) => {
        const name = displayName(friends[r.u], r.u);
        return (
          <div key={r.u} role="listitem" className="shrink-0">
            <button onClick={() => openStories(r.u)} aria-label={`${name}’s story${r.unseen ? ', new' : ''}`}
              className="priv-scope flex w-[72px] flex-col items-center gap-1">
              <StoryRing state={r.unseen ? 'new' : 'seen'}><Avatar u={r.u} name={name} size={56} className="priv" /></StoryRing>
              <span className={cn('priv w-full truncate text-center text-xs', r.unseen ? 'font-medium' : 'text-muted')}>{name}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** The ring around a story's photo: colourful when new, grey when seen. */
export function StoryRing({ state, children }: { state: 'new' | 'seen' | 'none'; children: React.ReactNode }) {
  return (
    <span className="grid rounded-full p-[3px]"
      style={{ background: state === 'new' ? 'conic-gradient(from 210deg,#14b8a6,#6366f1,#ec4899,#f59e0b,#14b8a6)' : state === 'seen' ? 'var(--border)' : 'transparent' }}>
      <span className="grid rounded-full bg-panel p-[2px]">{children}</span>
    </span>
  );
}
