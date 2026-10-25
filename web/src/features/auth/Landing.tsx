import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Lock, MessageCircleHeart, ShieldCheck, Smartphone, Smile, UserPlus, Wifi } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input, Label } from '../../components/ui/input';
import { Tabs, TabsContent, TabsList } from '../../components/ui/tabs';
import { login, register } from '../../lib/engine';
import { useApp } from '../../state/app';

const FEATURES = [
  { icon: Lock, title: 'End-to-end encrypted', text: 'Messages, photos and voice notes are locked on your device. Not even our server can read them.' },
  { icon: UserPlus, title: 'Friends only', text: 'Nobody can message you until you accept their friend request.' },
  { icon: Wifi, title: 'Made for slow networks', text: 'Tiny app, compressed photos, and messages that wait offline and send when you’re back.' },
  { icon: Smile, title: 'Expressive', text: 'Replies, reactions, animated emoji, pins and voice messages.' },
];

export function Landing() {
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const signupOpen = useApp((s) => s.signupOpen);

  return (
    <div className="h-full overflow-y-auto bg-bg">
      <div className="mx-auto grid min-h-full max-w-6xl items-center gap-10 px-5 py-8 md:grid-cols-[1.1fr_1fr] md:gap-16 md:px-10">
        <section>
          <div className="flex items-center gap-3">
            <img src="/icon.svg" alt="" className="size-11" />
            <span className="text-2xl font-bold tracking-tight">Chattrix</span>
          </div>
          <h1 className="mt-8 text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            Private chats with the people <span className="text-accent-ink">you choose.</span>
          </h1>
          <p className="mt-4 max-w-lg text-lg text-muted">
            Fast, friendly messaging that keeps your conversations between you and your friends, and nobody else.
          </p>
          <ul className="mt-8 hidden gap-5 sm:grid sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/12 text-accent-ink"><Icon className="size-5" /></span>
                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className="mt-0.5 block text-sm text-muted">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl border border-line bg-panel p-6 shadow-xl shadow-black/5 md:p-8">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
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
        </section>

        <ul className="grid gap-4 sm:hidden">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/12 text-accent-ink"><Icon className="size-5" /></span>
              <span><span className="block font-semibold">{title}</span><span className="block text-sm text-muted">{text}</span></span>
            </li>
          ))}
        </ul>
        <footer className="flex items-center gap-4 text-xs text-muted md:col-span-2">
          <span className="flex items-center gap-1.5"><MessageCircleHeart className="size-4" /> Chattrix</span>
          <span className="flex items-center gap-1.5"><Smartphone className="size-4" /> Works as an app: install it from your browser menu</span>
        </footer>
      </div>
    </div>
  );
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
