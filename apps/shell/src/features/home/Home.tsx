// The home screen once signed in: a tile for each Sanga app, then recent chats and your games.
import type { CSSProperties, ReactNode } from 'react';
import { ArrowRight, Gamepad2, MessageCircle, NotebookPen, UserPlus, Wallet, WifiOff } from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import { IconButton } from '@sanga/ui/button';
import { cn } from '@sanga/ui/utils';
import { myName, openChat } from '../../lib/engine';
import { go } from '../../lib/nav';
import { openNotes } from '../../lib/notes';
import { displayName, isGroup, groupIdOf } from '../../lib/types';
import { setApp, useApp } from '../../state/app';
import { listed, openGame, useGames } from '../games/store';
import { GAME_UI } from '../games/registry';

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function Home() {
  const me = useApp((s) => s.me)!;
  const conn = useApp((s) => s.conn);
  const incoming = useApp((s) => s.incoming.length);
  const chats = useApp((s) => s.chats);
  const games = useGames((s) => s.games);
  const active = chats.filter((c) => c.ts && !c.archived);
  const unread = active.reduce((n, c) => n + (c.unread ? 1 : 0), 0);
  const mine = listed(games);
  const myTurn = mine.filter((g) => g.status === 'play' && g.players[g.turn]?.u === myName()).length;
  const invites = mine.filter((g) => g.status === 'lobby' && g.players.find((p) => p.u === myName())?.state === 'invited').length;
  const first = (me.name || me.u).split(' ')[0];

  return (
    <div className="relative h-[var(--app-h,100dvh)] overflow-y-auto bg-bg">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-80 opacity-70"
        style={{ background: 'radial-gradient(60% 100% at 15% 0%, color-mix(in oklab, var(--accent) 22%, transparent), transparent 70%), radial-gradient(50% 80% at 90% 10%, color-mix(in oklab, #6366f1 16%, transparent), transparent 70%)' }} />
      <div className="relative mx-auto max-w-5xl px-4 pb-12 md:px-8">
        <header className="flex h-16 items-center gap-2">
          <img src="/logo.svg" alt="" className="size-9 rounded-xl" />
          <span className="flex-1 text-xl font-bold tracking-tight">Sanga</span>
          <div className="relative">
            <IconButton label="Friends" onClick={() => setApp({ panel: 'friends', friendsTab: incoming ? 'requests' : 'friends' })}><UserPlus /></IconButton>
            {incoming > 0 && <span className="pointer-events-none absolute top-0.5 right-0.5 grid min-w-[18px] place-items-center rounded-full bg-danger px-1 text-[11px] font-bold leading-[18px] text-white">{incoming}</span>}
          </div>
          <button type="button" aria-label="Profile and settings" onClick={() => setApp({ panel: 'settings' })}
            className="ml-1 rounded-full ring-2 ring-transparent transition hover:ring-accent/40">
            <Avatar u={me.u} name={me.name} size={36} />
          </button>
        </header>

        {conn === 'offline' && (
          <div className="mt-2 flex items-center gap-2 rounded-xl bg-warn px-3 py-2 text-sm" role="status">
            <WifiOff className="size-4" /> You’re offline. Things will update when you reconnect.
          </div>
        )}

        <section className="pt-6 pb-8 md:pt-10">
          <p className="text-sm font-medium text-muted">{greeting()},</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">{first} 👋</h1>
          <p className="mt-2 text-muted">What would you like to do today?</p>
        </section>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <Tile title="Chat" icon={<MessageCircle />} onClick={() => go('chat')}
            text="Messages, stories and calls"
            stat={unread ? `${unread} unread chat${unread > 1 ? 's' : ''}` : 'All caught up'} hot={unread > 0}
            style={{ background: 'linear-gradient(140deg, var(--accent), color-mix(in oklab, var(--accent) 50%, #0b1324))' }} />
          <Tile title="Games" icon={<Gamepad2 />} onClick={() => go('games')}
            text="Ludo and UNO with friends"
            stat={myTurn ? `Your turn in ${myTurn}` : invites ? `${invites} invite${invites > 1 ? 's' : ''}` : 'Play now'} hot={myTurn + invites > 0}
            style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0 1.5px, transparent 2px) 0 0 / 22px 22px, linear-gradient(140deg, #6366f1, #312e81)' }} />
          <Tile title="Diary" icon={<NotebookPen />} onClick={() => openNotes()}
            text="Private notes, just for you" stat="Write something"
            style={{ background: 'linear-gradient(140deg, #f59e0b, #b45309)' }} />
          <Tile title="Split" icon={<Wallet />} soon
            text="Share bills with friends" stat="Coming soon"
            style={{ background: 'linear-gradient(140deg, #64748b, #334155)' }} />
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Card title="Recent chats" action="Open Chat" onAction={() => go('chat')}>
            {active.length === 0 ? (
              <Empty text="No chats yet. Add a friend to start talking."
                button="Add a friend" onClick={() => setApp({ panel: 'friends', friendsTab: 'add' })} />
            ) : (
              <ul>{active.slice(0, 4).map((c) => <RecentChat key={c.peer} peer={c.peer} unread={c.unread} />)}</ul>
            )}
          </Card>
          <Card title="Your games" action="All games" onAction={() => go('games')}>
            {mine.length === 0 ? (
              <Empty text="No games going on. Start one with friends or computer players." button="Play a game" onClick={() => go('games')} />
            ) : (
              <ul>
                {mine.slice(0, 4).map((g) => {
                  const ui = GAME_UI[g.type];
                  const turn = g.status === 'play' && g.players[g.turn]?.u === myName();
                  const others = g.players.filter((p) => p.u !== myName() && p.state !== 'declined').map((p) => p.n || p.u);
                  return (
                    <li key={g.id}>
                      <button type="button" onClick={() => openGame(g.id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-hover">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl text-xl" style={{ background: ui?.background }} aria-hidden>{ui?.emoji}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{ui?.name || 'Game'}{others.length ? ` with ${others.join(', ')}` : ''}</span>
                          <span className={cn('block text-sm', turn ? 'font-semibold text-accent-ink' : 'text-muted')}>
                            {g.status === 'lobby' ? 'Waiting room' : g.status === 'over' ? 'Finished' : turn ? 'Your turn!' : 'In progress'}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Tile({ title, text, stat, icon, onClick, style, hot, soon }: {
  title: string; text: string; stat: string; icon: ReactNode; style: CSSProperties; onClick?: () => void; hot?: boolean; soon?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={soon} aria-label={soon ? `${title} (coming soon)` : title} style={style}
      className={cn('group relative flex min-h-44 flex-col overflow-hidden rounded-3xl p-4 text-left text-white shadow-lg shadow-black/10 transition md:min-h-52 md:p-5',
        soon ? 'cursor-default opacity-70' : 'hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0')}>
      <span aria-hidden className="absolute -right-6 -bottom-6 size-28 rounded-full bg-white/10" />
      <span className="grid size-11 place-items-center rounded-2xl bg-white/20 backdrop-blur-sm [&_svg]:size-6">{icon}</span>
      <span className="mt-auto pt-4">
        <span className="block text-lg font-bold md:text-xl">{title}</span>
        <span className="mt-0.5 block text-sm leading-snug text-white/80">{text}</span>
        <span className={cn('mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold', hot ? 'bg-white text-slate-900' : 'bg-black/20')}>
          {stat}{!soon && <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />}
        </span>
      </span>
    </button>
  );
}

function Card({ title, action, onAction, children }: { title: string; action: string; onAction: () => void; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-panel p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between px-2">
        <h2 className="font-semibold">{title}</h2>
        <button type="button" onClick={onAction} className="text-sm font-medium text-accent-ink hover:underline">{action}</button>
      </div>
      {children}
    </section>
  );
}

function Empty({ text, button, onClick }: { text: string; button: string; onClick: () => void }) {
  return (
    <div className="px-2 py-6 text-center">
      <p className="text-sm text-muted">{text}</p>
      <button type="button" onClick={onClick} className="mt-3 rounded-full bg-accent/12 px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent/20">{button}</button>
    </div>
  );
}

function RecentChat({ peer, unread }: { peer: string; unread: number }) {
  const friend = useApp((s) => s.friends[peer]);
  const group = useApp((s) => (isGroup(peer) ? s.groups[groupIdOf(peer)] : undefined));
  const name = isGroup(peer) ? group?.name || 'Group' : displayName(friend, peer);
  return (
    <li className="priv-scope">
      <button type="button" onClick={() => openChat(peer)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-hover">
        <Avatar u={peer} name={name} size={40} className="priv" />
        <span className={cn('priv min-w-0 flex-1 truncate', unread ? 'font-semibold' : 'font-medium')}>{name}</span>
        {unread > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-accent px-1.5 text-xs font-bold text-white">{unread}</span>}
      </button>
    </li>
  );
}
