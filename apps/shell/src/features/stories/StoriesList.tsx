// The Stories tab in Chat: your story, then friends' stories, new ones first.
import { useMemo } from 'react';
import { Camera, Lock, Plus } from 'lucide-react';
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
    <div role="region" aria-label="Stories" className="pt-2 pb-6">
      <h1 className="sr-only">Stories</h1>
      <div className="flex items-center gap-3 px-3 py-2">
        <button onClick={() => (mine ? openStories(me.u) : openComposer())} aria-label={mine ? 'Your story' : 'Add to your story'}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left">
          <span className="relative">
            <StoryRing state={mine ? 'seen' : 'none'}><Avatar u={me.u} name={me.name} size={50} /></StoryRing>
            {!mine && <span className="absolute right-0 bottom-0 grid size-5 place-items-center rounded-full border-2 border-panel bg-accent text-white"><Plus className="size-3" strokeWidth={3} /></span>}
          </span>
          <span className="min-w-0">
            <span className="block font-semibold">My story</span>
            <span className="block truncate text-sm text-muted">
              {mine ? `${mine.stories.length} stor${mine.stories.length === 1 ? 'y' : 'ies'} · ${fmtAgo(mine.last)}` : 'Tap to share a photo or a few words'}
            </span>
          </span>
        </button>
        <button onClick={() => openComposer()} aria-label="New story"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-accent/12 text-accent-ink hover:bg-accent/20">
          <Camera className="size-5" />
        </button>
      </div>

      {fresh.length > 0 && <Section title="Recent" rows={fresh} />}
      {seen.length > 0 && <Section title="Viewed" rows={seen} />}
      {fresh.length + seen.length === 0 && (
        <p className="px-6 py-10 text-center text-sm text-muted">No stories from friends right now. When they share one, it shows up here for 24 hours.</p>
      )}
      <p className="mt-2 flex items-center justify-center gap-1.5 px-4 text-xs text-muted"><Lock className="size-3.5" /> Stories are end-to-end encrypted</p>
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
