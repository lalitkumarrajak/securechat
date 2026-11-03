import { Avatar } from '../../components/Avatar';
import { fmtAgo } from '@sanga/ui/format';
import { displayName } from '../../lib/types';
import { cn } from '@sanga/ui/utils';
import { openStories, type Ring } from '../../lib/stories';
import { useApp } from '../../state/app';
import { StoryRing } from './StoryRing';
import { t } from '@sanga/i18n';

export function Section({ title, rows }: { title: string; rows: Ring[] }) {
  const friends = useApp((s) => s.friends);
  return (
    <section>
      <h2 className="px-4 pt-4 pb-1 text-xs font-semibold tracking-wide text-muted uppercase">{title}</h2>
      <ul>
        {rows.map((r) => {
          const name = displayName(friends[r.u], r.u);
          return (
            <li key={r.u}>
              <button onClick={() => openStories(r.u)} aria-label={r.unseen ? t('{name}’s story, new', { name }) : t('{name}’s story', { name })}
                className="priv-scope flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-hover">
                <StoryRing state={r.unseen ? 'new' : 'seen'}><Avatar u={r.u} name={name} size={50} className="priv" /></StoryRing>
                <span className="min-w-0">
                  <span className={cn('priv block truncate', r.unseen ? 'font-semibold' : 'font-medium')}>{name}</span>
                  <span className="block text-sm text-muted">{r.unseen ? t('{ago} · {n} new', { ago: fmtAgo(r.last), n: r.unseen }) : fmtAgo(r.last)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
