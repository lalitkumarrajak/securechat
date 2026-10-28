// The tabs along the bottom once signed in: Chats and Stories, then Sanga's other apps. Chat is the
// main screen; Games, the Diary and the Calendar are a tap away.
import type { ReactNode } from 'react';
import { CalendarDays, CircleDashed, Gamepad2, MessageCircle, NotebookPen } from 'lucide-react';
import { cn } from '@sanga/ui/utils';
import { myName } from '../../lib/engine';
import { go } from '../../lib/nav';
import { useStories } from '../../lib/stories';
import { setApp, useApp, type Section } from '../../state/app';
import { listed, useGames } from '../games/store';

const Count = ({ n }: { n: number }) => (
  <span className="absolute -top-1 right-1 grid min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[11px] leading-[18px] font-bold text-white">{n}</span>
);

export function AppTabs() {
  const section = useApp((s) => s.section);
  const me = useApp((s) => s.me!.u);
  const unread = useApp((s) => s.chats.filter((c) => c.unread && !c.archived).length);
  const fresh = useStories((s) => s.list.some((x) => x.u !== me && !x.seen));
  const games = useGames((s) => s.games);
  const gamesDue = listed(games).filter((g) => (g.status === 'play' && g.players[g.turn]?.u === myName())
    || (g.status === 'lobby' && g.players.find((p) => p.u === myName())?.state === 'invited')).length;

  const tab = (label: string, icon: ReactNode, selected: boolean, onClick: () => void, badge?: ReactNode) => (
    <button key={label} role="tab" aria-selected={selected} onClick={onClick}
      className={cn('relative flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1.5 text-xs font-medium transition', selected ? 'text-accent-ink' : 'text-muted hover:text-ink')}>
      <span className={cn('relative grid h-7 w-14 place-items-center rounded-full transition [&_svg]:size-5', selected && 'bg-accent/15')}>
        {icon}{badge}
      </span>
      {label}
    </button>
  );
  const to = (s: Section) => () => go(s);
  return (
    <nav role="tablist" aria-label="Sanga" className="flex shrink-0 justify-center border-t border-line bg-panel pb-[env(safe-area-inset-bottom)] [&>*]:max-w-40">
      {tab('Chats', <MessageCircle />, section === 'chat', to('chat'), unread > 0 && <Count n={unread} />)}
      {tab('Stories', <CircleDashed />, section === 'stories', to('stories'),
        fresh && <span className="absolute top-0 right-3 size-2.5 rounded-full border-2 border-panel bg-accent" aria-label="New stories" />)}
      {tab('Games', <Gamepad2 />, section === 'games', to('games'), gamesDue > 0 && <Count n={gamesDue} />)}
      {tab('Diary', <NotebookPen />, section === 'diary', () => { setApp({ notesChat: null }); go('diary'); })}
      {tab('Calendar', <CalendarDays />, section === 'calendar', to('calendar'))}
    </nav>
  );
}
