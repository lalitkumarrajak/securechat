import { CloudOff, NotebookPen } from 'lucide-react';
import { fmtClock } from '@sanga/ui/format';
import { cn } from '@sanga/ui/utils';
import type { Note } from '../notes';
import { Avatar } from './Avatar';

export function NoteCard({ n, active, showChat, chatName, onOpen }: { n: Note; active: boolean; showChat: boolean; chatName: (p: string) => string; onOpen: () => void }) {
  const lines = n.text.trim().split('\n');
  const head = n.title.trim() || lines[0] || (n.mood ? 'Mood' : 'Untitled');
  const rest = n.title.trim() ? n.text.trim() : lines.slice(1).join('\n').trim();
  return (
    <button onClick={onOpen} aria-current={active || undefined}
      className={cn('priv-scope mb-2 flex w-full items-start gap-3 rounded-2xl border bg-panel p-3.5 text-left shadow-sm transition hover:-translate-y-px hover:shadow-md',
        active ? 'border-accent ring-2 ring-accent/25' : 'border-line/70')}>
      <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl text-2xl', n.mood ? 'bg-amber-500/12' : 'bg-panel-2 text-muted')} aria-label={n.mood ? `Mood ${n.mood}` : undefined}>
        {n.mood || <NotebookPen className="size-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="priv block truncate font-semibold">{head}</span>
        {rest && <span className="priv mt-0.5 line-clamp-2 block text-sm whitespace-pre-wrap text-muted">{rest}</span>}
        <span className="mt-2 flex items-center gap-2 text-xs text-muted">
          {showChat && (
            <span className="flex min-w-0 items-center gap-1 rounded-full bg-panel-2 py-0.5 pr-2 pl-0.5">
              {n.chat ? <Avatar u={n.chat} name={chatName(n.chat)} size={16} /> : <NotebookPen className="ml-1 size-3" />}
              <span className="priv truncate">{chatName(n.chat)}</span>
            </span>
          )}
          <span>{fmtClock(n.edited)}</span>
          {n.dirty && <CloudOff className="size-3.5" aria-label="Not synced yet" />}
        </span>
      </span>
    </button>
  );
}
