// The full-screen game view every game shares: header, lobby, the game's own board, in-game
// chat with emoji and quick phrases, and the results.
import { Suspense, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bot, Check, Clock, Crown, LogOut, MessageCircle, MoreVertical, SendHorizontal, Smile, Volume2, VolumeX, X } from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import { LinkBox } from '../../components/LinkBox';
import { Button, IconButton, Spinner } from '@sanga/ui/button';
import { confirm } from '@sanga/ui/confirm';
import { Dialog } from '@sanga/ui/dialog';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@sanga/ui/menu';
import { myName } from '../../lib/engine';
import { cn } from '@sanga/ui/utils';
import { useApp } from '../../state/app';
import { setSettings, useSettings } from '../../state/settings';
import { GAME_UI } from './registry';
import { insertMention, mentionQuery, splitMentions } from '../../lib/mentions';
import {
  act, addBot, createGame, decline, dismiss, dropBot, gameName, join, leave, linkShared, nameOf, openGame, say, setChatOpen, shareLink, startNow, useGames, type ChatLine, type Game,
} from './store';

export const QUICK_EMOJI = ['😂', '😍', '😎', '😡', '😭', '🔥', '👏', '🙏', '😈', '🤞'];
export const PHRASES = ['Hurry up!', 'Nice move!', 'Oops!', 'Well played!', 'Not again 😩', 'Good luck!', 'You’re going down!', 'Thanks!'];
const BUBBLE_MS = 4000;
const NO_LINES: ChatLine[] = []; // stable, so the store selector doesn't re-render forever

export function GameScreen() {
  const id = useGames((s) => s.open);
  const g = useGames((s) => (id ? s.games[id] : undefined));
  if (!id || !g) return null;
  return <GameView key={id} g={g} />;
}

