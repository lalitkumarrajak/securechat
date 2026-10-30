import { ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@sanga/ui/button';
import { useApp } from '../../../state/app';
import { Logo } from './Logo';
import { PhoneMock } from './PhoneMock';
import { APPS, SAFETY } from './landingData';
import type { Auth } from './types';

export function Welcome({ open }: { open: (a: Auth) => void }) {
  const signupOpen = useApp((s) => s.signupOpen);
  const start = () => open(signupOpen ? 'signup' : 'signin');
  return (
    <div className="h-full overflow-y-auto bg-bg">
      <header className="sticky top-0 z-20 border-b border-line/60 bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 md:px-8">
          <Logo />
          <nav className="ml-8 hidden flex-1 gap-6 text-sm font-medium text-muted md:flex">
            <a href="#apps" className="hover:text-ink">Apps</a>
            <a href="#safety" className="hover:text-ink">Privacy</a>
          </nav>
          <span className="flex-1 md:hidden" />
          <Button variant="ghost" onClick={() => open('signin')}>Sign in</Button>
          {signupOpen && <Button onClick={() => open('signup')} className="hidden sm:inline-flex">Sign up</Button>}
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(50% 60% at 10% 10%, color-mix(in oklab, var(--accent) 20%, transparent), transparent 70%), radial-gradient(45% 55% at 95% 30%, color-mix(in oklab, #6366f1 18%, transparent), transparent 70%), radial-gradient(40% 50% at 60% 100%, color-mix(in oklab, #f59e0b 12%, transparent), transparent 70%)' }} />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-12 pb-16 md:grid-cols-[1.15fr_1fr] md:px-8 md:pt-20 md:pb-24">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel/70 px-3 py-1 text-xs font-semibold text-accent-ink shadow-sm">
              <Sparkles className="size-3.5" /> Private by design · Free
            </span>
            <h1 className="mt-5 text-4xl leading-[1.08] font-extrabold tracking-tight md:text-6xl">
              Your people.<br />Your space.<br /><span className="bg-linear-to-r from-accent to-indigo-500 bg-clip-text text-transparent">All in one app.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-muted">
              Sanga brings chat, calls, stories, games and your diary together, all end-to-end encrypted, all with the people you choose.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" onClick={start} className="gap-2 px-6">
                {signupOpen ? 'Get started, it’s free' : 'Sign in'} <ArrowRight className="size-4" />
              </Button>
              {signupOpen && <Button size="lg" variant="outline" onClick={() => open('signin')} className="px-6">I have an account</Button>}
            </div>
            <p className="mt-5 flex items-center gap-2 text-sm text-muted"><ShieldCheck className="size-4 text-accent-ink" /> No phone number or email needed.</p>
          </div>
          <PhoneMock />
        </div>
      </section>

      <section id="apps" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-14 md:px-8">
        <p className="text-sm font-semibold tracking-wide text-accent-ink uppercase">One sign-in, many apps</p>
        <h2 className="mt-2 max-w-xl text-3xl font-bold tracking-tight md:text-4xl">Everything you do with friends, in one place</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {APPS.map(({ icon: Icon, name, text, bg, soon }) => (
            <article key={name} className="relative overflow-hidden rounded-3xl p-5 text-white shadow-lg shadow-black/10" style={{ background: bg }}>
              <span aria-hidden className="absolute -right-8 -bottom-8 size-32 rounded-full bg-white/10" />
              <span className="grid size-12 place-items-center rounded-2xl bg-white/20"><Icon className="size-6" /></span>
              <h3 className="mt-10 flex items-center gap-2 text-xl font-bold">
                {name}{soon && <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold">Soon</span>}
              </h3>
              <p className="mt-1 text-sm text-white/80">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="safety" className="scroll-mt-16 border-y border-line bg-panel">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[1fr_1.4fr] md:px-8">
          <div>
            <p className="text-sm font-semibold tracking-wide text-accent-ink uppercase">Privacy</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Only you and your friends can see it</h2>
            <p className="mt-4 text-muted">Your password unlocks your encryption key on your device. It never leaves it, and we can’t read your chats, calls or notes.</p>
          </div>
          <ul className="grid gap-6 sm:grid-cols-2">
            {SAFETY.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent/12 text-accent-ink"><Icon className="size-5" /></span>
                <span><span className="block font-semibold">{title}</span><span className="mt-1 block text-sm text-muted">{text}</span></span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 md:px-8">
        <div className="relative overflow-hidden rounded-3xl px-6 py-12 text-center text-white md:py-16"
          style={{ background: 'linear-gradient(135deg, var(--accent), #312e81)' }}>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Bring your people together</h2>
          <p className="mx-auto mt-3 max-w-md text-white/80">Create an account in seconds, add your friends, and start chatting and playing.</p>
          <Button size="lg" variant="outline" onClick={start} className="mt-7 gap-2 border-transparent px-6 text-slate-900 hover:bg-white/90" style={{ background: '#fff' }}>
            {signupOpen ? 'Create your free account' : 'Sign in'} <ArrowRight className="size-4" />
          </Button>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-6 text-sm text-muted md:px-8">
          <Logo />
          <span className="flex-1" />
          <span>End-to-end encrypted · Works on any device</span>
        </div>
      </footer>
    </div>
  );
}
