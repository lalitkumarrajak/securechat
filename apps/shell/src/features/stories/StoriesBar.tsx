// Stories, at the top of Chats (there's no Stories tab): your story first (its + adds one), then friends
// with something new (a colourful ring), then the ones you've seen (grey). Tap one to watch. It scrolls
// sideways on its own, and away with the chats.
import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import { displayName } from '../../lib/types';
import { openComposer, openStories, rings, useStories } from '../../lib/stories';
import { useApp } from '../../state/app';
import { StoryRing } from './StoryRing';
import { t } from '@sanga/i18n';

export function StoriesBar() {
  const list = useStories((s) => s.list);
  const me = useApp((s) => s.me!);
  const friends = useApp((s) => s.friends);
  const all = useMemo(() => rings(list, me.u), [list, me.u]);
  const mine = all.find((r) => r.u === me.u);
  const others = all.filter((r) => r.u !== me.u);

  return (
    <div role="region" aria-label={t('Stories')} className="flex gap-3 overflow-x-auto overscroll-x-contain px-3 pt-1 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex w-16 shrink-0 flex-col items-center gap-1">
        <span className="relative">
          <button onClick={() => (mine ? openStories(me.u) : openComposer())} aria-label={mine ? t('Your story') : t('Add to your story')} className="rounded-full">
            <StoryRing state={mine ? 'seen' : 'none'}><Avatar u={me.u} name={me.name} size={56} /></StoryRing>
          </button>
          <button onClick={() => openComposer()} aria-label={t('New story')}
            className="absolute right-0 bottom-0 grid size-5 place-items-center rounded-full border-2 border-panel bg-accent text-white hover:brightness-110">
            <Plus className="size-3" strokeWidth={3} />
          </button>
        </span>
        <span className="w-full truncate text-center text-xs text-muted">{t('Your story')}</span>
      </div>
      {others.map((r) => {
        const name = displayName(friends[r.u], r.u);
        return (
          <button key={r.u} onClick={() => openStories(r.u)} aria-label={r.unseen ? t('{name}’s story, new', { name }) : t('{name}’s story', { name })}
            className="priv-scope flex w-16 shrink-0 flex-col items-center gap-1">
            <StoryRing state={r.unseen ? 'new' : 'seen'}><Avatar u={r.u} name={name} size={56} className="priv" /></StoryRing>
            <span className={`priv w-full truncate text-center text-xs ${r.unseen ? 'font-semibold text-ink' : 'text-muted'}`}>{name}</span>
          </button>
        );
      })}
    </div>
  );
}
