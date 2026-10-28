// Games: pick a game to start (with friends, a link, or computer players), and the games you're in.
import { Bot, Link2, Users } from 'lucide-react';
import { AppTabs } from '../nav/AppTabs';
import { GAME_UI } from './registry';
import { GamesStrip } from './GamesStrip';
import { listed, openPicker, useGames } from './store';

export function GamesHub() {
  const any = useGames((s) => listed(s.games).length > 0);
  return (
    <div className="flex h-[var(--app-h,100dvh)] flex-col bg-bg">
    <div className="min-h-0 flex-1 overflow-y-auto">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4 md:h-16 md:px-8">
          <h1 className="flex-1 text-xl font-bold tracking-tight">Games</h1>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 pb-12 md:px-8">
        <section className="relative mt-5 overflow-hidden rounded-3xl p-6 text-white md:p-8"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0 1.5px, transparent 2px) 0 0 / 26px 26px, linear-gradient(135deg, #6366f1, #1e1b4b)' }}>
          <span aria-hidden className="absolute -top-6 right-4 hidden rotate-12 text-8xl sm:block opacity-90 md:right-12 md:text-9xl">🎲</span>
          <span aria-hidden className="absolute right-24 -bottom-8 hidden -rotate-12 text-7xl sm:block opacity-80 md:right-44 md:text-8xl">🃏</span>
          <p className="text-sm font-semibold tracking-wide text-white/70 uppercase">Game night</p>
          <h2 className="mt-1 max-w-sm text-2xl font-bold md:text-3xl">Play together, wherever you are</h2>
          <ul className="mt-4 grid max-w-md gap-2 text-sm text-white/85">
            <li className="flex items-center gap-2"><Users className="size-4" /> Invite friends right from Sanga</li>
            <li className="flex items-center gap-2"><Link2 className="size-4" /> Or share a link with anyone</li>
            <li className="flex items-center gap-2"><Bot className="size-4" /> Fill empty seats with computer players</li>
          </ul>
        </section>

        <h2 className="mt-8 mb-3 text-lg font-semibold">Choose a game</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {Object.values(GAME_UI).map((g) => (
            <article key={g.type} className="overflow-hidden rounded-3xl border border-line bg-panel shadow-sm">
              <div className="grid h-36 place-items-center text-7xl" style={{ background: g.background }} aria-hidden>{g.emoji}</div>
              <div className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-bold">{g.name}</h3>
                  <p className="text-sm text-muted">{g.blurb}</p>
                </div>
                <button type="button" onClick={() => openPicker([], undefined, g.type)} aria-label={`Play ${g.name}`}
                  className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110">
                  Play
                </button>
              </div>
            </article>
          ))}
        </div>

        <h2 className="mt-8 mb-3 text-lg font-semibold">Your games</h2>
        <div className="overflow-hidden rounded-3xl border border-line bg-panel">
          {any ? <GamesStrip /> : <p className="px-4 py-8 text-center text-sm text-muted">No games yet. Pick one above to start.</p>}
        </div>
        <p className="mt-3 text-center text-xs text-muted">Tip: in the waiting room, tap “Add computer player” to play even when your friends are busy.</p>
      </div>
    </div>
    <AppTabs />
    </div>
  );
}
