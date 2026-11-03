import { Suspense, useEffect, useRef, useState } from 'react';
import { ArrowLeft, LogOut, MessageCircle, MoreVertical, Smile, Volume2, VolumeX } from 'lucide-react';
import { IconButton, Spinner } from '@sanga/ui/button';
import { confirm } from '@sanga/ui/confirm';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@sanga/ui/menu';
import { myName } from '../../../lib/engine';
import { setSettings, useSettings } from '../../../state/settings';
import { t } from '@sanga/i18n';
import { GAME_UI } from '../registry';
import { act, dismiss, leave, openGame, say, setChatOpen, tease, useGames, type Game } from '../store';
import { TeaseLayer } from '../TeaseLayer';
import { TeaseMenu } from '../TeaseMenu';
import { QuickTray } from './QuickTray';
import { ChatSheet } from './ChatSheet';
import { Lobby } from './Lobby';
import { Results } from './Results';

const BUBBLE_MS = 4000;

export function GameView({ g }: { g: Game }) {
  const ui = GAME_UI[g.type];
  const me = myName();
  const mePl = g.players.find((p) => p.u === me);
  const chatOpen = useGames((s) => s.chatOpen);
  const unread = useGames((s) => s.unread[g.id] || 0);
  const bubbles = useGames((s) => s.bubble);
  const sound = useSettings((s) => s.gameSound);
  const [tray, setTray] = useState(false);
  const [menu, setMenu] = useState<{ u: string; x: number; y: number; top: number } | null>(null);
  const lastTease = useRef(0);
  const [, tick] = useState(0);
  const [showResults, setShowResults] = useState(g.status === 'over');

  useEffect(() => { // re-render so speech bubbles disappear on time
    const iv = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => { // let the last moves play before the results
    if (g.status !== 'over') return;
    const tm = setTimeout(() => setShowResults(true), 3500);
    return () => clearTimeout(tm);
  }, [g.status]);

  const bubble = (u: string) => {
    const b = bubbles[`${g.id}/${u}`];
    return b && Date.now() - b.ts < BUBBLE_MS ? b.x : null;
  };

  // Tap another player's panel to throw something at them.
  const onBoardClick = (e: React.MouseEvent) => {
    if (g.status !== 'play' || !mePl || mePl.state === 'declined') return;
    const target = e.target as HTMLElement;
    const panel = target.closest<HTMLElement>('[data-player]');
    if (!panel || target.closest('button, a, input')) return; // i18n-ok
    const u = panel.dataset.player!;
    const pl = g.players.find((p) => p.u === u);
    if (!pl || u === me || pl.state === 'declined' || pl.state === 'left' || pl.state === 'out') return;
    const r = panel.getBoundingClientRect();
    setMenu({ u, x: r.left + r.width / 2, y: r.bottom, top: r.top });
  };
  const throwAt = (k: string) => {
    if (!menu) return;
    if (Date.now() - lastTease.current > 900) { lastTease.current = Date.now(); tease(g.id, menu.u, k); }
    setMenu(null);
  };

  const leaveGame = async () => {
    const lobby = g.status === 'lobby';
    const host = g.host === me;
    if (g.status === 'over') return dismiss(g.id);
    const ok = await confirm({
      title: lobby ? (host ? t('Cancel this game?') : t('Leave this game?')) : t('Leave the game?'),
      description: lobby ? undefined : t('Your tokens leave the board and you can’t rejoin.'),
      confirmText: lobby && host ? t('Cancel game') : t('Leave'), destructive: true,
    });
    if (!ok) return;
    leave(g.id);
    openGame(null);
  };

  return (
    <div className="fixed inset-0 z-30 flex flex-col text-white" style={{ background: ui?.background || '#0c2c79' }}
      role="dialog" aria-label={ui ? t(ui.name) : t('Game')}>
      <header className="flex h-14 shrink-0 items-center gap-1 px-2 pt-[env(safe-area-inset-top)]">
        <IconButton label={t('Back to chats')} className="text-white hover:bg-white/10" onClick={() => openGame(null)}><ArrowLeft /></IconButton>
        <h1 className="flex-1 truncate text-lg font-bold tracking-wide">{ui?.emoji} {ui && t(ui.name)}</h1>
        <IconButton label={sound ? t('Mute game sounds') : t('Unmute game sounds')} className="text-white hover:bg-white/10"
          onClick={() => setSettings({ gameSound: !sound })}>{sound ? <Volume2 /> : <VolumeX />}</IconButton>
        <Menu>
          <MenuTrigger asChild><IconButton label={t('Game menu')} className="text-white hover:bg-white/10"><MoreVertical /></IconButton></MenuTrigger>
          <MenuContent>
            <MenuItem icon={<LogOut />} danger onSelect={leaveGame}>
              {g.status === 'over' ? t('Close game') : g.status === 'lobby' && g.host === me ? t('Cancel game') : t('Leave game')}
            </MenuItem>
          </MenuContent>
        </Menu>
      </header>

      <main className="relative min-h-0 flex-1" onClick={onBoardClick}>
        {g.status === 'lobby' ? <Lobby g={g} me={me} onLeave={leaveGame} /> : ui ? (
          <Suspense fallback={<div className="grid h-full place-items-center"><Spinner /></div>}>
            <ui.Board g={g} me={me} act={(a) => act(g.id, a)} bubble={bubble} />
          </Suspense>
        ) : <p className="p-6 text-center">{t('Update the app to play this game.')}</p>}
      </main>

      {g.status !== 'lobby' && mePl && mePl.state !== 'declined' && (
        <footer className="relative flex shrink-0 items-center justify-center gap-3 px-3 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {tray && <QuickTray onPick={(x) => { say(g.id, x); setTray(false); }} onClose={() => setTray(false)} />}
          <button type="button" onClick={() => setTray((v) => !v)} aria-label={t('Emoji and quick messages')}
            className="grid size-11 place-items-center rounded-full bg-white/15 shadow-inner hover:bg-white/25"><Smile className="size-6" /></button>
          <button type="button" onClick={() => setChatOpen(true)} aria-label={t('Game chat')}
            className="relative grid size-11 place-items-center rounded-full bg-white/15 hover:bg-white/25">
            <MessageCircle className="size-6" />
            {unread > 0 && <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-red-500 px-1 text-xs font-bold">{unread}</span>}
          </button>
        </footer>
      )}

      <TeaseLayer gid={g.id} />
      {menu && <TeaseMenu name={g.players.find((p) => p.u === menu.u)?.n || menu.u} at={menu} onPick={throwAt} onClose={() => setMenu(null)} />}
      <ChatSheet g={g} open={chatOpen} onOpenChange={setChatOpen} />
      {showResults && g.status === 'over' && <Results g={g} me={me} />}
    </div>
  );
}
