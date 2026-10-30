import { useEffect, useState } from 'react';
import { Bot, Check, Clock, Crown, X } from 'lucide-react';
import { Avatar } from '../../../components/Avatar';
import { LinkBox } from '../../../components/LinkBox';
import { Button } from '@sanga/ui/button';
import { cn } from '@sanga/ui/utils';
import { GAME_UI } from '../registry';
import { addBot, decline, dropBot, gameName, join, linkShared, nameOf, openGame, shareLink, startNow, type Game } from '../store';

export function Lobby({ g, me, onLeave }: { g: Game; me: string; onLeave: () => void }) {
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
