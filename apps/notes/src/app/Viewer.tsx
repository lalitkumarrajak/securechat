// A note a friend shared with you: read-only, with who wrote it. It changes when they change it, and
// goes if they stop sharing it or delete it.
import { ArrowLeft, Users } from 'lucide-react';
import { t } from '@sanga/i18n';
import { IconButton } from '@sanga/ui/button';
import { useNotes } from '../notes';
import { Avatar } from './Avatar';
import { dayLabel } from './dayLabel';
import { useChatName } from './useChatName';

export function Viewer({ noteKey, onDone }: { noteKey: string; onDone: () => void }) {
  const x = useNotes((s) => s.inbox[noteKey]);
  const chatName = useChatName();
  if (!x) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-panel md:border-l md:border-line">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-line/60 px-3"><IconButton label={t('Back to diary')} onClick={onDone}><ArrowLeft /></IconButton></header>
        <p className="p-8 text-center text-sm text-muted">{t('This note isn’t shared with you any more.')}</p>
      </div>
    );
  }
  const name = chatName(x.from);
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-panel md:border-l md:border-line">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-line/60 px-3">
        <IconButton label={t('Back to diary')} onClick={onDone}><ArrowLeft /></IconButton>
        <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">{dayLabel(x.day)}</h2>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="priv-scope mx-auto max-w-2xl px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-panel-2/60 py-1 pr-3 pl-1 text-sm">
            <Avatar u={x.from} name={name} size={22} />{t('From {name}', { name })}
          </p>
          {x.mood && <p className="mt-5 text-4xl" aria-label={t('Mood {emoji}', { emoji: x.mood })}>{x.mood}</p>}
          {x.title && <h3 className="priv mt-5 text-2xl font-bold tracking-tight md:text-3xl">{x.title}</h3>}
          <p className="priv mt-3 text-[1.05rem] leading-relaxed whitespace-pre-wrap">{x.text}</p>
          <p className="mt-6 flex items-center gap-1.5 text-xs text-muted"><Users className="size-3.5" />{t('Shared with you by {name}. Only they can change it.', { name })}</p>
        </div>
      </div>
    </div>
  );
}
