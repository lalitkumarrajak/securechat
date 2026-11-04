// The tabs along the bottom once signed in: Chats, Stories, Calendar and Split, then More, a page with
// Sanga's other apps (Games, the Diary). Five tabs fit a phone.
import type { ReactNode } from 'react';
import { CalendarDays, CircleDashed, LayoutGrid, MessageCircle, Wallet } from 'lucide-react';
import { cn } from '@sanga/ui/utils';
import { myName } from '../../lib/engine';
import { go } from '../../lib/nav';
import { useStories } from '../../lib/stories';
import { useApp, type Section } from '../../state/app';
import { listed, useGames } from '../games/store';
import { Count } from './Count';
import { t, tk } from '@sanga/i18n';

/** Games waiting on me: my turn, or an invitation to answer. */
export function useGamesDue() {
  const games = useGames((s) => s.games);
  return listed(games).filter((g) => (g.status === 'play' && g.players[g.turn]?.u === myName())
    || (g.status === 'lobby' && g.players.find((p) => p.u === myName())?.state === 'invited')).length;
}

export function AppTabs() {
  const section = useApp((s) => s.section);
  const me = useApp((s) => s.me!.u);
  const unread = useApp((s) => s.chats.filter((c) => c.unread && !c.archived).length);
  const fresh = useStories((s) => s.list.some((x) => x.u !== me && !x.seen));
  const gamesDue = useGamesDue();

  const tab = (label: string, icon: ReactNode, selected: boolean, onClick: () => void, badge?: ReactNode) => (
    <button key={label} role="tab" aria-selected={selected} onClick={onClick}
      className={cn('relative flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1.5 text-xs font-medium transition', selected ? 'text-accent-ink' : 'text-muted hover:text-ink')}>
      <span className={cn('relative grid h-7 w-14 place-items-center rounded-full transition [&_svg]:size-5', selected && 'bg-accent/15')}>
        {icon}{badge}
      </span>
      {t(label)}
    </button>
  );
  const to = (s: Section) => () => go(s);
  return (
    <nav role="tablist" aria-label="Sanga" className="flex shrink-0 justify-center border-t border-line bg-panel pb-[env(safe-area-inset-bottom)] [&>*]:max-w-40">
      {tab(tk('Chats'), <MessageCircle />, section === 'chat', to('chat'), unread > 0 && <Count n={unread} />)}
      {tab(tk('Stories'), <CircleDashed />, section === 'stories', to('stories'),
        fresh && <span className="absolute top-0 right-3 size-2.5 rounded-full border-2 border-panel bg-accent" aria-label={t('New stories')} />)}
      {tab(tk('Calendar'), <CalendarDays />, section === 'calendar', to('calendar'))}
      {tab(tk('Split'), <Wallet />, section === 'split', to('split'))}
      {/* Games and the Diary are opened from More's page, and More stays lit while you're in them. */}
      {tab(tk('More'), <LayoutGrid />, section === 'more' || section === 'games' || section === 'diary', to('more'), gamesDue > 0 && <Count n={gamesDue} />)}
    </nav>
  );
}
