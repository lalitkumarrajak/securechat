import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowLeft, ArrowRight, Eye, EyeOff, Gamepad2, Lock, MessageCircle, NotebookPen, Phone, ShieldCheck, Smartphone,
  Sparkles, UserPlus, Wallet, Wifi,
} from 'lucide-react';
import { Button } from '@sanga/ui/button';
import { Input, Label } from '@sanga/ui/input';
import { Tabs, TabsContent, TabsList } from '@sanga/ui/tabs';
import { login, register } from '../../lib/engine';
import { resetSection } from '../../lib/nav';
import { hasPendingLink } from '../games/store';
import { pendingGroupInvite, pendingInviter } from '../../lib/invite';
import { useApp } from '../../state/app';

type Auth = 'signin' | 'signup';

const APPS = [
  { icon: MessageCircle, name: 'Chat', text: 'Messages, groups, stories, voice notes, and voice and video calls.', bg: 'linear-gradient(140deg, #14b8a6, #0f3d3a)' },
  { icon: Gamepad2, name: 'Games', text: 'Ludo and UNO with friends, anyone with a link, or computer players.', bg: 'linear-gradient(140deg, #6366f1, #312e81)' },
  { icon: NotebookPen, name: 'Diary', text: 'Private notes and a daily diary, synced and encrypted.', bg: 'linear-gradient(140deg, #f59e0b, #92400e)' },
  { icon: Wallet, name: 'Split', text: 'Share bills and trips with friends. Coming soon.', bg: 'linear-gradient(140deg, #64748b, #1e293b)', soon: true },
];

const SAFETY = [
  { icon: Lock, title: 'End-to-end encrypted', text: 'Messages, photos, calls and notes are locked on your device. Not even our server can read them.' },
  { icon: UserPlus, title: 'Friends only', text: 'Nobody can message you until you accept their friend request.' },
  { icon: Wifi, title: 'Made for slow networks', text: 'A small app with compressed photos. Messages wait offline and send when you’re back.' },
  { icon: Smartphone, title: 'Works like an app', text: 'Install it from your browser on any phone or computer. No app store needed.' },
];

export function Landing() {
  const invite = hasPendingLink() || !!pendingGroupInvite() || !!pendingInviter();
  const [auth, setAuthState] = useState<Auth | null>(() => (!invite ? null : pendingInviter() && !hasPendingLink() && !pendingGroupInvite() ? 'signup' : 'signin'));
  useEffect(() => { resetSection(); }, []);
  // The phone's back button closes the sign-in screen.
  useEffect(() => {
    const back = () => setAuthState(null);
    window.addEventListener('popstate', back);
    return () => window.removeEventListener('popstate', back);
  }, []);
  const open = (a: Auth) => { history.pushState({ auth: true }, ''); setAuthState(a); window.scrollTo(0, 0); };
  const close = () => { if (history.state?.auth) history.back(); else setAuthState(null); };

  return auth ? <AuthScreen tab={auth} setTab={setAuthState} onBack={invite ? undefined : close} /> : <Welcome open={open} />;
}

function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <img src="/logo.svg" alt="" className="size-9 rounded-xl" />
      <span className="text-xl font-bold tracking-tight">Sanga</span>
    </span>
  );
}

