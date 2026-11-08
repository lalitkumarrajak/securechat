// Games in the lists. On Chats: only the games that need you (invites, waiting rooms, games being
// played), small, at most two, with "See all" to the Games page. On the Games page: those, then the
// finished ones with their result, each one clearable.
import { ChevronRight, Gamepad2, X } from 'lucide-react';
import { cn } from '@sanga/ui/utils';
import { t } from '@sanga/i18n';
import { myName } from '../../lib/engine';
import { go } from '../../lib/nav';
import { GAME_UI } from './registry';
import { decline, dismiss, join, listed, meIn, nameOf, openGame, useGames, type Game } from './store';

const place = (n: number) => {
  const sfx = ['th', 'st', 'nd', 'rd'][n] || 'th';
  return sfx === 'st' ? t('You came {n}st', { n }) : sfx === 'nd' ? t('You came {n}nd', { n }) : sfx === 'rd' ? t('You came {n}rd', { n }) : t('You came {n}th', { n });
};

function status(g: Game) {
  const me = meIn(g);
  if (g.status === 'lobby') {
    if (me?.state === 'invited') return t('{name} invited you', { name: nameOf(g, g.host) });
    const n = g.players.filter((p) => p.state === 'joined').length;
    return t('Waiting for players · {n} ready', { n });
  }
  if (g.status === 'over') {
    if (g.ev.some((e) => e.k === 'draw') || (g.players.filter((p) => p.rank === 1).length > 1)) return t('It’s a draw 🤝');
    if (me?.rank === 1) return t('You won! 🏆');
    const winner = g.players.find((p) => p.rank === 1);
    if (winner && g.players.length === 2) return t('{name} won', { name: nameOf(g, winner.u) });
    return me?.rank ? place(me.rank) : t('Game over');
  }
  if (me?.state !== 'playing') return me?.rank ? t('You finished {rank}', { rank: me.rank }) : t('Watching');
  return g.players[g.turn]?.u === myName() ? t('Your turn!') : t('{name}’s turn', { name: nameOf(g, g.players[g.turn]?.u) });
}

function Row({ g, unread, compact }: { g: Game; unread: number; compact?: boolean }) {
  const ui = GAME_UI[g.type];
  const game = ui ? t(ui.name) : t('Game');
  const others = g.players.filter((p) => p.u !== myName() && p.state !== 'declined').map((p) => p.n || p.u);
  const invited = g.status === 'lobby' && meIn(g)?.state === 'invited';
  const yourTurn = g.status === 'play' && g.players[g.turn]?.u === myName();
  const over = g.status === 'over';
  return (
    <li className={cn('flex items-center gap-3 hover:bg-hover', compact ? 'px-3 py-2' : 'px-4 py-3')}>
      <button type="button" onClick={() => openGame(g.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className={cn('grid shrink-0 place-items-center rounded-xl', compact ? 'size-10 text-xl' : 'size-12 text-2xl', over && 'opacity-70')} style={{ background: ui?.background }} aria-hidden>{ui?.emoji}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">{game}{others.length ? <span className="font-normal text-muted"> · {others.join(', ')}</span> : null}</span>
          <span className={cn('block truncate text-sm', yourTurn || invited ? 'font-semibold text-accent-ink' : 'text-muted')}>{status(g)}</span>
        </span>
        {unread ? <span className="grid min-w-5 place-items-center rounded-full bg-accent px-1.5 text-xs font-bold text-white">{unread}</span> : null}
      </button>
      {invited ? (
        <span className="flex gap-1.5">
          <button type="button" onClick={() => decline(g.id)} className="rounded-full border border-line px-3 py-1.5 text-sm hover:bg-panel">{t('Decline')}</button>
          <button type="button" onClick={() => { join(g.id); openGame(g.id); }} className="rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-white">{t('Join')}</button>
        </span>
      ) : yourTurn ? (
        <button type="button" onClick={() => openGame(g.id)} className="rounded-full bg-accent px-3.5 py-1.5 text-sm font-semibold text-white">{t('Play')}</button>
      ) : over ? (
        <button type="button" onClick={() => dismiss(g.id)} aria-label={t('Clear {game}', { game })} className="grid size-8 place-items-center rounded-full text-muted hover:bg-panel-2 hover:text-ink"><X className="size-4" /></button>
      ) : <ChevronRight className="size-5 text-muted" />}
    </li>
  );
}

/** On Chats: the games that need you, in one small card. */
export function GamesStrip() {
  const games = useGames((s) => s.games);
  const unread = useGames((s) => s.unread);
  const active = listed(games).filter((g) => g.status !== 'over');
  if (!active.length) return null;
  const shown = active.slice(0, 2);
  return (
    <section aria-label={t('Games')} className="mx-3 mt-1 mb-2 overflow-hidden rounded-2xl border border-line/70 bg-panel">
      <div className="flex items-center gap-2 px-3 pt-2 text-xs font-semibold tracking-wide text-muted uppercase">
        <Gamepad2 className="size-4" /><span className="flex-1">{t('Games')}</span>
        <button type="button" onClick={() => go('games')} className="rounded-full px-2 py-1 text-xs font-semibold normal-case text-accent-ink hover:bg-hover">
          {active.length > shown.length ? t('See all ({n})', { n: active.length }) : t('See all')}
        </button>
      </div>
      <ul>{shown.map((g) => <Row key={g.id} g={g} unread={unread[g.id] || 0} compact />)}</ul>
    </section>
  );
}

/** On the Games page: the ones going on, then the finished ones with their result. */
export function GamesList() {
  const games = useGames((s) => s.games);
  const unread = useGames((s) => s.unread);
  const all = listed(games);
  const active = all.filter((g) => g.status !== 'over'), done = all.filter((g) => g.status === 'over');
  return (
    <>
      {active.length > 0 && <ul aria-label={t('Playing now')} className="divide-y divide-line/60">{active.map((g) => <Row key={g.id} g={g} unread={unread[g.id] || 0} />)}</ul>}
      {done.length > 0 && (
        <section aria-label={t('Finished')} className={cn(active.length > 0 && 'border-t border-line')}>
          <div className="flex items-center px-4 pt-3 pb-1">
            <h3 className="flex-1 text-xs font-semibold tracking-wide text-muted uppercase">{t('Finished')}</h3>
            <button type="button" onClick={() => done.forEach((g) => dismiss(g.id))} className="rounded-full px-2 py-1 text-xs font-semibold text-accent-ink hover:bg-hover">{t('Clear all')}</button>
          </div>
          <ul className="divide-y divide-line/60">{done.map((g) => <Row key={g.id} g={g} unread={0} />)}</ul>
        </section>
      )}
    </>
  );
}
