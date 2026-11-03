// The Stories tab in Chat: your story, then friends' stories, new ones first.
import { useMemo } from 'react';
import { Lock, Plus } from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import { fmtAgo } from '@sanga/ui/format';
import { cn } from '@sanga/ui/utils';
import { openComposer, openStories, rings, useStories } from '../../lib/stories';
import { useApp } from '../../state/app';
import { StoryRing } from './StoryRing';
import { Section } from './Section';
import { t, tn } from '@sanga/i18n';

export function StoriesList() {
  const list = useStories((s) => s.list);
  const me = useApp((s) => s.me!);
  const all = useMemo(() => rings(list, me.u), [list, me.u]);
  const mine = all.find((r) => r.u === me.u);
  const fresh = all.filter((r) => r.u !== me.u && r.unseen);
  const seen = all.filter((r) => r.u !== me.u && !r.unseen);

  return (
    <div role="region" aria-label={t('Stories')} className="flex min-h-full flex-col pt-2 pb-6">
      <h1 className="sr-only">{t('Stories')}</h1>
      {/* Your photo (tap to see your story; its + adds one), then how many you have. */}
      <div className="flex items-center gap-3 px-3 py-2">
        <span className="relative shrink-0">
          <button onClick={() => (mine ? openStories(me.u) : openComposer())} aria-label={mine ? t('Your story') : t('Add to your story')} className="rounded-full">
            <StoryRing state={mine ? 'seen' : 'none'}><Avatar u={me.u} name={me.name} size={50} /></StoryRing>
          </button>
          <button onClick={() => openComposer()} aria-label={t('New story')}
            className="absolute right-0 bottom-0 grid size-5 place-items-center rounded-full border-2 border-panel bg-accent text-white hover:brightness-110">
            <Plus className="size-3" strokeWidth={3} />
          </button>
        </span>
        <button onClick={() => (mine ? openStories(me.u) : openComposer())} className="min-w-0 flex-1 text-left">
          <span className="block font-semibold">{t('My story')}</span>
          <span className="block truncate text-sm text-muted">
            {mine ? tn(mine.stories.length, '{n} story · {ago}', '{n} stories · {ago}', { ago: fmtAgo(mine.last) }) : t('Tap to share a photo or a few words')}
          </span>
        </button>
      </div>

      {fresh.length > 0 && <Section title={t('Recent')} rows={fresh} />}
      {seen.length > 0 && <Section title={t('Viewed')} rows={seen} />}
      {/* With nothing from friends, the note sits in the middle of the space below "My story". */}
      <div className={cn('flex flex-col items-center justify-center gap-3 px-6 text-center', fresh.length + seen.length === 0 ? 'flex-1 pb-16' : 'mt-4')}>
        {fresh.length + seen.length === 0 && (
          <p className="max-w-xs text-sm text-muted">{t('No stories from friends right now. When they share one, it shows up here for 24 hours.')}</p>
        )}
        <p className="flex items-center gap-1.5 text-xs text-muted"><Lock className="size-3.5" /> {t('Stories are end-to-end encrypted')}</p>
      </div>
    </div>
  );
}