function GameView({ g }: { g: Game }) {
  const ui = GAME_UI[g.type];
  const me = myName();
  const mePl = g.players.find((p) => p.u === me);
  const chatOpen = useGames((s) => s.chatOpen);
  const unread = useGames((s) => s.unread[g.id] || 0);
  const bubbles = useGames((s) => s.bubble);
  const sound = useSettings((s) => s.gameSound);
  const [tray, setTray] = useState(false);
  const [, tick] = useState(0);
  const [showResults, setShowResults] = useState(g.status === 'over');

  useEffect(() => { // re-render so speech bubbles disappear on time
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { // let the last moves play before the results
    if (g.status !== 'over') return;
    const t = setTimeout(() => setShowResults(true), 2500);
    return () => clearTimeout(t);
  }, [g.status]);

  const bubble = (u: string) => {
    const b = bubbles[`${g.id}/${u}`];
    return b && Date.now() - b.ts < BUBBLE_MS ? b.x : null;
  };

  const leaveGame = async () => {
    const lobby = g.status === 'lobby';
    const host = g.host === me;
    if (g.status === 'over') return dismiss(g.id);
    const ok = await confirm({
      title: lobby ? (host ? 'Cancel this game?' : 'Leave this game?') : 'Leave the game?',
      description: lobby ? undefined : 'Your tokens leave the board and you can’t rejoin.',
      confirmText: lobby && host ? 'Cancel game' : 'Leave', destructive: true,
    });
    if (!ok) return;
    leave(g.id);
    openGame(null);
  };

  return (
    <div className="fixed inset-0 z-30 flex flex-col text-white" style={{ background: ui?.background || '#0c2c79' }}
      role="dialog" aria-label={`${ui?.name || 'Game'}`}>
      <header className="flex h-14 shrink-0 items-center gap-1 px-2 pt-[env(safe-area-inset-top)]">
        <IconButton label="Back to chats" className="text-white hover:bg-white/10" onClick={() => openGame(null)}><ArrowLeft /></IconButton>
        <h1 className="flex-1 truncate text-lg font-bold tracking-wide">{ui?.emoji} {ui?.name}</h1>
        <IconButton label={sound ? 'Mute game sounds' : 'Unmute game sounds'} className="text-white hover:bg-white/10"
          onClick={() => setSettings({ gameSound: !sound })}>{sound ? <Volume2 /> : <VolumeX />}</IconButton>
        <Menu>
          <MenuTrigger asChild><IconButton label="Game menu" className="text-white hover:bg-white/10"><MoreVertical /></IconButton></MenuTrigger>
          <MenuContent>
            <MenuItem icon={<LogOut />} danger onSelect={leaveGame}>
              {g.status === 'over' ? 'Close game' : g.status === 'lobby' && g.host === me ? 'Cancel game' : 'Leave game'}
            </MenuItem>
          </MenuContent>
        </Menu>
      </header>

      <main className="relative min-h-0 flex-1">
        {g.status === 'lobby' ? <Lobby g={g} me={me} onLeave={leaveGame} /> : ui ? (
          <Suspense fallback={<div className="grid h-full place-items-center"><Spinner /></div>}>
            <ui.Board g={g} me={me} act={(a) => act(g.id, a)} bubble={bubble} />
          </Suspense>
        ) : <p className="p-6 text-center">Update the app to play this game.</p>}
      </main>

      {g.status !== 'lobby' && mePl && mePl.state !== 'declined' && (
        <footer className="relative flex shrink-0 items-center justify-center gap-3 px-3 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {tray && <QuickTray onPick={(x) => { say(g.id, x); setTray(false); }} onClose={() => setTray(false)} />}
          <button type="button" onClick={() => setTray((t) => !t)} aria-label="Emoji and quick messages"
            className="grid size-11 place-items-center rounded-full bg-white/15 shadow-inner hover:bg-white/25"><Smile className="size-6" /></button>
          <button type="button" onClick={() => setChatOpen(true)} aria-label="Game chat"
            className="relative grid size-11 place-items-center rounded-full bg-white/15 hover:bg-white/25">
            <MessageCircle className="size-6" />
            {unread > 0 && <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-red-500 px-1 text-xs font-bold">{unread}</span>}
          </button>
        </footer>
      )}

      <ChatSheet g={g} open={chatOpen} onOpenChange={setChatOpen} />
      {showResults && g.status === 'over' && <Results g={g} me={me} />}
    </div>
  );
}

function QuickTray({ onPick, onClose }: { onPick: (x: string) => void; onClose: () => void }) {
  return (
    <div className="absolute bottom-full left-1/2 z-20 mb-2 w-[min(94vw,420px)] -translate-x-1/2 rounded-2xl bg-white p-3 text-slate-900 shadow-2xl animate-fade-in"
      role="menu" aria-label="Quick messages">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Send to everyone</span>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1 text-slate-500 hover:bg-slate-100"><X className="size-4" /></button>
      </div>
      <div className="grid grid-cols-5 gap-1">
        {QUICK_EMOJI.map((e) => (
          <button key={e} type="button" role="menuitem" onClick={() => onPick(e)} className="rounded-xl py-1.5 text-3xl hover:bg-slate-100" aria-label={e}>{e}</button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {PHRASES.map((p) => (
          <button key={p} type="button" role="menuitem" onClick={() => onPick(p)}
            className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium hover:bg-slate-200">{p}</button>
        ))}
      </div>
    </div>
  );
}

function ChatSheet({ g, open, onOpenChange }: { g: Game; open: boolean; onOpenChange: (o: boolean) => void }) {
  const lines = useGames((s) => s.chat[g.id] || NO_LINES);
  const me = myName();
  const [text, setText] = useState('');
  const [tag, setTag] = useState<{ start: number; q: string } | null>(null); // "@na…" being typed
  const [pick, setPick] = useState(0);
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) end.current?.scrollIntoView({ block: 'end' }); }, [open, lines.length]);
  const send = (x: string) => { const v = x.trim(); if (v) { say(g.id, v); setText(''); setTag(null); } };

  const users = g.players.filter((p) => p.state !== 'declined').map((p) => p.u);
  const others = g.players.filter((p) => p.u !== me && p.state !== 'declined');
  const matches = tag ? others.filter((p) => p.u.includes(tag.q) || (p.n || '').toLowerCase().includes(tag.q)).slice(0, 6) : [];
  const typed = (v: string, cursor: number) => { setText(v); setTag(mentionQuery(v, cursor)); setPick(0); };
  const choose = (u: string) => {
    if (!tag) return;
    const r = insertMention(text, box.current?.selectionStart ?? text.length, tag.start, u);
    setText(r.text);
    setTag(null);
    requestAnimationFrame(() => { box.current?.focus(); box.current?.setSelectionRange(r.cursor, r.cursor); });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Game chat"
      description="Seen by everyone in this game. Not end-to-end encrypted; deleted when the game ends.">
      <div className="mb-2 flex gap-1 overflow-x-auto pb-1">
        {QUICK_EMOJI.map((e) => <button key={e} type="button" onClick={() => send(e)} className="shrink-0 rounded-xl px-1.5 py-1 text-2xl hover:bg-hover" aria-label={'Send ' + e}>{e}</button>)}
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {PHRASES.slice(0, 6).map((p) => <button key={p} type="button" onClick={() => send(p)} className="rounded-full border border-line px-3 py-1 text-sm hover:bg-hover">{p}</button>)}
      </div>
      <div className="h-[38dvh] space-y-1.5 overflow-y-auto rounded-xl bg-hover/40 p-2" aria-live="polite">
        {lines.length === 0 && <p className="py-8 text-center text-sm text-muted">No messages yet. Say hi!</p>}
        {lines.map((l, k) => (
          <div key={k} className={cn('flex', l.f === me ? 'justify-end' : 'justify-start')}>
            <div className={cn('max-w-[80%] rounded-2xl px-3 py-1.5 text-sm', l.f === me ? 'bg-accent text-accent-ink' : 'bg-panel shadow-bubble')}>
              {l.f !== me && <div className="text-xs font-semibold text-accent">{nameOf(g, l.f)}</div>}
              {splitMentions(l.x, users).map((part, i) => part.u ? (
                <span key={i} className={cn('font-semibold', part.u === me ? 'rounded bg-amber-300/90 px-0.5 text-amber-950' : l.f === me ? 'underline' : 'text-accent')}>{part.t}</span>
              ) : <span key={i}>{part.t}</span>)}
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form className="relative mt-3 flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (matches.length) choose(matches[pick].u); else send(text); }}>
        {matches.length > 0 && (
          <ul className="absolute bottom-full left-0 z-10 mb-2 w-full overflow-hidden rounded-2xl border border-line bg-panel shadow-xl" role="listbox" aria-label="Mention a player">
            {matches.map((p, i) => (
              <li key={p.u} role="option" aria-selected={i === pick}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => choose(p.u)}
                  className={cn('flex w-full items-center gap-3 px-3 py-2 text-left', i === pick ? 'bg-hover' : 'hover:bg-hover')}>
                  <Avatar u={p.u} name={p.n} size={32} />
                  <span className="min-w-0 flex-1 truncate font-medium">{p.n || p.u}</span>
                  <span className="text-sm text-muted">@{p.u}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <input ref={box} value={text} maxLength={200} placeholder="Message everyone · @ to tag" aria-label="Game message"
          onChange={(e) => typed(e.target.value, e.target.selectionStart ?? e.target.value.length)}
          onKeyDown={(e) => {
            if (!matches.length) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); setPick((i) => (i + 1) % matches.length); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setPick((i) => (i - 1 + matches.length) % matches.length); }
            else if (e.key === 'Tab') { e.preventDefault(); choose(matches[pick].u); }
            else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setTag(null); }
          }}
          className="h-11 min-w-0 flex-1 rounded-full border border-line bg-panel px-4 outline-none focus:border-accent" />
        <IconButton label="Send" type="submit" variant="primary" disabled={!text.trim()}><SendHorizontal /></IconButton>
      </form>
    </Dialog>
  );
}

function Lobby({ g, me, onLeave }: { g: Game; me: string; onLeave: () => void }) {
  const ui = GAME_UI[g.type];
  const mine = g.players.find((p) => p.u === me);
  const joined = g.players.filter((p) => p.state === 'joined').length;
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const secs = Math.max(0, Math.round((g.deadline - now) / 1000));
  return (
    <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-5 px-5 text-center">
      <div className="text-6xl drop-shadow-lg" aria-hidden>{ui?.emoji}</div>
      <div>
        <h2 className="text-2xl font-bold">{mine?.state === 'invited' ? `${nameOf(g, g.host)} invited you` : 'Waiting for players'}</h2>
        <p className="mt-1 flex items-center justify-center gap-1 text-sm text-white/70">
          <Clock className="size-4" /> Invite expires in {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
        </p>
      </div>
      <ul className="w-full space-y-2">
        {g.players.map((p) => (
          <li key={p.u} className="flex items-center gap-3 rounded-2xl bg-white/10 px-3 py-2 text-left">
            <Avatar u={p.u} name={p.n} size={40} />
            <span className="min-w-0 flex-1 truncate font-medium">{p.u === me ? 'You' : p.n || p.u}{p.u === g.host && <Crown className="ml-1.5 inline size-4 text-amber-300" aria-label="host" />}</span>
            {p.bot ? (
              <>
                <span className="rounded-full bg-sky-300/90 px-2.5 py-0.5 text-xs font-semibold text-sky-950">Computer</span>
                {g.host === me && (
                  <button type="button" onClick={() => dropBot(g.id, p.u)} aria-label={`Remove ${p.n}`} className="rounded-full p-1 text-white/70 hover:bg-white/15"><X className="size-4" /></button>
                )}
              </>
            ) : (
              <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold',
                p.state === 'joined' ? 'bg-emerald-400/90 text-emerald-950' : p.state === 'declined' ? 'bg-white/15 text-white/60' : 'bg-amber-300/90 text-amber-950')}>
                {p.state === 'joined' ? <><Check className="mr-0.5 inline size-3" />Ready</> : p.state === 'declined' ? 'Declined' : 'Waiting…'}
              </span>
            )}
          </li>
        ))}
      </ul>
      {g.host === me && g.players.filter((p) => p.state !== 'declined').length < (ui?.max ?? 6) && (
        <Button variant="secondary" className="w-full gap-2" onClick={() => addBot(g.id)}>
          <Bot className="size-4" /> Add computer player
        </Button>
      )}
      {mine?.state === 'invited' ? (
        <div className="flex w-full gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => { decline(g.id); openGame(null); }}>Decline</Button>
          <Button className="flex-1 bg-emerald-500 hover:bg-emerald-600" onClick={() => join(g.id)}>Join game</Button>
        </div>
      ) : null}
      {mine?.state === 'joined' && (
        <div className="w-full rounded-2xl bg-white/10 p-3 text-left">
          <p className="mb-2 text-sm font-semibold">Invite anyone with this link</p>
          <LinkBox dark url={shareLink(g.id)} title={gameName(g.type)} text={`Play ${gameName(g.type)} with me on Sanga!`}
            onUse={() => linkShared(g)} />
          <p className="mt-2 text-xs text-white/60">They don’t need to be your friend. New people can sign up from the link.</p>
        </div>
      )}
      {mine?.state === 'invited' ? null : g.host === me ? (
        <div className="w-full space-y-2">
          <Button className="w-full bg-emerald-500 hover:bg-emerald-600" disabled={joined < (ui?.min || 2)} onClick={() => startNow(g.id)}>
            {joined < (ui?.min || 2) ? 'Waiting for someone to join…' : `Start with ${joined} players`}
          </Button>
          <p className="text-xs text-white/60">{g.open
            ? `Anyone with the link can join until you start (up to ${ui?.max ?? 6} players).`
            : 'The game starts by itself when everyone has joined.'}</p>
          <button type="button" className="text-sm text-white/70 underline" onClick={onLeave}>Cancel game</button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-white/70">Waiting for {nameOf(g, g.host)} to start…</p>
          <button type="button" className="text-sm text-white/70 underline" onClick={onLeave}>Leave</button>
        </div>
      )}
    </div>
  );
}

const MEDALS = ['🥇', '🥈', '🥉'];
const CONFETTI = ['#f5c518', '#e8322f', '#2fa24a', '#1f7fe0', '#9b3fd1', '#f5821f', '#ffffff'];

function Confetti() {
  // Fixed per mount, so it doesn't reshuffle on re-render.
  const [pieces] = useState(() => Array.from({ length: 60 }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 0.8, dur: 2.2 + Math.random() * 1.8,
    color: CONFETTI[i % CONFETTI.length], tilt: Math.random() * 360,
  })));
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {pieces.map((p, i) => (
        <span key={i} className="confetti" style={{ left: `${p.left}%`, background: p.color, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, rotate: `${p.tilt}deg` }} />
      ))}
    </div>
  );
}

function Results({ g, me }: { g: Game; me: string }) {
  const friends = useApp((s) => s.friends);
  const ranked = [...g.players].sort((a, b) => (a.rank || 99) - (b.rank || 99));
  const mine = g.players.find((p) => p.u === me);
  const cancelled = g.ev.some((e) => e.k === 'cancelled' || e.k === 'expired');
  const again = g.players.filter((p) => p.u !== me && friends[p.u]).map((p) => p.u);
  return (
    <div className="absolute inset-0 z-30 grid place-items-center overflow-hidden bg-black/60 p-5 animate-fade-in">
      {mine?.rank === 1 && !cancelled && <Confetti />}
      <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 text-center text-slate-900 shadow-2xl">
        {cancelled ? (
          <><div className="text-5xl">🕓</div><h2 className="mt-2 text-xl font-bold">Game called off</h2>
            <p className="mt-1 text-sm text-slate-500">Not enough players joined.</p></>
        ) : (
          <>
            <div className="text-5xl">{mine?.rank === 1 ? '🏆' : '🎲'}</div>
            <h2 className="mt-2 text-xl font-bold">{mine?.rank === 1 ? 'You won!' : mine?.rank ? `You came ${mine.rank}${['th', 'st', 'nd', 'rd'][mine.rank] || 'th'}` : 'Game over'}</h2>
            <ol className="mt-4 space-y-2 text-left">
              {ranked.map((p) => (
                <li key={p.u} className="flex items-center gap-3 rounded-xl bg-slate-100 px-3 py-2">
                  <span className="w-7 text-center text-xl">{p.rank ? MEDALS[p.rank - 1] || p.rank : '–'}</span>
                  <Avatar u={p.u} name={p.n} size={32} />
                  <span className="min-w-0 flex-1 truncate font-medium">{p.u === me ? 'You' : p.n || p.u}</span>
                  <span className="text-xs text-slate-500">{p.state === 'left' ? 'left' : p.state === 'out' ? 'removed' : ''}</span>
                </li>
              ))}
            </ol>
          </>
        )}
        <div className="mt-5 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => dismiss(g.id)}>Close</Button>
          {again.length > 0 && <Button className="flex-1" onClick={() => { dismiss(g.id); createGame(g.type, again); }}>Play again</Button>}
        </div>
      </div>
    </div>
  );
}
