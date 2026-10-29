// The Stories tab in Chat: your story, then friends' stories, new ones first.
import { useMemo } from 'react';
import { Lock, Plus } from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import { fmtAgo } from '@sanga/ui/format';
import { displayName } from '../../lib/types';
import { cn } from '@sanga/ui/utils';
import { openComposer, openStories, rings, useStories, type Ring } from '../../lib/stories';
import { useApp } from '../../state/app';
import { StoryRing } from './StoryRing';

export function StoriesList() {
  const list = useStories((s) => s.list);
  const me = useApp((s) => s.me!);
  const all = useMemo(() => rings(list, me.u), [list, me.u]);
  const mine = all.find((r) => r.u === me.u);
  const fresh = all.filter((r) => r.u !== me.u && r.unseen);
  const seen = all.filter((r) => r.u !== me.u && !r.unseen);

  return (
    <div role="region" aria-label="Stories" className="flex min-h-full flex-col pt-2 pb-6">
      <h1 className="sr-only">Stories</h1>
      {/* Centred: your photo (tap to see your story), its + to add one, and how many you have. */}
      <div className="flex flex-col items-center px-4 pt-4 pb-2 text-center">
        <span className="relative">
          <button onClick={() => (mine ? openStories(me.u) : openComposer())} aria-label={mine ? 'Your story' : 'Add to your story'} className="rounded-full">
            <StoryRing state={mine ? 'seen' : 'none'}><Avatar u={me.u} name={me.name} size={72} /></StoryRing>
          </button>
          <button onClick={() => openComposer()} aria-label="New story"
            className="absolute right-0 bottom-0 grid size-7 place-items-center rounded-full border-2 border-panel bg-accent text-white hover:brightness-110">
            <Plus className="size-4" strokeWidth={3} />
          </button>
        </span>
        <span className="mt-2 font-semibold">My story</span>
        <span className="text-sm text-muted">
          {mine ? `${mine.stories.length} stor${mine.stories.length === 1 ? 'y' : 'ies'} · ${fmtAgo(mine.last)}` : 'Tap to share a photo or a few words'}
        </span>
      </div>

      {fresh.length > 0 && <Section title="Recent" rows={fresh} />}
      {seen.length > 0 && <Section title="Viewed" rows={seen} />}
      {/* With nothing from friends, the note sits in the middle of the space below "My story". */}
      <div className={cn('flex flex-col items-center justify-center gap-3 px-6 text-center', fresh.length + seen.length === 0 ? 'flex-1 pb-16' : 'mt-4')}>
        {fresh.length + seen.length === 0 && (
          <p className="max-w-xs text-sm text-muted">No stories from friends right now. When they share one, it shows up here for 24 hours.</p>
        )}
        <p className="flex items-center gap-1.5 text-xs text-muted"><Lock className="size-3.5" /> Stories are end-to-end encrypted</p>
      </div>
    </div>
  );
}

function Section({ title, rows }: { title: string; rows: Ring[] }) {
  const friends = useApp((s) => s.friends);
  return (
    <section>
      <h2 className="px-4 pt-4 pb-1 text-xs font-semibold tracking-wide text-muted uppercase">{title}</h2>
      <ul>
        {rows.map((r) => {
          const name = displayName(friends[r.u], r.u);
          return (
            <li key={r.u}>
              <button onClick={() => openStories(r.u)} aria-label={`${name}’s story${r.unseen ? ', new' : ''}`}
                className="priv-scope flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-hover">
                <StoryRing state={r.unseen ? 'new' : 'seen'}><Avatar u={r.u} name={name} size={50} className="priv" /></StoryRing>
                <span className="min-w-0">
                  <span className={cn('priv block truncate', r.unseen ? 'font-semibold' : 'font-medium')}>{name}</span>
                  <span className="block text-sm text-muted">{fmtAgo(r.last)}{r.unseen ? ` · ${r.unseen} new` : ''}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