function Welcome({ open }: { open: (a: Auth) => void }) {
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

// A phone showing Sanga, drawn with plain HTML so it costs no download.
function PhoneMock() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-[300px] select-none md:max-w-[320px]">
      <div className="absolute -inset-6 rounded-[3rem] bg-accent/15 blur-2xl" />
      <div className="relative rounded-[2.6rem] border-[10px] border-slate-900 bg-bg shadow-2xl dark:border-slate-700">
        <div className="mx-auto mt-2 h-5 w-24 rounded-full bg-slate-900 dark:bg-slate-700" />
        <div className="px-4 pt-4 pb-6">
          <p className="text-xs text-muted">Good evening,</p>
          <p className="text-xl font-bold">Ayansh 👋</p>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <MockTile bg="linear-gradient(140deg, #14b8a6, #0f3d3a)" icon={<MessageCircle className="size-4" />} name="Chat" stat="3 unread" />
            <MockTile bg="linear-gradient(140deg, #6366f1, #312e81)" icon={<Gamepad2 className="size-4" />} name="Games" stat="Your turn" />
            <MockTile bg="linear-gradient(140deg, #f59e0b, #92400e)" icon={<NotebookPen className="size-4" />} name="Diary" stat="Today" />
            <MockTile bg="linear-gradient(140deg, #64748b, #1e293b)" icon={<Wallet className="size-4" />} name="Split" stat="Soon" />
          </div>
          <div className="mt-4 rounded-2xl border border-line bg-panel p-3 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-full bg-pink-500 text-xs font-bold text-white">P</span>
              <span className="flex-1 text-sm font-semibold">Priya</span>
              <Phone className="size-4 text-accent-ink" />
            </div>
            <p className="mt-2 w-fit rounded-2xl rounded-tl-sm bg-panel-2 px-3 py-1.5 text-xs">Ludo tonight? 🎲</p>
            <p className="mt-1.5 ml-auto w-fit rounded-2xl rounded-tr-sm bg-bubble-out px-3 py-1.5 text-xs">I’m in! 🔥</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockTile({ bg, icon, name, stat }: { bg: string; icon: ReactNode; name: string; stat: string }) {
  return (
    <div className="rounded-2xl p-3 text-white" style={{ background: bg }}>
      <span className="grid size-7 place-items-center rounded-lg bg-white/20">{icon}</span>
      <p className="mt-5 text-sm font-bold">{name}</p>
      <p className="text-[10px] text-white/80">{stat}</p>
    </div>
  );
}

function AuthScreen({ tab, setTab, onBack }: { tab: Auth; setTab: (t: Auth) => void; onBack?: () => void }) {
  const signupOpen = useApp((s) => s.signupOpen);
  return (
    <div className="grid h-full overflow-y-auto bg-bg md:grid-cols-2">
      <aside className="relative hidden overflow-hidden p-10 text-white md:flex md:flex-col"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.07) 0 1.5px, transparent 2px) 0 0 / 26px 26px, linear-gradient(150deg, var(--accent), #1e1b4b)' }}>
        <span className="flex items-center gap-2.5">
          <img src="/logo.svg" alt="" className="size-9 rounded-xl" />
          <span className="text-xl font-bold">Sanga</span>
        </span>
        <div className="mt-auto max-w-md">
          <h2 className="text-4xl leading-tight font-bold">Chat, play and write with the people you choose.</h2>
          <ul className="mt-8 grid gap-3 text-white/85">
            {APPS.filter((a) => !a.soon).map(({ icon: Icon, name, text }) => (
              <li key={name} className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/15"><Icon className="size-4" /></span><span className="text-sm"><b className="text-white">{name}.</b> {text}</span></li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="flex min-h-full flex-col px-5 py-6 md:px-12">
        <div className="flex items-center gap-2">
          {onBack && <Button variant="ghost" onClick={onBack} className="-ml-2 gap-1.5"><ArrowLeft className="size-4" /> Back</Button>}
          <span className="ml-auto md:hidden"><Logo /></span>
        </div>
        <div className="mx-auto my-auto w-full max-w-sm py-8">
          <InviteBanner />
          <h1 className="text-3xl font-bold tracking-tight">{tab === 'signup' ? 'Create your account' : 'Welcome back'}</h1>
          <p className="mt-2 mb-6 text-muted">{tab === 'signup' ? 'Pick a username and a strong password.' : 'Sign in to continue to Sanga.'}</p>
          <Tabs value={tab} onValueChange={(v) => setTab(v as Auth)}>
            <TabsList tabs={[
              { value: 'signin', label: 'Sign in' },
              ...(signupOpen ? [{ value: 'signup', label: 'Create account' }] : []),
            ]} />
            <TabsContent value="signin" className="mt-6"><AuthForm mode="signin" /></TabsContent>
            {signupOpen && <TabsContent value="signup" className="mt-6"><AuthForm mode="signup" /></TabsContent>}
          </Tabs>
          <p className="mt-6 flex items-start gap-2 text-xs text-muted">
            <ShieldCheck className="mt-px size-4 shrink-0 text-accent-ink" />
            Your password unlocks your encryption key and never leaves this device. It can’t be reset, so keep it safe.
          </p>
        </div>
      </main>
    </div>
  );
}

function InviteBanner() {
  const text = hasPendingLink() ? '🎲 You’ve been invited to a game. Sign in, or create a free account, to join.'
    : pendingGroupInvite() ? '👥 You’ve been invited to a group. Sign in, or create a free account, to join.'
    : pendingInviter() ? `👋 @${pendingInviter()} invited you to Sanga. Create a free account, or sign in, to chat.` : '';
  return text ? <p className="mb-6 rounded-2xl bg-accent/12 px-4 py-3 text-sm font-medium text-accent-ink" role="status">{text}</p> : null;
}

const USER_RE = /^[a-z0-9_.]{3,24}$/;

function AuthForm({ mode }: { mode: 'signin' | 'signup' }) {
  const [u, setU] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const signup = mode === 'signup';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const name = u.trim().toLowerCase();
    if (signup) {
      if (!USER_RE.test(name)) return setError('Username: 3–24 characters, using a–z, 0–9, _ and .');
      if (pw.length < 8) return setError('Use a password with at least 8 characters.');
      if (pw !== pw2) return setError('The passwords don’t match.');
    }
    setBusy(true);
    try {
      await (signup ? register(name, pw) : login(name, pw));
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const strength = pw.length >= 14 ? 3 : pw.length >= 10 && /\d/.test(pw) && /[^a-z0-9]/i.test(pw) ? 2 : pw.length >= 8 ? 1 : 0;

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <div>
        <Label htmlFor={mode + '-u'} hint={signup ? 'a–z, 0–9, _ .' : undefined}>Username</Label>
        <Input id={mode + '-u'} value={u} onChange={(e) => setU(e.target.value)} autoComplete="username"
          autoCapitalize="none" spellCheck={false} maxLength={24} required placeholder="e.g. ayansh" />
      </div>
      <div>
        <Label htmlFor={mode + '-p'}>Password</Label>
        <div className="relative">
          <Input id={mode + '-p'} type={show ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)}
            autoComplete={signup ? 'new-password' : 'current-password'} required className="pr-11" />
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted hover:text-ink">
            {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
        {signup && pw && (
          <div className="mt-2 flex items-center gap-2" aria-live="polite">
            <div className="flex flex-1 gap-1">
              {[1, 2, 3].map((i) => (
                <span key={i} className={`h-1 flex-1 rounded-full ${strength >= i ? ['', 'bg-amber-500', 'bg-lime-500', 'bg-green-600'][strength] : 'bg-line'}`} />
              ))}
            </div>
            <span className="text-xs text-muted">{['Too short', 'OK', 'Good', 'Strong'][strength]}</span>
          </div>
        )}
      </div>
      {signup && (
        <div>
          <Label htmlFor="signup-p2">Confirm password</Label>
          <Input id="signup-p2" type={show ? 'text' : 'password'} value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" required />
        </div>
      )}
      {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <Button type="submit" size="lg" loading={busy} className="mt-1 w-full">
        {busy ? 'Securing your keys…' : signup ? 'Create account' : 'Sign in'}
      </Button>
    </form>
  );
}
