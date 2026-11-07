import { ArrowRight, BellRing, Check, Languages, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@sanga/ui/button';
import { useApp } from '../../../state/app';
import { Logo } from './Logo';
import { PhoneMock } from './PhoneMock';
import { APPS, SAFETY, SPLIT_KINDS, STEPS } from './landingData';
import type { Auth } from './types';
import { LANGS, lang, setLang, t, type Lang } from '@sanga/i18n';

export function Welcome({ open }: { open: (a: Auth) => void }) {
  const signupOpen = useApp((s) => s.signupOpen);
  const emailRequired = useApp((s) => s.emailRequired);
  const start = () => open(signupOpen ? 'signup' : 'signin');
  return (
    <div className="h-full overflow-y-auto bg-bg">
      <header className="sticky top-0 z-20 border-b border-line/60 bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 md:px-8">
          <Logo />
          <nav className="ml-8 hidden flex-1 gap-6 text-sm font-medium text-muted md:flex">
            <a href="#apps" className="hover:text-ink">{t('Apps')}</a>
            <a href="#how" className="hover:text-ink">{t('How it works')}</a>
            <a href="#split" className="hover:text-ink">{t('Split')}</a>
            <a href="#safety" className="hover:text-ink">{t('Privacy')}</a>
          </nav>
          <span className="flex-1 md:hidden" />
          <label className="relative flex items-center rounded-lg text-sm font-medium text-muted hover:bg-hover hover:text-ink">
            <Languages className="pointer-events-none absolute left-2 size-4" aria-hidden />
            <select aria-label={t('Language')} value={lang()} onChange={(e) => void setLang(e.target.value as Lang)}
              className="h-9 cursor-pointer appearance-none bg-transparent pr-2 pl-8 outline-none focus-visible:ring-2 focus-visible:ring-accent">
              {LANGS.map((l) => <option key={l.id} value={l.id} lang={l.id}>{l.name}</option>)}
            </select>
          </label>
          <Button variant="ghost" onClick={() => open('signin')}>{t('Sign in')}</Button>
          {signupOpen && <Button onClick={() => open('signup')} className="hidden sm:inline-flex">{t('Sign up')}</Button>}
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(50% 60% at 10% 10%, color-mix(in oklab, var(--accent) 20%, transparent), transparent 70%), radial-gradient(45% 55% at 95% 30%, color-mix(in oklab, #6366f1 18%, transparent), transparent 70%), radial-gradient(40% 50% at 60% 100%, color-mix(in oklab, #f59e0b 12%, transparent), transparent 70%)' }} />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-12 pb-16 md:grid-cols-[1.15fr_1fr] md:px-8 md:pt-20 md:pb-24">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel/70 px-3 py-1 text-xs font-semibold text-accent-ink shadow-sm">
              <Sparkles className="size-3.5" /> {t('Private by design · Free')}
            </span>
            <h1 className="mt-5 text-4xl leading-[1.08] font-extrabold tracking-tight md:text-6xl">
              {t('Your people.')}<br />{t('Your space.')}<br /><span className="bg-linear-to-r from-accent to-indigo-500 bg-clip-text text-transparent">{t('All in one app.')}</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-muted">
              {t('Sanga brings chat, calls, stories, games, shared expenses, your calendar and your diary together, all end-to-end encrypted, all with the people you choose.')}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" onClick={start} className="gap-2 px-6">
                {signupOpen ? t('Get started, it’s free') : t('Sign in')} <ArrowRight className="size-4" />
              </Button>
              {signupOpen && <Button size="lg" variant="outline" onClick={() => open('signin')} className="px-6">{t('I have an account')}</Button>}
            </div>
            <p className="mt-5 flex items-center gap-2 text-sm text-muted"><ShieldCheck className="size-4 text-accent-ink" /> {emailRequired ? t('No phone number needed.') : t('No phone number or email needed.')}</p>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium">
              {[t('6 apps, one sign-in'), t('5 games'), t('English, हिन्दी, मराठी')].map((x) => (
                <li key={x} className="flex items-center gap-1.5"><Check className="size-4 text-accent-ink" />{x}</li>
              ))}
            </ul>
          </div>
          <PhoneMock />
        </div>
      </section>

      <section id="apps" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-14 md:px-8">
        <p className="text-sm font-semibold tracking-wide text-accent-ink uppercase">{t('One sign-in, many apps')}</p>
        <h2 className="mt-2 max-w-xl text-3xl font-bold tracking-tight md:text-4xl">{t('Everything you do with friends, in one place')}</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {APPS.map(({ icon: Icon, name, text, bg, tags }) => (
            <article key={name} className={`relative flex flex-col overflow-hidden rounded-3xl p-5 text-white shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:shadow-xl`} style={{ background: bg }}>
              <span aria-hidden className="absolute -right-8 -bottom-8 size-32 rounded-full bg-white/10" />
              <span className="grid size-12 place-items-center rounded-2xl bg-white/20"><Icon className="size-6" /></span>
              <h3 className="mt-8 flex items-center gap-2 text-xl font-bold">
                {t(name)}
              </h3>
              <p className="mt-1 text-sm text-white/80">{t(text)}</p>
              <ul className="relative mt-auto flex flex-wrap gap-1.5 pt-4">
                {tags.map((x) => <li key={x} className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium ring-1 ring-white/20">{t(x)}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl scroll-mt-16 px-4 pb-14 md:px-8">
        <p className="text-sm font-semibold tracking-wide text-accent-ink uppercase">{t('How it works')}</p>
        <h2 className="mt-2 max-w-xl text-3xl font-bold tracking-tight md:text-4xl">{t('Up and running in a minute')}</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="relative rounded-3xl border border-line bg-panel p-5 shadow-sm">
              <span className="absolute top-4 right-5 text-4xl font-extrabold text-line">{i + 1}</span>
              <span className="grid size-11 place-items-center rounded-2xl bg-accent/12 text-accent-ink"><Icon className="size-5" /></span>
              <h3 className="mt-4 font-semibold">{t(title)}</h3>
              <p className="mt-1 text-sm text-muted">{t(text)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="split" className="scroll-mt-16 border-t border-line">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-[1fr_1.1fr] md:px-8">
          <div>
            <p className="text-sm font-semibold tracking-wide text-emerald-600 uppercase dark:text-emerald-400">{t('Split')}</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">{t('Money between friends, without the awkward part')}</h2>
            <p className="mt-4 text-muted">{t('Every group says what it’s for, so your spending stays honest: card bills and money lent never count twice.')}</p>
            <p className="mt-5 flex items-start gap-2 text-sm"><BellRing className="mt-0.5 size-4 shrink-0 text-rose-500" />
              <span>{t('The Calendar reminds you when a card bill is due, and one tap records the payment in Split.')}</span></p>
          </div>
          <ul className="grid gap-3">
            {SPLIT_KINDS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="flex items-center gap-4 rounded-2xl border border-line bg-panel p-4 shadow-sm">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"><Icon className="size-5" /></span>
                <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">{t(title)}
                  {i === 0 && <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">{t('Counts as spending')}</span>}</span>
                  <span className="mt-0.5 block text-sm text-muted">{t(text)}</span></span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="safety" className="scroll-mt-16 border-y border-line bg-panel">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[1fr_1.4fr] md:px-8">
          <div>
            <p className="text-sm font-semibold tracking-wide text-accent-ink uppercase">{t('Privacy')}</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">{t('Only you and your friends can see it')}</h2>
            <p className="mt-4 text-muted">{t('Your password unlocks your encryption key on your device. It never leaves it, and we can’t read your chats, calls or notes.')}</p>
          </div>
          <ul className="grid gap-6 sm:grid-cols-2">
            {SAFETY.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent/12 text-accent-ink"><Icon className="size-5" /></span>
                <span><span className="block font-semibold">{t(title)}</span><span className="mt-1 block text-sm text-muted">{t(text)}</span></span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 md:px-8">
        <div className="relative overflow-hidden rounded-3xl px-6 py-12 text-center text-white md:py-16"
          style={{ background: 'linear-gradient(135deg, var(--accent), #312e81)' }}>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{t('Bring your people together')}</h2>
          <p className="mx-auto mt-3 max-w-md text-white/80">{t('Create an account in seconds, add your friends, and start chatting, playing and splitting.')}</p>
          <Button size="lg" variant="outline" onClick={start} className="mt-7 gap-2 border-transparent px-6 text-slate-900 hover:bg-white/90" style={{ background: '#fff' }}>
            {signupOpen ? t('Create your free account') : t('Sign in')} <ArrowRight className="size-4" />
          </Button>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-6 text-sm text-muted md:px-8">
          <Logo />
          <span className="flex-1" />
          <span>{t('End-to-end encrypted · Works on any device')}</span>
        </div>
      </footer>
    </div>
  );
}
